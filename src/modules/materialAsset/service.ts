import { MedusaService } from "@medusajs/framework/utils"
import MaterialAsset from "./models/materialAsset"

class MaterialAssetModuleService extends MedusaService({
  MaterialAsset,
}) {
  constructor(container?: any) {
    super(container);
    console.log(JSON.stringify({
      ts: new Date().toISOString(),
      module: "service-materialAsset",
      operation: "init",
      phase: "done",
    }));
  }
}

export default MaterialAssetModuleService
