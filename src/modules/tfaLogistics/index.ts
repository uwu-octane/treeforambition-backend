import { ModuleProvider, Modules } from "@medusajs/framework/utils"
import TfaLogisticsProviderService from "./service"

export default ModuleProvider(Modules.FULFILLMENT, {
  services: [TfaLogisticsProviderService],
})
