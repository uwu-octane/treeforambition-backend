import MaterialAssetModuleService from "./service"
import { Module } from "@medusajs/framework/utils"

export const MATERIAL_ASSET_MODULE = "materialAsset"

export default Module(MATERIAL_ASSET_MODULE, {
  service: MaterialAssetModuleService,
})
