import { defineLink } from "@medusajs/framework/utils"
import FavoriteModule from "../modules/favorite"
import ProductModule from "@medusajs/medusa/product"

export default defineLink(
  ProductModule.linkable.product,
  FavoriteModule.linkable.favorite,
)
