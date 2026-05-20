import SalesLeaderboardModuleService from "./service"
import { Module } from "@medusajs/framework/utils"

export const SALES_LEADERBOARD_MODULE = "salesLeaderboard"

export default Module(SALES_LEADERBOARD_MODULE, {
  service: SalesLeaderboardModuleService,
})
