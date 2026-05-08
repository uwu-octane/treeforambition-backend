import { authenticate, MiddlewareRoute, validateAndTransformBody } from "@medusajs/framework"
import { CheckoutRequestSchema } from "./route"

/** Checkout middleware config:
 *  - POST /store/checkout: Initiate checkout (customer auth + body validation) */
export const checkoutMiddlewares: MiddlewareRoute[] = [
  {
    matcher: "/store/checkout",
    method: "POST",
    middlewares: [
      authenticate("customer", ["session", "bearer"]),
      validateAndTransformBody(CheckoutRequestSchema),
    ],
  },
]
