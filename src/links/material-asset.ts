import { defineLink } from "@medusajs/framework/utils"
import MaterialModule from "../modules/material"
import MaterialAssetModule from "../modules/materialAsset"

export default defineLink(
  MaterialModule.linkable.material,
  MaterialAssetModule.linkable.materialAsset,
)
