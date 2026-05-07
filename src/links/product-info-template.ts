import { defineLink } from "@medusajs/framework/utils"
import ProductInfoTemplateModule from "../modules/productInfoTemplate"
import ProductModule from "@medusajs/medusa/product"

export default defineLink(
  ProductModule.linkable.product,
  ProductInfoTemplateModule.linkable.productInfoTemplate,
)
