import { MiddlewareRoute, authenticate } from "@medusajs/framework"

export const orderDetailMiddlewares: MiddlewareRoute[] = [
  {
    matcher: "/store/orders/:id",
    method: "GET",
    middlewares: [
      authenticate("customer", ["session", "bearer"]),
    ],
  },
]
