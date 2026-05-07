import FavoriteModuleService from "./service"
import { Module } from "@medusajs/framework/utils"

export const FAVORITE_MODULE = "favorite"

export default Module(FAVORITE_MODULE, {
  service: FavoriteModuleService,
})
