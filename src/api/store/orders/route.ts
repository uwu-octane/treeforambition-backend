import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"

const log = (entry: Record<string, unknown>) => {
  console.log(JSON.stringify({ ts: new Date().toISOString(), ...entry }))
}

export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const t0 = Date.now()
  const customerId = req.auth_context.actor_id
  const query = req.scope.resolve("query")
  const logger = req.scope.resolve("logger")

  log({ level: "info", module: "backend-store-orders", operation: "listOrders", phase: "start", customerId })

  try {
    const { data: orders, metadata } = await query.graph({
      entity: "order",
      fields: [
        "id",
        "display_id",
        "status",
        "payment_status",
        "fulfillment_status",
        "customer_id",
        "total",
        "subtotal",
        "tax_total",
        "shipping_total",
        "discount_total",
        "currency_code",
        "email",
        "created_at",
        "updated_at",
        "items.*",
        "shipping_address.*",
        "billing_address.*",
        "shipping_methods.*",
        "fulfillments.*",
      ],
      filters: {
        customer_id: customerId,
      },
    })

    logger.info(`Orders retrieved for customer: ${customerId}, count: ${orders.length}`)
    log({ level: "info", module: "backend-store-orders", operation: "listOrders", phase: "response", duration: Date.now() - t0, customerId, orderCount: orders.length })

    return res.json({
      orders,
      count: metadata?.count ?? orders.length,
    })
  } catch (error) {
    console.error(JSON.stringify({
      ts: new Date().toISOString(),
      module: "backend-store-orders",
      operation: "listOrders",
      phase: "error",
      duration: Date.now() - t0,
      customerId,
      message: error instanceof Error ? error.message : String(error),
    }))
    throw error;
  }
}
