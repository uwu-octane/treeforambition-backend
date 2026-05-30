import { MiddlewareRoute, authenticate } from "@medusajs/framework"

/** Order detail middleware config:
 *  - GET /store/orders/:id: Get a single order by ID (customer auth required)
 *  - PATCH /store/orders/:id/address: Update order shipping address (customer auth required) */
export const orderDetailMiddlewares: MiddlewareRoute[] = [
  {
    matcher: "/store/orders/:id",
    method: "GET",
    middlewares: [
      authenticate("customer", ["session", "bearer"]),
    ],
  },
  {
    matcher: "/store/orders/:id/address",
    method: "PATCH",
    middlewares: [
      authenticate("customer", ["session", "bearer"]),
    ],
  },
]
