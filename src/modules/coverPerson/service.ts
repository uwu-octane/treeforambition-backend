import { MedusaService } from "@medusajs/framework/utils"
import CoverPerson from "./models/coverPerson"

class CoverPersonModuleService extends MedusaService({
  CoverPerson,
}) {
  constructor(container?: any) {
    super(container);
    console.log(JSON.stringify({
      ts: new Date().toISOString(),
      module: "service-coverPerson",
      operation: "init",
      phase: "done",
    }));
  }
}

export default CoverPersonModuleService
