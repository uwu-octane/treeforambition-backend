import { MedusaService } from "@medusajs/framework/utils"
import { ProductInfoTemplate } from "./models/productInfoTemplate"
import { ProductShippingMethod } from "./models/shippingMethod"

class ProductInfoTemplateModuleService extends MedusaService({
  ProductInfoTemplate,
  ProductShippingMethod,
}) {}

export default ProductInfoTemplateModuleService
