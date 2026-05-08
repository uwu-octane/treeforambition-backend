import { MedusaService } from "@medusajs/framework/utils"
import { ProductInfoTemplate } from "./models/productInfoTemplate"
import { ProductShippingMethod } from "./models/shippingMethod"

class ProductInfoTemplateModuleService extends MedusaService({
  ProductInfoTemplate,
  ProductShippingMethod,
}) {
  constructor(container?: any) {
    super(container);
    console.log(JSON.stringify({
      ts: new Date().toISOString(),
      module: "service-productInfoTemplate",
      operation: "init",
      phase: "done",
    }));
  }
}

export default ProductInfoTemplateModuleService
