import { MedusaService } from "@medusajs/framework/utils"
import { Material } from "./models/material"
import { MaterialAssetRef } from "./models/materialAssetRef"
import { MaterialSearchTerm } from "./models/materialSearchTerm"

class MaterialModuleService extends MedusaService({
  Material,
  MaterialAssetRef,
  MaterialSearchTerm,
}) {
  constructor(container?: any) {
    super(container);
    console.log(JSON.stringify({
      ts: new Date().toISOString(),
      module: "service-material",
      operation: "init",
      phase: "done",
    }));
  }
}

export default MaterialModuleService
