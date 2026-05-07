import { model } from "@medusajs/framework/utils"
import { Material } from "./material"

export const MaterialAssetRef = model.define("material_asset_ref", {
  id: model.id().primaryKey(),
  sortOrder: model.number().default(0),
  isPrimary: model.boolean().default(false),
  material: model.belongsTo(() => Material, {
    mappedBy: "assetRefs",
  }),
  assetId: model.text(),
})
