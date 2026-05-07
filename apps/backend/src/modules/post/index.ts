import PostModuleService from "./service"
import { Module } from "@medusajs/framework/utils"

export const POST_MODULE = "post"

export default Module(POST_MODULE, {
  service: PostModuleService,
})
