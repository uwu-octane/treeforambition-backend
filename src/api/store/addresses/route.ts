import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { CreateAddressSchemaType } from "./middlewares"

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

  log({ level: "info", module: "backend-store-addresses", operation: "listAddresses", phase: "start", customerId })

  try {
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

    log({ level: "info", module: "backend-store-addresses", operation: "listAddresses", phase: "response", duration: Date.now() - t0, customerId, addressCount: addresses.length })

    return res.json({ addresses })
  } catch (error) {
    console.error(JSON.stringify({
      ts: new Date().toISOString(),
      module: "backend-store-addresses",
      operation: "listAddresses",
      phase: "error",
      duration: Date.now() - t0,
      customerId,
      message: error instanceof Error ? error.message : String(error),
    }))
    throw error;
  }
}

export async function POST(
  req: AuthenticatedMedusaRequest<CreateAddressSchemaType>,
  res: MedusaResponse
) {
  const t0 = Date.now()
  const customerId = req.auth_context.actor_id
  const customerService: any = req.scope.resolve("customer")
  const logger = req.scope.resolve("logger")

  const addressData = {
    ...req.validatedBody,
    customer_id: customerId,
  }

  log({ level: "info", module: "backend-store-addresses", operation: "createAddress", phase: "start", customerId, fieldCount: Object.keys(addressData).length })

  try {
    const [address] = await customerService.createAddresses(addressData)

    logger.info(`Address created for customer: ${customerId}, addressId: ${address?.id}`)
    log({ level: "info", module: "backend-store-addresses", operation: "createAddress", phase: "response", duration: Date.now() - t0, customerId, addressId: address?.id })

    return res.json({ address })
  } catch (error) {
    console.error(JSON.stringify({
      ts: new Date().toISOString(),
      module: "backend-store-addresses",
      operation: "createAddress",
      phase: "error",
      duration: Date.now() - t0,
      customerId,
      message: error instanceof Error ? error.message : String(error),
    }))
    throw error;
  }
}
