import { defineLink } from "@medusajs/framework/utils"
import FavoriteModule from "../modules/favorite"
import CustomerModule from "@medusajs/medusa/customer"

export default defineLink(
  CustomerModule.linkable.customer,
  FavoriteModule.linkable.favorite,
)
