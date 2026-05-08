import { MedusaService } from "@medusajs/framework/utils"

class ManualPaymentModuleService extends MedusaService({}) {
  constructor(container?: any) {
    super(container);
    console.log(JSON.stringify({
      ts: new Date().toISOString(),
      module: "service-manualPayment",
      operation: "init",
      phase: "done",
    }));
  }
}

export default ManualPaymentModuleService
