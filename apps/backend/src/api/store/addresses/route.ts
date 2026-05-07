import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { CreateAddressSchemaType } from "./middlewares"

export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const customerId = req.auth_context.actor_id
  const query = req.scope.resolve("query")

  const { data: addresses } = await query.graph({
    entity: "address",
    fields: [
      "id",
      "first_name",
      "last_name",
      "phone",
      "company",
      "address_1",
      "address_2",
      "city",
      "country_code",
      "province",
      "postal_code",
      "metadata",
      "created_at",
      "updated_at",
    ],
    filters: {
      customer_id: customerId,
    },
  })

  return res.json({ addresses })
}

export async function POST(
  req: AuthenticatedMedusaRequest<CreateAddressSchemaType>,
  res: MedusaResponse
) {
  const customerId = req.auth_context.actor_id
  const customerService: any = req.scope.resolve("customer")
  const logger = req.scope.resolve("logger")

  const addressData = {
    ...req.validatedBody,
    customer_id: customerId,
  }

  const [address] = await customerService.createAddresses(addressData)

  logger.info(`Address created for customer: ${customerId}, addressId: ${address?.id}`)

  return res.json({ address })
}
