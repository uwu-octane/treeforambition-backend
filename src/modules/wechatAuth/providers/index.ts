import { ModuleProvider, Modules } from "@medusajs/framework/utils"
import WechatMpAuthProvider from "./wechat-mp"

export default ModuleProvider(Modules.AUTH, {
  services: [WechatMpAuthProvider],
})
