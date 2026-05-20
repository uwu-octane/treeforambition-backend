import { MedusaService } from "@medusajs/framework/utils"
import SalesLeaderboard from "./models/sales-leaderboard"

class SalesLeaderboardModuleService extends MedusaService({
  SalesLeaderboard,
}) {
  constructor(container?: any) {
    super(container);
  }
}

export default SalesLeaderboardModuleService
