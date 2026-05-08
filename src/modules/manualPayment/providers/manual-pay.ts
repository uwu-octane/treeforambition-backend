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

const log = (entry: Record<string, unknown>) => {
  console.log(JSON.stringify({ ts: new Date().toISOString(), ...entry }))
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
    const t0 = Date.now()
    this.logger_.info("[ManualPay] initiatePayment called")
    log({ level: "info", module: "manualPayment", operation: "initiatePayment", currencyCode: input.currency_code, amount: input.amount })
    const result = {
      id: makeManualId(),
      data: {
        providerMessage: "Manual payment initiated - awaiting admin confirmation",
        initiatedAt: new Date().toISOString(),
      },
    }
    log({ level: "info", module: "manualPayment", operation: "initiatePayment", duration: Date.now() - t0, paymentId: result.id, status: "success" })
    return result
  }

  async authorizePayment(input: AuthorizePaymentInput): Promise<AuthorizePaymentOutput> {
    const t0 = Date.now()
    const isMockSuccess = process.env.PREVIEW_PAYMENT_MODE === "mock_success"
    this.logger_.info("[ManualPay] authorizePayment called")
    log({ level: "info", module: "manualPayment", operation: "authorizePayment", isMockSuccess })
    const result = {
      status: isMockSuccess ? "authorized" : "pending",
      data: input.data ?? {},
    }
    log({ level: "info", module: "manualPayment", operation: "authorizePayment", duration: Date.now() - t0, status: result.status })
    return result
  }

  async capturePayment(input: CapturePaymentInput): Promise<CapturePaymentOutput> {
    const t0 = Date.now()
    this.logger_.info("[ManualPay] capturePayment called")
    log({ level: "info", module: "manualPayment", operation: "capturePayment" })
    const result = {
      data: {
        ...(input.data ?? {}),
        captured: true,
        confirmedAt: new Date().toISOString(),
      },
    }
    log({ level: "info", module: "manualPayment", operation: "capturePayment", duration: Date.now() - t0, status: "success" })
    return result
  }

  async cancelPayment(input: CancelPaymentInput): Promise<CancelPaymentOutput> {
    const t0 = Date.now()
    this.logger_.info("[ManualPay] cancelPayment called")
    log({ level: "info", module: "manualPayment", operation: "cancelPayment" })
    const result = { data: input.data ?? {} }
    log({ level: "info", module: "manualPayment", operation: "cancelPayment", duration: Date.now() - t0, status: "success" })
    return result
  }

  async refundPayment(input: RefundPaymentInput): Promise<RefundPaymentOutput> {
    const t0 = Date.now()
    this.logger_.info("[ManualPay] refundPayment called")
    log({ level: "info", module: "manualPayment", operation: "refundPayment" })
    const result = { data: { ...(input.data ?? {}), refunded: true } }
    log({ level: "info", module: "manualPayment", operation: "refundPayment", duration: Date.now() - t0, status: "success" })
    return result
  }

  async retrievePayment(input: RetrievePaymentInput): Promise<RetrievePaymentOutput> {
    const t0 = Date.now()
    log({ level: "info", module: "manualPayment", operation: "retrievePayment" })
    const result = { data: input.data ?? {} }
    log({ level: "info", module: "manualPayment", operation: "retrievePayment", duration: Date.now() - t0, status: "success" })
    return result
  }

  async updatePayment(input: UpdatePaymentInput): Promise<UpdatePaymentOutput> {
    const t0 = Date.now()
    log({ level: "info", module: "manualPayment", operation: "updatePayment" })
    const result = { data: input.data ?? {} }
    log({ level: "info", module: "manualPayment", operation: "updatePayment", duration: Date.now() - t0, status: "success" })
    return result
  }

  async deletePayment(input: DeletePaymentInput): Promise<DeletePaymentOutput> {
    const t0 = Date.now()
    log({ level: "info", module: "manualPayment", operation: "deletePayment" })
    const result = { data: input.data ?? {} }
    log({ level: "info", module: "manualPayment", operation: "deletePayment", duration: Date.now() - t0, status: "success" })
    return result
  }

  async getPaymentStatus(input: GetPaymentStatusInput): Promise<GetPaymentStatusOutput> {
    const t0 = Date.now()
    const isMockSuccess = process.env.PREVIEW_PAYMENT_MODE === "mock_success"
    log({ level: "info", module: "manualPayment", operation: "getPaymentStatus", isMockSuccess })
    if (isMockSuccess) {
      log({ level: "info", module: "manualPayment", operation: "getPaymentStatus", duration: Date.now() - t0, status: "captured" })
      return { status: "captured", data: input.data ?? {} }
    }
    log({ level: "info", module: "manualPayment", operation: "getPaymentStatus", duration: Date.now() - t0, status: "pending" })
    return { status: "pending", data: input.data ?? {} }
  }

  async getWebhookActionAndData(
    _payload: ProviderWebhookPayload["payload"]
  ): Promise<WebhookActionResult> {
    log({ level: "info", module: "manualPayment", operation: "getWebhookActionAndData", action: "not_supported" })
    return { action: "not_supported" }
  }
}

export default ManualPayProvider
