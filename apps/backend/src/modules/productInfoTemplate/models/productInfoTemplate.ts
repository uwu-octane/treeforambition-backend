import { model } from "@medusajs/framework/utils"
import { ProductShippingMethod } from "./shippingMethod"

export const ProductInfoTemplate = model.define("product_info_template", {
  id: model.id().primaryKey(),
  title: model.text(),
  estimatedDispatchTime: model.text().default("付款后 3 个工作日内发货"),
  logisticsNote: model.text().nullable(),
  shippingMethods: model.hasMany(() => ProductShippingMethod, {
    mappedBy: "template",
  }),
})
