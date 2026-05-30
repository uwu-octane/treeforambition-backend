import { completeOrderWorkflow } from "@medusajs/core-flows"
import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  createStep,
  createWorkflow,
  StepResponse,
  transform,
  when,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"

export type CompleteOrderOnDeliveryWorkflowInput = {
  fulfillment_id: string
  event_name?: string
}

export type DeliveryCompletionEvaluation = {
  fulfillment_id: string
  order_id?: string
  should_complete: boolean
  reason?: string
}

type DeliveredOrderItem = {
  quantity?: unknown
  detail?: {
    delivered_quantity?: unknown
  } | null
}

type DeliveredOrder = {
  id: string
  status?: string
  canceled_at?: string | Date | null
  items?: DeliveredOrderItem[] | null
}

const toNumber = (value: unknown): number => {
  if (value === null || value === undefined) {
    return 0
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0
  }

  if (typeof value === "string") {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }

  if (typeof value === "object") {
    const candidate =
      "value" in value
        ? (value as { value?: unknown }).value
        : "numeric" in value
          ? (value as { numeric?: unknown }).numeric
          : undefined

    return toNumber(candidate)
  }

  return 0
}

export const isOrderFullyDelivered = (order: DeliveredOrder): boolean => {
  const items = order.items ?? []

  return (
    items.length > 0 &&
    items.every((item) => {
      const quantity = toNumber(item.quantity)
      const deliveredQuantity = toNumber(item.detail?.delivered_quantity)

      return quantity <= 0 || deliveredQuantity >= quantity
    })
  )
}

export const evaluateDeliveryCompletion = async (
  container: MedusaContainer,
  fulfillmentId: string
): Promise<DeliveryCompletionEvaluation> => {
  const link = container.resolve(ContainerRegistrationKeys.LINK)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const fulfillmentLinks = await link.list({
    fulfillment_id: fulfillmentId,
  } as any)

  const orderLink = (fulfillmentLinks as Array<Record<string, unknown>>).find(
    (linkEntry) => typeof linkEntry.order_id === "string"
  )

  const orderId = orderLink?.order_id as string | undefined

  if (!orderId) {
    return {
      fulfillment_id: fulfillmentId,
      should_complete: false,
      reason: "no_order_link",
    }
  }

  const { data: orders } = await query.graph({
    entity: "order",
    fields: [
      "id",
      "status",
      "canceled_at",
      "items.*",
      "items.detail.*",
    ],
    filters: { id: orderId },
  })

  const order = orders?.[0] as DeliveredOrder | undefined

  if (!order) {
    return {
      fulfillment_id: fulfillmentId,
      order_id: orderId,
      should_complete: false,
      reason: "order_not_found",
    }
  }

  if (order.status === "completed") {
    return {
      fulfillment_id: fulfillmentId,
      order_id: orderId,
      should_complete: false,
      reason: "already_completed",
    }
  }

  if (order.status === "canceled" || order.canceled_at) {
    return {
      fulfillment_id: fulfillmentId,
      order_id: orderId,
      should_complete: false,
      reason: "order_canceled",
    }
  }

  if (!isOrderFullyDelivered(order)) {
    return {
      fulfillment_id: fulfillmentId,
      order_id: orderId,
      should_complete: false,
      reason: "not_fully_delivered",
    }
  }

  return {
    fulfillment_id: fulfillmentId,
    order_id: orderId,
    should_complete: true,
  }
}

export const evaluateDeliveryCompletionStep = createStep(
  "evaluate-delivery-completion",
  async (input: CompleteOrderOnDeliveryWorkflowInput, { container }) => {
    const evaluation = await evaluateDeliveryCompletion(container, input.fulfillment_id)

    return new StepResponse(evaluation)
  }
)

export const completeOrderOnDeliveryWorkflow = createWorkflow(
  "complete-order-on-delivery",
  function (input: CompleteOrderOnDeliveryWorkflowInput) {
    const evaluation = evaluateDeliveryCompletionStep(input)

    when("should-complete-order-after-delivery", { evaluation }, ({ evaluation }) => {
      return evaluation.should_complete === true && typeof evaluation.order_id === "string"
    }).then(() => {
      const completeInput = transform({ input, evaluation }, (data) => {
        return {
          orderIds: data.evaluation.order_id ? [data.evaluation.order_id] : [],
          additional_data: {
            source: data.input.event_name || "delivery.created",
            fulfillment_id: data.input.fulfillment_id,
          },
        }
      })

      completeOrderWorkflow.runAsStep({
        input: completeInput,
      })
    })

    return new WorkflowResponse(evaluation)
  }
)

export default completeOrderOnDeliveryWorkflow
