import { defineMiddlewares, validateAndTransformBody } from "@medusajs/framework/http"
import { checkoutMiddlewares } from "./store/checkout/middlewares"
import { customerSessionMiddlewares } from "./store/customer-session/middlewares"
import { favoriteMiddlewares } from "./store/favorites/middlewares"
import { orderMiddlewares } from "./store/orders/middlewares"
import { orderDetailMiddlewares } from "./store/orders/[id]/middlewares"
import { addressMiddlewares } from "./store/addresses/middlewares"
import { PreviewLoginSchema } from "./store/preview-login/route"
import { WechatAuthCallbackSchema } from "./store/wechat-auth/callback/route"
import { ImportBodySchema } from "./admin/materials-import/route"

const logRequest = (req: any, res: any, next: any) => {
  const t0 = Date.now()
  const requestId = `${Date.now().toString(36)}${Math.random().toString(36).substring(2, 6)}`
  console.log(JSON.stringify({
    ts: new Date().toISOString(),
    level: "info",
    module: "http",
    operation: "request",
    requestId,
    method: req.method,
    path: req.path || req.url,
    hasAuth: !!req.auth_context?.actor_id,
  }))
  const originalJson = res.json.bind(res)
  res.json = function (body: any) {
    console.log(JSON.stringify({
      ts: new Date().toISOString(),
      level: "info",
      module: "http",
      operation: "response",
      requestId,
      method: req.method,
      path: req.path || req.url,
      duration: Date.now() - t0,
      statusCode: res.statusCode,
    }))
    return originalJson(body)
  }
  next?.()
}

export default defineMiddlewares({
  routes: [
    ...checkoutMiddlewares,
    ...customerSessionMiddlewares,
    ...favoriteMiddlewares,
    ...orderMiddlewares,
    ...orderDetailMiddlewares,
    ...addressMiddlewares,
    {
      matcher: "/store/*",
      middlewares: [logRequest],
    },
    {
      matcher: "/admin/*",
      middlewares: [logRequest],
    },
    {
      matcher: "/store/preview-login",
      method: "POST",
      middlewares: [
        validateAndTransformBody(PreviewLoginSchema),
      ],
    },
    {
      matcher: "/store/wechat-auth/callback",
      method: "POST",
      middlewares: [
        validateAndTransformBody(WechatAuthCallbackSchema),
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
