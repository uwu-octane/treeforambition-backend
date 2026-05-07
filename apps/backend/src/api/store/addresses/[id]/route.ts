import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"

export async function DELETE(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const customerId = req.auth_context.actor_id
  const { id } = req.params
  const customerService: any = req.scope.resolve("customer")
  const query = req.scope.resolve("query")
  const logger = req.scope.resolve("logger")

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
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      "Address not found"
    )
  }

  await customerService.deleteAddresses(id)

  logger.info(`Address deleted: customer=${customerId}, addressId=${id}`)

  return res.json({ success: true })
}
