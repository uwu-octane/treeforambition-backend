import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"

const log = (entry: Record<string, unknown>) => {
  console.log(JSON.stringify({ ts: new Date().toISOString(), ...entry }))
}

export async function DELETE(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const t0 = Date.now()
  const customerId = req.auth_context.actor_id
  const { id } = req.params
  const customerService: any = req.scope.resolve("customer")
  const query = req.scope.resolve("query")
  const logger = req.scope.resolve("logger")

  log({ level: "info", module: "backend-store-addresses", operation: "deleteAddress", phase: "start", customerId, addressId: id })

  try {
    // Verify address belongs to current customer
    const { data: addresses } = await query.graph({
      entity: "address",
      fields: ["id"],
      filters: {
        id,
        customer_id: customerId,
      },
    })

    if (!addresses || addresses.length === 0) {
      log({ level: "warn", module: "backend-store-addresses", operation: "deleteAddress", phase: "error", duration: Date.now() - t0, customerId, addressId: id })
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        "Address not found"
      )
    }

    await customerService.deleteAddresses(id)

    logger.info(`Address deleted: customer=${customerId}, addressId=${id}`)
    log({ level: "info", module: "backend-store-addresses", operation: "deleteAddress", phase: "response", duration: Date.now() - t0, customerId, addressId: id })

    return res.json({ success: true })
  } catch (error) {
    console.error(JSON.stringify({
      ts: new Date().toISOString(),
      module: "backend-store-addresses",
      operation: "deleteAddress",
      phase: "error",
      duration: Date.now() - t0,
      customerId,
      addressId: id,
      message: error instanceof Error ? error.message : String(error),
    }))
    throw error;
  }
}
