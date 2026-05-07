import { MedusaService } from "@medusajs/framework/utils"
import Favorite from "./models/favorite"

class FavoriteModuleService extends MedusaService({
  Favorite,
}) {}

export default FavoriteModuleService
