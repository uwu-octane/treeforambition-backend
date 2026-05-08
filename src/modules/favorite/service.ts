import { MedusaService } from "@medusajs/framework/utils"
import Favorite from "./models/favorite"

class FavoriteModuleService extends MedusaService({
  Favorite,
}) {
  constructor(container?: any) {
    super(container);
    console.log(JSON.stringify({
      ts: new Date().toISOString(),
      module: "service-favorite",
      operation: "init",
      phase: "done",
    }));
  }
}

export default FavoriteModuleService
