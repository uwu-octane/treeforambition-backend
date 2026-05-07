import { model } from "@medusajs/framework/utils"

const Favorite = model.define("favorite", {
  id: model.id().primaryKey(),
  productSlug: model.text(),
  savedAt: model.dateTime(),
  customerId: model.text(),
  productId: model.text(),
})

export default Favorite
