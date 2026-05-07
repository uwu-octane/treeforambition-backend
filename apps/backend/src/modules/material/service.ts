import { MedusaService } from "@medusajs/framework/utils"
import { Material } from "./models/material"
import { MaterialAssetRef } from "./models/materialAssetRef"
import { MaterialSearchTerm } from "./models/materialSearchTerm"

class MaterialModuleService extends MedusaService({
  Material,
  MaterialAssetRef,
  MaterialSearchTerm,
}) {}

export default MaterialModuleService
