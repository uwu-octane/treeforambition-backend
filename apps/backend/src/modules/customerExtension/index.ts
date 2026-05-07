import CustomerExtensionModuleService from "./service"
import { Module } from "@medusajs/framework/utils"

export const CUSTOMER_EXTENSION_MODULE = "customerExtension"

export default Module(CUSTOMER_EXTENSION_MODULE, {
  service: CustomerExtensionModuleService,
})
