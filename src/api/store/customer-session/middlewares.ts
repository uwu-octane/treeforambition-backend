import { MiddlewareRoute, authenticate } from "@medusajs/framework"

export const customerSessionMiddlewares: MiddlewareRoute[] = [
  {
    matcher: "/store/customer-session",
    method: "GET",
    middlewares: [
      authenticate("customer", ["session", "bearer"]),
    ],
  },
]
