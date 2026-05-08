import { MiddlewareRoute, authenticate, validateAndTransformBody } from "@medusajs/framework"
import { z } from "zod"

export const ToggleFavoriteSchema = z.object({
  productSlug: z.string().min(1, "productSlug is required"),
})

export type ToggleFavoriteSchemaType = z.infer<typeof ToggleFavoriteSchema>

/** Favorites middleware config:
 *  - GET /store/favorites: List favorite products (customer auth required)
 *  - POST /store/favorites: Toggle a product favorite (customer auth + productSlug body) */
export const favoriteMiddlewares: MiddlewareRoute[] = [
  {
    matcher: "/store/favorites",
    method: "GET",
    middlewares: [
      authenticate("customer", ["session", "bearer"]),
    ],
  },
  {
    matcher: "/store/favorites",
    method: "POST",
    middlewares: [
      authenticate("customer", ["session", "bearer"]),
      validateAndTransformBody(ToggleFavoriteSchema),
    ],
  },
]
