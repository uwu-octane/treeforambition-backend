import { model } from "@medusajs/framework/utils"

const SalesLeaderboard = model.define("salesLeaderboard", {
  id: model.id().primaryKey(),
  /** Parent product ID (aggregates all variants under this product). */
  productId: model.text(),
  /** Customer ID who purchased. */
  customerId: model.text(),
  /** Total physical copies bought by this customer for this product. */
  totalCopies: model.number(),
  /** Display name for the leaderboard entry. */
  name: model.text().nullable(),
  /** Display note (e.g. city, company name). */
  note: model.text().nullable(),
})

export default SalesLeaderboard
