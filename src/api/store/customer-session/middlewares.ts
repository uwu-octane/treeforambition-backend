import { MiddlewareRoute, authenticate } from "@medusajs/framework"

/** Customer session middleware config:
 *  - GET /store/customer-session: Get current customer session info (customer auth required) */
export const customerSessionMiddlewares: MiddlewareRoute[] = [
  {
    matcher: "/store/customer-session",
    method: "GET",
    middlewares: [
      authenticate("customer", ["session", "bearer"]),
    ],
  },
]
