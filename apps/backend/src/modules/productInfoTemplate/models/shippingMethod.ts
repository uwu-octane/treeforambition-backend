import { model } from "@medusajs/framework/utils"
import { ProductInfoTemplate } from "./productInfoTemplate"

export const ProductShippingMethod = model.define("product_shipping_method", {
  id: model.id().primaryKey(),
  label: model.text(),
  description: model.text().nullable(),
  isDefault: model.boolean().default(false),
  basePriceAmount: model.number(),
  incrementalPricePerUnit: model.number(),
  freeShippingThreshold: model.number().default(50),
  template: model.belongsTo(() => ProductInfoTemplate, {
    mappedBy: "shippingMethods",
  }),
})
