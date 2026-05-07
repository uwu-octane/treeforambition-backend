import MaterialModuleService from "./service"
import { Module } from "@medusajs/framework/utils"

export const MATERIAL_MODULE = "material"

export default Module(MATERIAL_MODULE, {
  service: MaterialModuleService,
})
