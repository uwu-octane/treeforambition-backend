import crypto from "node:crypto"
import { AbstractPaymentProvider, MedusaError } from "@medusajs/framework/utils"
import type {
  AuthorizePaymentInput,
  AuthorizePaymentOutput,
  CancelPaymentInput,
  CancelPaymentOutput,
  CapturePaymentInput,
  CapturePaymentOutput,
  DeletePaymentInput,
  DeletePaymentOutput,
  GetPaymentStatusInput,
  GetPaymentStatusOutput,
  InitiatePaymentInput,
  InitiatePaymentOutput,
  Logger,
  ProviderWebhookPayload,
  RefundPaymentInput,
  RefundPaymentOutput,
  RetrievePaymentInput,
  RetrievePaymentOutput,
  UpdatePaymentInput,
  UpdatePaymentOutput,
  WebhookActionResult,
} from "@medusajs/framework/types"
import { isMockFail, isMockSuccess, makeMockId } from "../preview"

type InjectedDependencies = {
  logger: Logger
}

type WechatPayOptions = {
  apiBase?: string
  apiV3Key?: string
  appId?: string
  description?: string
  mchId?: string
  merchantSerialNo?: string
  notifyUrl?: string
  platformPublicKey?: string
  platformPublicKeyId?: string
  privateKey?: string
}

type WechatTransactionResponse = {
  prepay_id?: string
  appid?: string
  mchid?: string
  out_trade_no?: string
  transaction_id?: string
  trade_state?: string
  trade_state_desc?: string
  amount?: {
    total?: number
    payer_total?: number
    currency?: string
    payer_currency?: string
  }
  attach?: string
}

type WechatRefundResponse = {
  refund_id?: string
  out_refund_no?: string
  status?: string
}

type WechatNotifyBody = {
  event_type?: string
  resource?: {
    algorithm?: string
    associated_data?: string
    ciphertext?: string
    nonce?: string
  }
}

const WECHAT_PAY_API_BASE = "https://api.mch.weixin.qq.com"
const DEFAULT_DESCRIPTION = "Tree for Ambition order"
const PROVIDER_STATUS = {
  AUTHORIZED: "authorized" as const,
  CANCELED: "canceled" as const,
  CAPTURED: "captured" as const,
  ERROR: "error" as const,
  PENDING: "pending" as const,
}

const log = (entry: Record<string, unknown>) => {
  console.log(JSON.stringify({ ts: new Date().toISOString(), ...entry }))
}

const readString = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim() : undefined

const normalizePem = (value?: string) => {
  const normalized = value?.trim().replace(/\\n/g, "\n")
  if (!normalized) {
    return ""
  }

  if (normalized.includes("-----BEGIN")) {
    return normalized
  }

  try {
    return Buffer.from(normalized, "base64").toString("utf8").replace(/\\n/g, "\n")
  } catch {
    return normalized
  }
}

const toNumberAmount = (amount: unknown): number => {
  if (typeof amount === "number") {
    return amount
  }

  if (typeof amount === "string") {
    return Number(amount)
  }

  if (amount && typeof amount === "object") {
    const record = amount as Record<string, unknown>
    if (typeof record.numeric === "number") {
      return record.numeric
    }
    if (typeof record.value === "number") {
      return record.value
    }
    if (typeof record.value === "string") {
      return Number(record.value)
    }
    if (typeof (amount as { valueOf?: () => unknown }).valueOf === "function") {
      return Number((amount as { valueOf: () => unknown }).valueOf())
    }
  }

  return Number.NaN
}

const toWechatFen = (amount: unknown) => {
  const numeric = toNumberAmount(amount)
  if (!Number.isFinite(numeric)) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Invalid WeChat payment amount")
  }

  return Math.round(numeric * 100)
}

const fromWechatFen = (amount: number) => Number((amount / 100).toFixed(2))

const safeJsonParse = (value: string | Buffer | Record<string, unknown> | undefined) => {
  if (!value) {
    return {}
  }

  if (Buffer.isBuffer(value)) {
    return JSON.parse(value.toString("utf8"))
  }

  if (typeof value === "string") {
    return JSON.parse(value)
  }

  return value
}

const buildOutTradeNo = (sessionId: string) => {
  const ulid = sessionId.replace(/^payses_/, "")
  const outTradeNo = `ps_${ulid}`

  if (outTradeNo.length <= 32) {
    return outTradeNo
  }

  return `ps_${crypto.createHash("sha256").update(sessionId).digest("hex").slice(0, 29)}`
}

const sessionIdFromOutTradeNo = (outTradeNo?: string) => {
  if (!outTradeNo) {
    return undefined
  }

  if (outTradeNo.startsWith("ps_") && outTradeNo.length <= 32) {
    return `payses_${outTradeNo.slice(3)}`
  }

  return undefined
}

const buildAttach = (sessionId: string, amountFen: number) =>
  `session_id=${sessionId};amount=${amountFen}`

const parseAttach = (attach?: string) => {
  const result: Record<string, string> = {}
  attach?.split(";").forEach((part) => {
    const [key, value] = part.split("=")
    if (key && value) {
      result[key] = value
    }
  })

  return result
}

class WechatPayProvider extends AbstractPaymentProvider<WechatPayOptions> {
  static identifier = "wechat_jsapi"
  protected logger_: Logger
  protected options_: Required<WechatPayOptions>

  constructor(container: InjectedDependencies, options: WechatPayOptions = {}) {
    super(container, options)
    this.logger_ = container.logger
    this.options_ = {
      apiBase: options.apiBase || WECHAT_PAY_API_BASE,
      apiV3Key: options.apiV3Key || "",
      appId: options.appId || "",
      description: options.description || DEFAULT_DESCRIPTION,
      mchId: options.mchId || "",
      merchantSerialNo: options.merchantSerialNo || "",
      notifyUrl: options.notifyUrl || "",
      platformPublicKey: normalizePem(options.platformPublicKey),
      platformPublicKeyId: options.platformPublicKeyId || "",
      privateKey: normalizePem(options.privateKey),
    }
  }

  async initiatePayment(input: InitiatePaymentInput): Promise<InitiatePaymentOutput> {
    const t0 = Date.now()
    const sessionId = readString(input.data?.session_id)
    const openid = this.readOpenId(input.data)
    const amountFen = toWechatFen(input.amount)

    log({
      level: "info",
      module: "provider-wechatPayment",
      operation: "initiatePayment",
      amount: input.amount,
      amountFen,
      currencyCode: input.currency_code,
      sessionId,
    })

    if (this.shouldUseMock()) {
      return this.initiateMockPayment(t0)
    }

    this.assertConfigured()

    if (!sessionId) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "Missing Medusa payment session id")
    }

    if (!openid) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Missing WeChat openid for JSAPI payment"
      )
    }

    if (amountFen <= 0) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "WeChat payment amount must be greater than zero")
    }

    const outTradeNo = buildOutTradeNo(sessionId)
    const attach = buildAttach(sessionId, amountFen)
    const response = await this.wechatRequest<{ prepay_id: string }>("POST", "/v3/pay/transactions/jsapi", {
      appid: this.options_.appId,
      mchid: this.options_.mchId,
      description: this.options_.description,
      out_trade_no: outTradeNo,
      notify_url: this.options_.notifyUrl,
      attach,
      amount: {
        total: amountFen,
        currency: input.currency_code.toUpperCase(),
      },
      payer: {
        openid,
      },
    })

    if (!response.prepay_id) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "WeChat Pay did not return prepay_id")
    }

    const jsapiParams = this.buildJsapiParams(response.prepay_id)

    log({
      level: "info",
      module: "provider-wechatPayment",
      operation: "initiatePayment",
      duration: Date.now() - t0,
      outTradeNo,
      status: "success",
    })

    return {
      id: outTradeNo,
      status: PROVIDER_STATUS.PENDING,
      data: {
        ...input.data,
        ...jsapiParams,
        amountFen,
        attach,
        outTradeNo,
        payerOpenid: openid,
        prepayId: response.prepay_id,
        tradeState: "NOTPAY",
      },
    }
  }

  async authorizePayment(input: AuthorizePaymentInput): Promise<AuthorizePaymentOutput> {
    const t0 = Date.now()
    log({ level: "info", module: "provider-wechatPayment", operation: "authorizePayment" })

    if (isMockSuccess()) {
      return {
        status: PROVIDER_STATUS.CAPTURED,
        data: { ...(input.data ?? {}), tradeState: "SUCCESS", transactionId: `txn_mock_${makeMockId()}` },
      }
    }

    const transaction = await this.retrieveWechatTransaction(input.data)
    const status = this.paymentSessionStatusFromTradeState(transaction.trade_state)

    log({
      level: "info",
      module: "provider-wechatPayment",
      operation: "authorizePayment",
      duration: Date.now() - t0,
      status,
      tradeState: transaction.trade_state,
    })

    return {
      status,
      data: this.mergeTransactionData(input.data, transaction),
    }
  }

  async capturePayment(input: CapturePaymentInput): Promise<CapturePaymentOutput> {
    const transaction = await this.retrieveWechatTransaction(input.data)

    if (transaction.trade_state !== "SUCCESS") {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        `WeChat payment cannot be captured while trade_state is ${transaction.trade_state || "unknown"}`
      )
    }

    return {
      data: {
        ...this.mergeTransactionData(input.data, transaction),
        captured: true,
      },
    }
  }

  async cancelPayment(input: CancelPaymentInput): Promise<CancelPaymentOutput> {
    const outTradeNo = readString(input.data?.outTradeNo)
    if (!outTradeNo || this.shouldUseMock()) {
      return { data: { ...(input.data ?? {}), tradeState: "CLOSED" } }
    }

    await this.closeWechatTransaction(outTradeNo)

    return {
      data: {
        ...(input.data ?? {}),
        tradeState: "CLOSED",
      },
    }
  }

  async refundPayment(input: RefundPaymentInput): Promise<RefundPaymentOutput> {
    if (this.shouldUseMock()) {
      return {
        data: { ...(input.data ?? {}), refunded: true, refundId: `ref_mock_${makeMockId()}` },
      }
    }

    this.assertConfigured()
    const outTradeNo = readString(input.data?.outTradeNo)
    const amountFen = toWechatFen(input.amount)
    const totalFen = Number(input.data?.amountFen)

    if (!outTradeNo) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "Missing WeChat out_trade_no for refund")
    }

    if (!Number.isFinite(totalFen) || totalFen <= 0) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "Missing original WeChat payment amount for refund")
    }

    const outRefundNo = `rf_${crypto
      .createHash("sha256")
      .update(`${outTradeNo}:${amountFen}`)
      .digest("hex")
      .slice(0, 29)}`
    const refund = await this.wechatRequest<WechatRefundResponse>("POST", "/v3/refund/domestic/refunds", {
      out_trade_no: outTradeNo,
      out_refund_no: outRefundNo,
      amount: {
        refund: amountFen,
        total: totalFen,
        currency: "CNY",
      },
    })

    return {
      data: {
        ...(input.data ?? {}),
        refundId: refund.refund_id,
        refundStatus: refund.status,
        refunded: true,
      },
    }
  }

  async retrievePayment(input: RetrievePaymentInput): Promise<RetrievePaymentOutput> {
    if (this.shouldUseMock()) {
      return {
        data: {
          ...(input.data ?? {}),
          tradeState: isMockSuccess() ? "SUCCESS" : "NOTPAY",
          transactionId: isMockSuccess() ? `txn_mock_${makeMockId()}` : undefined,
        },
      }
    }

    const transaction = await this.retrieveWechatTransaction(input.data)
    return {
      data: this.mergeTransactionData(input.data, transaction),
    }
  }

  async updatePayment(input: UpdatePaymentInput): Promise<UpdatePaymentOutput> {
    const existingAmountFen = Number(input.data?.amountFen)
    const nextAmountFen = toWechatFen(input.amount)

    if (Number.isFinite(existingAmountFen) && existingAmountFen === nextAmountFen) {
      return {
        status: PROVIDER_STATUS.PENDING,
        data: input.data ?? {},
      }
    }

    const initiated = await this.initiatePayment(input)

    return {
      status: initiated.status,
      data: initiated.data,
    }
  }

  async deletePayment(input: DeletePaymentInput): Promise<DeletePaymentOutput> {
    await this.cancelPayment(input)
    return { data: input.data ?? {} }
  }

  async getPaymentStatus(input: GetPaymentStatusInput): Promise<GetPaymentStatusOutput> {
    if (isMockSuccess()) {
      return { status: PROVIDER_STATUS.CAPTURED, data: { ...(input.data ?? {}), tradeState: "SUCCESS" } }
    }

    if (isMockFail()) {
      return { status: PROVIDER_STATUS.CANCELED, data: { ...(input.data ?? {}), tradeState: "PAYERROR" } }
    }

    const transaction = await this.retrieveWechatTransaction(input.data)

    return {
      status: this.paymentSessionStatusFromTradeState(transaction.trade_state),
      data: this.mergeTransactionData(input.data, transaction),
    }
  }

  async getWebhookActionAndData(
    payload: ProviderWebhookPayload["payload"]
  ): Promise<WebhookActionResult> {
    const t0 = Date.now()

    if (this.shouldUseMock()) {
      return {
        action: "captured",
        data: {
          session_id: readString(payload.data?.session_id) || "",
          amount: Number(payload.data?.amount) || 0,
        },
      }
    }

    this.assertConfigured()
    this.verifyWebhookSignature(payload)

    const body = safeJsonParse(payload.rawData) as WechatNotifyBody
    if (body.event_type !== "TRANSACTION.SUCCESS" || !body.resource) {
      return { action: "not_supported" }
    }

    const transaction = this.decryptNotificationResource(body.resource)
    const outTradeNo = readString(transaction.out_trade_no)
    const attach = parseAttach(readString(transaction.attach))
    const sessionId = attach.session_id || sessionIdFromOutTradeNo(outTradeNo)
    const paidFen = transaction.amount?.payer_total ?? transaction.amount?.total

    if (!sessionId) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Could not resolve Medusa payment session from WeChat out_trade_no ${outTradeNo || "(missing)"}`
      )
    }

    if (attach.amount && Number(attach.amount) !== paidFen) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "WeChat payment notification amount does not match payment session amount"
      )
    }

    if (transaction.appid !== this.options_.appId || transaction.mchid !== this.options_.mchId) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "WeChat payment notification merchant/app mismatch"
      )
    }

    if (transaction.trade_state !== "SUCCESS" || typeof paidFen !== "number") {
      return { action: "not_supported" }
    }

    log({
      level: "info",
      module: "provider-wechatPayment",
      operation: "getWebhookActionAndData",
      action: "captured",
      duration: Date.now() - t0,
      outTradeNo,
      sessionId,
      transactionId: transaction.transaction_id,
    })

    return {
      action: "captured",
      data: {
        session_id: sessionId,
        amount: fromWechatFen(paidFen),
      },
    }
  }

  private initiateMockPayment(t0: number): InitiatePaymentOutput {
    if (isMockFail()) {
      log({
        level: "warn",
        module: "provider-wechatPayment",
        operation: "initiatePayment",
        duration: Date.now() - t0,
        status: "mock_fail",
      })
      return { id: makeMockId(), status: PROVIDER_STATUS.PENDING, data: { error: "mock_fail" } }
    }

    const prepayId = `prepay_mock_${makeMockId()}`
    const appId = this.options_.appId || "mock_app_id"

    return {
      id: prepayId,
      status: PROVIDER_STATUS.PENDING,
      data: {
        ...this.buildJsapiParams(prepayId, appId, "mock_sign"),
        prepayId,
        tradeState: "NOTPAY",
        tradeStateDesc: "订单未支付",
      },
    }
  }

  private shouldUseMock() {
    return isMockSuccess() || isMockFail()
  }

  private assertConfigured() {
    const missing = [
      ["WECHAT_PAY_APPID", this.options_.appId],
      ["WECHAT_PAY_MCHID", this.options_.mchId],
      ["WECHAT_PAY_API_V3_KEY", this.options_.apiV3Key],
      ["WECHAT_PAY_CERT_SERIAL_NO", this.options_.merchantSerialNo],
      ["WECHAT_PAY_NOTIFY_URL", this.options_.notifyUrl],
      ["WECHAT_PAY_PRIVATE_KEY", this.options_.privateKey],
    ].filter(([, value]) => !value)

    if (missing.length) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `WeChat Pay is not configured. Missing: ${missing.map(([key]) => key).join(", ")}`
      )
    }
  }

  private readOpenId(data?: Record<string, unknown>) {
    return (
      readString(data?.openid) ||
      readString(data?.openId) ||
      readString(data?.payerOpenid) ||
      readString(data?.wechatOpenId) ||
      readString(data?.wechat_open_id)
    )
  }

  private buildJsapiParams(prepayId: string, appId = this.options_.appId, forcedPaySign?: string) {
    const timeStamp = String(Math.floor(Date.now() / 1000))
    const nonceStr = crypto.randomBytes(16).toString("hex")
    const packageValue = `prepay_id=${prepayId}`
    const paySign =
      forcedPaySign ||
      this.signWithMerchantPrivateKey(`${appId}\n${timeStamp}\n${nonceStr}\n${packageValue}\n`)

    return {
      appId,
      timeStamp,
      nonceStr,
      package: packageValue,
      packageValue,
      signType: "RSA",
      paySign,
    }
  }

  private signWithMerchantPrivateKey(message: string) {
    return crypto.sign("RSA-SHA256", Buffer.from(message), this.options_.privateKey).toString("base64")
  }

  private buildAuthorizationHeader(method: string, pathWithQuery: string, body: string) {
    const timestamp = String(Math.floor(Date.now() / 1000))
    const nonce = crypto.randomBytes(16).toString("hex")
    const signature = this.signWithMerchantPrivateKey(
      `${method}\n${pathWithQuery}\n${timestamp}\n${nonce}\n${body}\n`
    )

    return `WECHATPAY2-SHA256-RSA2048 mchid="${this.options_.mchId}",nonce_str="${nonce}",timestamp="${timestamp}",serial_no="${this.options_.merchantSerialNo}",signature="${signature}"`
  }

  private async wechatRequest<T>(method: string, pathWithQuery: string, body?: Record<string, unknown>): Promise<T> {
    const bodyText = body ? JSON.stringify(body) : ""
    const response = await fetch(`${this.options_.apiBase}${pathWithQuery}`, {
      method,
      headers: {
        Accept: "application/json",
        Authorization: this.buildAuthorizationHeader(method, pathWithQuery, bodyText),
        "Content-Type": "application/json",
        "User-Agent": "treeforambition-medusa-wechat-pay/1.0",
      },
      ...(bodyText ? { body: bodyText } : {}),
    })

    if (response.status === 204) {
      return {} as T
    }

    const text = await response.text()
    const data = text ? JSON.parse(text) : {}

    if (!response.ok) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        (data as { message?: string }).message || `WeChat Pay request failed with status ${response.status}`
      )
    }

    return data as T
  }

  private async retrieveWechatTransaction(data?: Record<string, unknown>) {
    if (this.shouldUseMock()) {
      return {
        out_trade_no: readString(data?.outTradeNo),
        trade_state: isMockSuccess() ? "SUCCESS" : "NOTPAY",
        transaction_id: isMockSuccess() ? `txn_mock_${makeMockId()}` : undefined,
      } as WechatTransactionResponse
    }

    this.assertConfigured()
    const outTradeNo = readString(data?.outTradeNo)

    if (!outTradeNo) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "Missing WeChat out_trade_no")
    }

    return await this.wechatRequest<WechatTransactionResponse>(
      "GET",
      `/v3/pay/transactions/out-trade-no/${encodeURIComponent(outTradeNo)}?mchid=${encodeURIComponent(this.options_.mchId)}`
    )
  }

  private async closeWechatTransaction(outTradeNo: string) {
    this.assertConfigured()
    await this.wechatRequest(
      "POST",
      `/v3/pay/transactions/out-trade-no/${encodeURIComponent(outTradeNo)}/close`,
      {
        mchid: this.options_.mchId,
      }
    )
  }

  private paymentSessionStatusFromTradeState(tradeState?: string) {
    switch (tradeState) {
      case "SUCCESS":
        return PROVIDER_STATUS.CAPTURED
      case "CLOSED":
      case "REVOKED":
      case "PAYERROR":
        return PROVIDER_STATUS.CANCELED
      case "NOTPAY":
      case "USERPAYING":
      case "ACCEPT":
      default:
        return PROVIDER_STATUS.PENDING
    }
  }

  private mergeTransactionData(
    data: Record<string, unknown> | undefined,
    transaction: WechatTransactionResponse
  ) {
    return {
      ...(data ?? {}),
      amountFen: transaction.amount?.total ?? data?.amountFen,
      outTradeNo: transaction.out_trade_no ?? data?.outTradeNo,
      tradeState: transaction.trade_state,
      tradeStateDesc: transaction.trade_state_desc,
      transactionId: transaction.transaction_id,
    }
  }

  private getHeader(headers: Record<string, unknown>, key: string) {
    const direct = headers[key] ?? headers[key.toLowerCase()]
    if (Array.isArray(direct)) {
      return readString(direct[0])
    }

    return readString(direct)
  }

  private verifyWebhookSignature(payload: ProviderWebhookPayload["payload"]) {
    const platformPublicKey = this.options_.platformPublicKey
    if (!platformPublicKey) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Missing WeChat Pay platform public key for webhook signature verification"
      )
    }

    const timestamp = this.getHeader(payload.headers, "wechatpay-timestamp")
    const nonce = this.getHeader(payload.headers, "wechatpay-nonce")
    const signature = this.getHeader(payload.headers, "wechatpay-signature")
    const serial = this.getHeader(payload.headers, "wechatpay-serial")
    const rawBody = Buffer.isBuffer(payload.rawData)
      ? payload.rawData.toString("utf8")
      : typeof payload.rawData === "string"
        ? payload.rawData
        : JSON.stringify(payload.data)

    if (!timestamp || !nonce || !signature) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "Missing WeChat Pay webhook signature headers")
    }

    if (this.options_.platformPublicKeyId && serial && serial !== this.options_.platformPublicKeyId) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "WeChat Pay webhook signature serial mismatch")
    }

    const verifier = crypto.createVerify("RSA-SHA256")
    verifier.update(`${timestamp}\n${nonce}\n${rawBody}\n`)
    verifier.end()

    if (!verifier.verify(platformPublicKey, signature, "base64")) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "Invalid WeChat Pay webhook signature")
    }
  }

  private decryptNotificationResource(resource: NonNullable<WechatNotifyBody["resource"]>) {
    if (resource.algorithm !== "AEAD_AES_256_GCM") {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "Unsupported WeChat Pay notification encryption algorithm")
    }

    if (!resource.ciphertext || !resource.nonce) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "Invalid WeChat Pay encrypted notification")
    }

    const encrypted = Buffer.from(resource.ciphertext, "base64")
    const authTag = encrypted.subarray(encrypted.length - 16)
    const ciphertext = encrypted.subarray(0, encrypted.length - 16)
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      Buffer.from(this.options_.apiV3Key, "utf8"),
      Buffer.from(resource.nonce, "utf8")
    )

    if (resource.associated_data) {
      decipher.setAAD(Buffer.from(resource.associated_data, "utf8"))
    }

    decipher.setAuthTag(authTag)

    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8")
    return JSON.parse(decrypted) as WechatTransactionResponse
  }
}

export default WechatPayProvider
