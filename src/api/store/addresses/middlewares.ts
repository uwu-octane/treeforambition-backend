import { authenticate, validateAndTransformBody, type MiddlewareRoute } from "@medusajs/framework"
import { z } from "zod"

export const CreateAddressSchema = z.object({
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  phone: z.string().optional(),
  company: z.string().optional(),
  address_1: z.string().min(1, "address_1 is required"),
  address_2: z.string().optional(),
  city: z.string().min(1, "city is required"),
  country_code: z.string().min(1, "country_code is required"),
  province: z.string().optional(),
  postal_code: z.string().optional(),
  metadata: z.any().optional(),
})

export type CreateAddressSchemaType = z.infer<typeof CreateAddressSchema>

/** Customer address middleware config:
 *  - GET /store/addresses: List own addresses (customer auth required)
 *  - POST /store/addresses: Create a new address (customer auth + body validation)
 *  - DELETE /store/addresses/:id: Delete an address by ID (customer auth required) */
export const addressMiddlewares: MiddlewareRoute[] = [
  {
    matcher: "/store/addresses",
    method: "GET",
    middlewares: [
      authenticate("customer", ["session", "bearer"]),
    ],
  },
  {
    matcher: "/store/addresses",
    method: "POST",
    middlewares: [
      authenticate("customer", ["session", "bearer"]),
      validateAndTransformBody(CreateAddressSchema),
    ],
  },
  {
    matcher: "/store/addresses/:id",
    method: "DELETE",
    middlewares: [
      authenticate("customer", ["session", "bearer"]),
    ],
  },
]
