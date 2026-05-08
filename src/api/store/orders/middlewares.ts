import { MiddlewareRoute, authenticate } from "@medusajs/framework"

/** Orders list middleware config:
 *  - GET /store/orders: List customer orders (customer auth required) */
export const orderMiddlewares: MiddlewareRoute[] = [
  {
    matcher: "/store/orders",
    method: "GET",
    middlewares: [
      authenticate("customer", ["session", "bearer"]),
    ],
  },
]
