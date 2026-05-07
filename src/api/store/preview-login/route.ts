import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { createCustomersWorkflow } from "@medusajs/medusa/core-flows"
import { z } from "zod"
import jwt from "jsonwebtoken"

export const PreviewLoginSchema = z.object({
  returnTo: z.string().optional(),
})

export type PreviewLoginRequest = z.infer<typeof PreviewLoginSchema>

const PREVIEW_CUSTOMER_EMAIL = "preview@treeforambition.com"

export async function POST(
  req: MedusaRequest<PreviewLoginRequest>,
  res: MedusaResponse
) {
  // Only available in preview mode
  if (process.env.TFB_RUNTIME_ENV !== "preview") {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      "Not found"
    )
  }

  const customerService = req.scope.resolve("customer")
  const authService = req.scope.resolve("auth")
  const logger = req.scope.resolve("logger")

  // Find or create preview customer
  const existingCustomers = await customerService.listCustomers({
    email: PREVIEW_CUSTOMER_EMAIL,
  })

  let customer
  if (existingCustomers.length > 0) {
    customer = existingCustomers[0]
    logger.info(`Using existing preview customer: ${customer.id}`)
  } else {
    const { result } = await createCustomersWorkflow(req.scope).run({
      input: {
        customersData: [
          {
            email: PREVIEW_CUSTOMER_EMAIL,
            first_name: "Preview",
            last_name: "User",
            has_account: true,
          },
        ],
      },
    })
    customer = result[0]
    logger.info(`Created preview customer: ${customer.id}`)
  }

  // Find or create auth identity for the customer
  const existingIdentities = await authService.listAuthIdentities({
    provider_identities: {
      provider: "emailpass",
      entity_id: PREVIEW_CUSTOMER_EMAIL,
    },
  })

  let authIdentity
  if (existingIdentities.length > 0) {
    authIdentity = existingIdentities[0]
  } else {
    const created = await authService.createAuthIdentities({
      provider_identities: [
        {
          provider: "emailpass",
          entity_id: PREVIEW_CUSTOMER_EMAIL,
          provider_metadata: {},
        },
      ],
      app_metadata: {
        customer_id: customer.id,
      },
    })
    authIdentity = created
  }

  // Generate JWT token matching Medusa's expected format
  const jwtSecret = process.env.JWT_SECRET || "supersecret"
  const token = jwt.sign(
    {
      actor_id: customer.id,
      actor_type: "customer",
      auth_identity_id: authIdentity.id,
    },
    jwtSecret,
    { expiresIn: "24h" }
  )

  return res.json({
    token,
    customer: {
      id: customer.id,
      email: customer.email,
      first_name: customer.first_name,
      last_name: customer.last_name,
    },
  })
}
