import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { updateOrderWorkflow } from "@medusajs/medusa/core-flows"

const log = (entry: Record<string, unknown>) => {
  console.log(JSON.stringify({ ts: new Date().toISOString(), ...entry }))
}

export async function PATCH(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const t0 = Date.now()
  const customerId = req.auth_context.actor_id
  const orderId = req.params.id
  const query = req.scope.resolve("query")

  log({ level: "info", module: "backend-store-orders-address", operation: "patchAddress", phase: "start", customerId, orderId })

  try {
    const { data: orders } = await query.graph({
      entity: "order",
      fields: ["id", "customer_id", "status", "shipping_address.*"],
      filters: { id: orderId },
    })

    if (!orders?.length) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "Order not found")
    }

    const order = orders[0]

    if (order.customer_id !== customerId) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "Order not found")
    }

    // Map camelCase (frontend) to snake_case (Medusa workflow)
    const input = req.body as Record<string, any> | undefined
    const addr = input?.address ?? input

    if (!addr || typeof addr !== "object") {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "address is required")
    }

    const shipping_address: Record<string, any> = {
      first_name: (addr as any).recipientName ?? addr.first_name ?? "",
      phone: addr.phone ?? "",
      province: addr.province ?? "",
      city: addr.city ?? "",
      address_1: addr.addressLine1 ?? addr.address_1 ?? "",
      address_2: addr.addressLine2 ?? addr.address_2 ?? "",
      postal_code: addr.postalCode ?? addr.postal_code ?? "",
      country_code: order.shipping_address?.country_code ?? "CN",
    }

    if ((addr as any).district) {
      shipping_address.metadata = { district: (addr as any).district }
    }

    await updateOrderWorkflow(req.scope).run({
      input: {
        id: orderId,
        user_id: customerId,
        shipping_address,
      },
    })

    // Re-fetch to return updated data
    const { data: updated } = await query.graph({
      entity: "order",
      fields: ["shipping_address.*"],
      filters: { id: orderId },
    })

    const updatedAddr = updated?.[0]?.shipping_address

    log({ level: "info", module: "backend-store-orders-address", operation: "patchAddress", phase: "response", duration: Date.now() - t0, customerId, orderId })

    return res.json({
      success: true,
      message: "收货地址已更新。",
      shippingAddress: updatedAddr,
      destination: updatedAddr
        ? [
            updatedAddr.province,
            updatedAddr.city,
            updatedAddr.metadata?.district,
            updatedAddr.address_1,
          ]
            .filter(Boolean)
            .join(" ")
        : "",
    })
  } catch (error) {
    console.error(JSON.stringify({
      ts: new Date().toISOString(),
      module: "backend-store-orders-address",
      operation: "patchAddress",
      phase: "error",
      duration: Date.now() - t0,
      customerId,
      orderId,
      message: error instanceof Error ? error.message : String(error),
    }))
    throw error
  }
}
