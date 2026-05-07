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

type InjectedDependencies = {
  logger: Logger
}

function makeManualId(): string {
  return `manual_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`
}

class ManualPayProvider extends AbstractPaymentProvider {
  static identifier = "manual"
  protected logger_: Logger

  constructor(container: InjectedDependencies) {
    super(container)
    this.logger_ = container.logger
  }

  async initiatePayment(input: InitiatePaymentInput): Promise<InitiatePaymentOutput> {
    this.logger_.info("[ManualPay] initiatePayment called")
    return {
      id: makeManualId(),
      data: {
        providerMessage: "Manual payment initiated - awaiting admin confirmation",
        initiatedAt: new Date().toISOString(),
      },
    }
  }

  async authorizePayment(input: AuthorizePaymentInput): Promise<AuthorizePaymentOutput> {
    const isMockSuccess = process.env.PREVIEW_PAYMENT_MODE === "mock_success"
    this.logger_.info("[ManualPay] authorizePayment called")
    return {
      status: isMockSuccess ? "authorized" : "pending",
      data: input.data ?? {},
    }
  }

  async capturePayment(input: CapturePaymentInput): Promise<CapturePaymentOutput> {
    this.logger_.info("[ManualPay] capturePayment called")
    return {
      data: {
        ...(input.data ?? {}),
        captured: true,
        confirmedAt: new Date().toISOString(),
      },
    }
  }

  async cancelPayment(input: CancelPaymentInput): Promise<CancelPaymentOutput> {
    this.logger_.info("[ManualPay] cancelPayment called")
    return { data: input.data ?? {} }
  }

  async refundPayment(input: RefundPaymentInput): Promise<RefundPaymentOutput> {
    this.logger_.info("[ManualPay] refundPayment called")
    return { data: { ...(input.data ?? {}), refunded: true } }
  }

  async retrievePayment(input: RetrievePaymentInput): Promise<RetrievePaymentOutput> {
    return { data: input.data ?? {} }
  }

  async updatePayment(input: UpdatePaymentInput): Promise<UpdatePaymentOutput> {
    return { data: input.data ?? {} }
  }

  async deletePayment(input: DeletePaymentInput): Promise<DeletePaymentOutput> {
    return { data: input.data ?? {} }
  }

  async getPaymentStatus(input: GetPaymentStatusInput): Promise<GetPaymentStatusOutput> {
    const isMockSuccess = process.env.PREVIEW_PAYMENT_MODE === "mock_success"
    if (isMockSuccess) {
      return { status: "captured", data: input.data ?? {} }
    }
    return { status: "pending", data: input.data ?? {} }
  }

  async getWebhookActionAndData(
    _payload: ProviderWebhookPayload["payload"]
  ): Promise<WebhookActionResult> {
    return { action: "not_supported" }
  }
}

export default ManualPayProvider
