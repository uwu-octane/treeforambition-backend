import ProductInfoTemplateModuleService from "./service"
import { Module } from "@medusajs/framework/utils"

export const PRODUCT_INFO_TEMPLATE_MODULE = "productInfoTemplate"

export default Module(PRODUCT_INFO_TEMPLATE_MODULE, {
  service: ProductInfoTemplateModuleService,
})
