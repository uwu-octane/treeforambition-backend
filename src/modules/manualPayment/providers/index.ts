import { ModuleProvider, Modules } from "@medusajs/framework/utils"
import ManualPayProvider from "./manual-pay"

export default ModuleProvider(Modules.PAYMENT, {
  services: [ManualPayProvider],
})
