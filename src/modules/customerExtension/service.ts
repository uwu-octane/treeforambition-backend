import { MedusaService } from "@medusajs/framework/utils"
import CustomerExtension from "./models/customerExtension"

class CustomerExtensionModuleService extends MedusaService({
  CustomerExtension,
}) {
  constructor(container?: any) {
    super(container);
    console.log(JSON.stringify({
      ts: new Date().toISOString(),
      module: "service-customerExtension",
      operation: "init",
      phase: "done",
    }));
  }
}

export default CustomerExtensionModuleService
