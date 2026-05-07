import { defineMiddlewares, validateAndTransformBody } from "@medusajs/framework/http"
import { checkoutMiddlewares } from "./store/checkout/middlewares"
import { customerSessionMiddlewares } from "./store/customer-session/middlewares"
import { favoriteMiddlewares } from "./store/favorites/middlewares"
import { orderMiddlewares } from "./store/orders/middlewares"
import { orderDetailMiddlewares } from "./store/orders/[id]/middlewares"
import { addressMiddlewares } from "./store/addresses/middlewares"
import { PreviewLoginSchema } from "./store/preview-login/route"
import { ImportBodySchema } from "./admin/materials-import/route"

export default defineMiddlewares({
  routes: [
    ...checkoutMiddlewares,
    ...customerSessionMiddlewares,
    ...favoriteMiddlewares,
    ...orderMiddlewares,
    ...orderDetailMiddlewares,
    ...addressMiddlewares,
    {
      matcher: "/store/preview-login",
      method: "POST",
      middlewares: [
        validateAndTransformBody(PreviewLoginSchema),
      ],
    },
    {
      matcher: "/admin/materials-import",
      method: "POST",
      middlewares: [
        validateAndTransformBody(ImportBodySchema),
      ],
    },
  ],
})
