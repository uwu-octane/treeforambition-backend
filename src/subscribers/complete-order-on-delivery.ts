import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import type { Logger } from "@medusajs/framework/types"
import completeOrderOnDeliveryWorkflow from "../workflows/complete-order-on-delivery"

type DeliveryCreatedEvent = {
  id: string
  no_notification?: boolean
}

export default async function completeOrderOnDeliveryHandler({
  event: { name, data },
  container,
}: SubscriberArgs<DeliveryCreatedEvent>) {
  const logger: Logger = container.resolve("logger")
  const fulfillmentId = data.id

  try {
    const { result } = await completeOrderOnDeliveryWorkflow(container).run({
      input: {
        fulfillment_id: fulfillmentId,
        event_name: name,
      },
    })

    if (result.should_complete) {
      logger.info(
        `[OrderCompletion] Order ${result.order_id} completed after fulfillment ${fulfillmentId} delivery`
      )
      return
    }

    logger.info(
      `[OrderCompletion] Fulfillment ${fulfillmentId} did not complete an order: ${result.reason}`
    )
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    logger.error(`[OrderCompletion] Failed after fulfillment ${fulfillmentId} delivery: ${msg}`)
    throw error
  }
}

export const config: SubscriberConfig = {
  event: "delivery.created",
}
