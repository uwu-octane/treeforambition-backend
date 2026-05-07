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

class WechatPayProvider extends AbstractPaymentProvider {
  static identifier = "wechat_jsapi"
  protected logger_: Logger

  constructor(container: InjectedDependencies) {
    super(container)
    this.logger_ = container.logger
  }

  async initiatePayment(input: InitiatePaymentInput): Promise<InitiatePaymentOutput> {
    this.logger_.info("[WeChatPay] initiatePayment called (mock mode)")

    if (isMockFail()) {
      return { id: makeMockId(), status: "pending", data: { error: "mock_fail" } }
    }

    const prepayId = `prepay_mock_${makeMockId()}`
    const appId = process.env.WECHAT_SERVICE_APP_ID || "mock_app_id"

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
    this.logger_.info("[WeChatPay] authorizePayment called")
    return { status: "authorized", data: input.data ?? {} }
  }

  async capturePayment(input: CapturePaymentInput): Promise<CapturePaymentOutput> {
    this.logger_.info("[WeChatPay] capturePayment called")
    return { data: { ...(input.data ?? {}), captured: true, transactionId: `txn_mock_${makeMockId()}` } }
  }

  async cancelPayment(input: CancelPaymentInput): Promise<CancelPaymentOutput> {
    this.logger_.info("[WeChatPay] cancelPayment called")
    return { data: { ...(input.data ?? {}), tradeState: "CLOSED" } }
  }

  async refundPayment(input: RefundPaymentInput): Promise<RefundPaymentOutput> {
    this.logger_.info("[WeChatPay] refundPayment called")
    return { data: { ...(input.data ?? {}), refunded: true, refundId: `ref_mock_${makeMockId()}` } }
  }

  async retrievePayment(input: RetrievePaymentInput): Promise<RetrievePaymentOutput> {
    if (isMockSuccess()) {
      return {
        data: {
          ...(input.data ?? {}),
          tradeState: "SUCCESS",
          tradeStateDesc: "支付成功",
          transactionId: (input.data as any)?.transactionId || `txn_mock_${makeMockId()}`,
        },
      }
    }
    return { data: input.data ?? {} }
  }

  async updatePayment(input: UpdatePaymentInput): Promise<UpdatePaymentOutput> {
    return { data: input.data ?? {} }
  }

  async deletePayment(input: DeletePaymentInput): Promise<DeletePaymentOutput> {
    return { data: input.data ?? {} }
  }

  async getPaymentStatus(input: GetPaymentStatusInput): Promise<GetPaymentStatusOutput> {
    if (isMockSuccess()) {
      return { status: "captured", data: { ...(input.data ?? {}), tradeState: "SUCCESS" } }
    }
    if (isMockFail()) {
      return { status: "canceled", data: { ...(input.data ?? {}), tradeState: "PAYERROR" } }
    }
    return { status: "pending", data: input.data ?? {} }
  }

  async getWebhookActionAndData(
    payload: ProviderWebhookPayload["payload"]
  ): Promise<WebhookActionResult> {
    this.logger_.info("[WeChatPay] getWebhookActionAndData called")
    const data = payload.data as Record<string, unknown> | undefined

    if (isMockSuccess()) {
      return {
        action: "authorized",
        data: {
          session_id: (data?.session_id as string) || "",
          amount: (data?.amount as number) || 0,
        },
      }
    }

    return { action: "not_supported" }
  }
}

export default WechatPayProvider
