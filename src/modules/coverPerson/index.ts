import CoverPersonModuleService from "./service"
import { Module } from "@medusajs/framework/utils"

export const COVER_PERSON_MODULE = "coverPerson"

export default Module(COVER_PERSON_MODULE, {
  service: CoverPersonModuleService,
})
