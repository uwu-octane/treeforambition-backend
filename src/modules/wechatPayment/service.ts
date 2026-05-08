import { MedusaService } from "@medusajs/framework/utils"

class WechatPaymentModuleService extends MedusaService({}) {
  constructor(container?: any) {
    super(container);
    console.log(JSON.stringify({
      ts: new Date().toISOString(),
      module: "service-wechatPayment",
      operation: "init",
      phase: "done",
    }));
  }
}

export default WechatPaymentModuleService
