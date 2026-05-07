import { MedusaService } from "@medusajs/framework/utils"
import CoverPerson from "./models/coverPerson"

class CoverPersonModuleService extends MedusaService({
  CoverPerson,
}) {}

export default CoverPersonModuleService
