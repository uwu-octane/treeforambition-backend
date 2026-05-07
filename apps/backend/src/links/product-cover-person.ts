import { defineLink } from "@medusajs/framework/utils"
import CoverPersonModule from "../modules/coverPerson"
import ProductModule from "@medusajs/medusa/product"

export default defineLink(
  ProductModule.linkable.product,
  CoverPersonModule.linkable.coverPerson,
)
