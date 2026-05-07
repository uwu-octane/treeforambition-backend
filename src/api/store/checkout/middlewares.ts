import { authenticate, MiddlewareRoute, validateAndTransformBody } from "@medusajs/framework"
import { CheckoutRequestSchema } from "./route"

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
