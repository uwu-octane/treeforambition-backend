import { model } from "@medusajs/framework/utils"
import { MaterialAssetRef } from "./materialAssetRef"
import { MaterialSearchTerm } from "./materialSearchTerm"

export const Material = model.define("material", {
  id: model.id().primaryKey(),
  code: model.text().unique(),
  type: model.enum(["magazine", "poster", "booklet", "digital", "other"]).default("magazine"),
  title: model.text(),
  subtitle: model.text().nullable(),
  issue: model.text().nullable(),
  status: model.enum(["draft", "active", "archived"]).default("draft"),
  description: model.text().nullable(),
  publishDate: model.dateTime().nullable(),
  searchText: model.text().nullable(),
  coverPersonNames: model.json().nullable(),
  deletedAt: model.dateTime().nullable(),
  assetRefs: model.hasMany(() => MaterialAssetRef, {
    mappedBy: "material",
  }),
  searchTerms: model.hasMany(() => MaterialSearchTerm, {
    mappedBy: "material",
  }),
})
