import { ModuleProvider, Modules } from "@medusajs/framework/utils"
import WechatPayProvider from "./wechat-pay"

export default ModuleProvider(Modules.PAYMENT, {
  services: [WechatPayProvider],
})
