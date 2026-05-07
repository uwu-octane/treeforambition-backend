import { MiddlewareRoute, authenticate, validateAndTransformBody } from "@medusajs/framework"
import { z } from "zod"

export const ToggleFavoriteSchema = z.object({
  productSlug: z.string().min(1, "productSlug is required"),
})

export type ToggleFavoriteSchemaType = z.infer<typeof ToggleFavoriteSchema>

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
