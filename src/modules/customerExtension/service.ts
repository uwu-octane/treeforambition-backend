import { MedusaService } from "@medusajs/framework/utils"
import CustomerExtension from "./models/customerExtension"

class CustomerExtensionModuleService extends MedusaService({
  CustomerExtension,
}) {}

export default CustomerExtensionModuleService
