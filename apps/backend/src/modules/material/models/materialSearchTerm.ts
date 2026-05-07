import { model } from "@medusajs/framework/utils"
import { Material } from "./material"

export const MaterialSearchTerm = model.define("material_search_term", {
  id: model.id().primaryKey(),
  term: model.text(),
  material: model.belongsTo(() => Material, {
    mappedBy: "searchTerms",
  }),
})
