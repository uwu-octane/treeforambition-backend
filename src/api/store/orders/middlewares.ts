import { MiddlewareRoute, authenticate } from "@medusajs/framework"

export const orderMiddlewares: MiddlewareRoute[] = [
  {
    matcher: "/store/orders",
    method: "GET",
    middlewares: [
      authenticate("customer", ["session", "bearer"]),
    ],
  },
]
