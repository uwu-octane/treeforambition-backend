import { AbstractPaymentProvider } from "@medusajs/framework/utils"
import type {
  InitiatePaymentInput, InitiatePaymentOutput,
  AuthorizePaymentInput, AuthorizePaymentOutput,
  CapturePaymentInput, CapturePaymentOutput,
  CancelPaymentInput, CancelPaymentOutput,
  RefundPaymentInput, RefundPaymentOutput,
  RetrievePaymentInput, RetrievePaymentOutput,
  UpdatePaymentInput, UpdatePaymentOutput,
  DeletePaymentInput, DeletePaymentOutput,
  GetPaymentStatusInput, GetPaymentStatusOutput,
  ProviderWebhookPayload, WebhookActionResult,
  Logger,
} from "@medusajs/framework/types"
import { isMockSuccess, isMockFail, makeMockId } from "../preview"

type InjectedDependencies = {
  logger: Logger
}

const log = (entry: Record<string, unknown>) => {
  console.log(JSON.stringify({ ts: new Date().toISOString(), ...entry }))
}

class WechatPayProvider extends AbstractPaymentProvider {
  static identifier = "wechat_jsapi"
  protected logger_: Logger

  constructor(container: InjectedDependencies) {
    super(container)
    this.logger_ = container.logger
  }

  async initiatePayment(input: InitiatePaymentInput): Promise<InitiatePaymentOutput> {
    const t0 = Date.now()
    this.logger_.info("[WeChatPay] initiatePayment called (mock mode)")
    log({ level: "info", module: "wechatPayment", operation: "initiatePayment", currencyCode: input.currency_code, amount: input.amount })

    if (isMockFail()) {
      log({ level: "warn", module: "wechatPayment", operation: "initiatePayment", duration: Date.now() - t0, status: "mock_fail" })
      return { id: makeMockId(), status: "pending", data: { error: "mock_fail" } }
    }

    const prepayId = `prepay_mock_${makeMockId()}`
    const appId = process.env.WECHAT_SERVICE_APP_ID || "mock_app_id"

    log({ level: "info", module: "wechatPayment", operation: "initiatePayment", duration: Date.now() - t0, prepayId, status: "success" })

    return {
      id: prepayId,
      data: {
        prepayId,
        appId,
        timeStamp: String(Math.floor(Date.now() / 1000)),
        nonceStr: Math.random().toString(36).substring(2, 18),
        package: `prepay_id=${prepayId}`,
        signType: "RSA",
        paySign: "mock_sign",
        // Store these for retrieve/cancel
        tradeState: "NOTPAY",
        tradeStateDesc: "订单未支付",
      },
    }
  }

  async authorizePayment(input: AuthorizePaymentInput): Promise<AuthorizePaymentOutput> {
    const t0 = Date.now()
    this.logger_.info("[WeChatPay] authorizePayment called")
    log({ level: "info", module: "wechatPayment", operation: "authorizePayment" })
    const result = { status: "authorized" as const, data: input.data ?? {} }
    log({ level: "info", module: "wechatPayment", operation: "authorizePayment", duration: Date.now() - t0, status: result.status })
    return result
  }

  async capturePayment(input: CapturePaymentInput): Promise<CapturePaymentOutput> {
    const t0 = Date.now()
    this.logger_.info("[WeChatPay] capturePayment called")
    log({ level: "info", module: "wechatPayment", operation: "capturePayment" })
    const result = { data: { ...(input.data ?? {}), captured: true, transactionId: `txn_mock_${makeMockId()}` } }
    log({ level: "info", module: "wechatPayment", operation: "capturePayment", duration: Date.now() - t0, status: "success" })
    return result
  }

  async cancelPayment(input: CancelPaymentInput): Promise<CancelPaymentOutput> {
    const t0 = Date.now()
    this.logger_.info("[WeChatPay] cancelPayment called")
    log({ level: "info", module: "wechatPayment", operation: "cancelPayment" })
    const result = { data: { ...(input.data ?? {}), tradeState: "CLOSED" } }
    log({ level: "info", module: "wechatPayment", operation: "cancelPayment", duration: Date.now() - t0, status: "success" })
    return result
  }

  async refundPayment(input: RefundPaymentInput): Promise<RefundPaymentOutput> {
    const t0 = Date.now()
    this.logger_.info("[WeChatPay] refundPayment called")
    log({ level: "info", module: "wechatPayment", operation: "refundPayment" })
    const result = { data: { ...(input.data ?? {}), refunded: true, refundId: `ref_mock_${makeMockId()}` } }
    log({ level: "info", module: "wechatPayment", operation: "refundPayment", duration: Date.now() - t0, status: "success" })
    return result
  }

  async retrievePayment(input: RetrievePaymentInput): Promise<RetrievePaymentOutput> {
    const t0 = Date.now()
    log({ level: "info", module: "wechatPayment", operation: "retrievePayment" })
    if (isMockSuccess()) {
      log({ level: "info", module: "wechatPayment", operation: "retrievePayment", duration: Date.now() - t0, status: "mock_success" })
      return {
        data: {
          ...(input.data ?? {}),
          tradeState: "SUCCESS",
          tradeStateDesc: "支付成功",
          transactionId: (input.data as any)?.transactionId || `txn_mock_${makeMockId()}`,
        },
      }
    }
    log({ level: "info", module: "wechatPayment", operation: "retrievePayment", duration: Date.now() - t0, status: "pending" })
    return { data: input.data ?? {} }
  }

  async updatePayment(input: UpdatePaymentInput): Promise<UpdatePaymentOutput> {
    const t0 = Date.now()
    log({ level: "info", module: "wechatPayment", operation: "updatePayment" })
    const result = { data: input.data ?? {} }
    log({ level: "info", module: "wechatPayment", operation: "updatePayment", duration: Date.now() - t0, status: "success" })
    return result
  }

  async deletePayment(input: DeletePaymentInput): Promise<DeletePaymentOutput> {
    const t0 = Date.now()
    log({ level: "info", module: "wechatPayment", operation: "deletePayment" })
    const result = { data: input.data ?? {} }
    log({ level: "info", module: "wechatPayment", operation: "deletePayment", duration: Date.now() - t0, status: "success" })
    return result
  }

  async getPaymentStatus(input: GetPaymentStatusInput): Promise<GetPaymentStatusOutput> {
    const t0 = Date.now()
    log({ level: "info", module: "wechatPayment", operation: "getPaymentStatus" })
    if (isMockSuccess()) {
      log({ level: "info", module: "wechatPayment", operation: "getPaymentStatus", duration: Date.now() - t0, status: "captured" })
      return { status: "captured", data: { ...(input.data ?? {}), tradeState: "SUCCESS" } }
    }
    if (isMockFail()) {
      log({ level: "info", module: "wechatPayment", operation: "getPaymentStatus", duration: Date.now() - t0, status: "canceled" })
      return { status: "canceled", data: { ...(input.data ?? {}), tradeState: "PAYERROR" } }
    }
    log({ level: "info", module: "wechatPayment", operation: "getPaymentStatus", duration: Date.now() - t0, status: "pending" })
    return { status: "pending", data: input.data ?? {} }
  }

  async getWebhookActionAndData(
    payload: ProviderWebhookPayload["payload"]
  ): Promise<WebhookActionResult> {
    const t0 = Date.now()
    this.logger_.info("[WeChatPay] getWebhookActionAndData called")
    const data = payload.data as Record<string, unknown> | undefined
    log({ level: "info", module: "wechatPayment", operation: "getWebhookActionAndData" })

    if (isMockSuccess()) {
      log({ level: "info", module: "wechatPayment", operation: "getWebhookActionAndData", duration: Date.now() - t0, action: "authorized", status: "success" })
      return {
        action: "authorized",
        data: {
          session_id: (data?.session_id as string) || "",
          amount: (data?.amount as number) || 0,
        },
      }
    }

    log({ level: "info", module: "wechatPayment", operation: "getWebhookActionAndData", duration: Date.now() - t0, action: "not_supported" })
    return { action: "not_supported" }
  }
}

export default WechatPayProvider
