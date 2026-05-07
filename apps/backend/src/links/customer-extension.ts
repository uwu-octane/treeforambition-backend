import { defineLink } from "@medusajs/framework/utils"
import CustomerExtensionModule from "../modules/customerExtension"
import CustomerModule from "@medusajs/medusa/customer"

export default defineLink(
  CustomerModule.linkable.customer,
  CustomerExtensionModule.linkable.customerExtension,
)
