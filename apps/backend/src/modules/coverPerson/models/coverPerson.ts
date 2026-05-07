import { model } from "@medusajs/framework/utils"

const CoverPerson = model.define("cover_person", {
  id: model.id().primaryKey(),
  name: model.text().unique(),
  slug: model.text().unique(),
})

export default CoverPerson
