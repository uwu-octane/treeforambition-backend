import { MedusaService } from "@medusajs/framework/utils"
import MaterialAsset from "./models/materialAsset"

class MaterialAssetModuleService extends MedusaService({
  MaterialAsset,
}) {}

export default MaterialAssetModuleService
