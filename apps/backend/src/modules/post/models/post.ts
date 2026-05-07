import { model } from "@medusajs/framework/utils"
import { PostBlock } from "./postBlock"

export const Post = model.define("post", {
  id: model.id().primaryKey(),
  title: model.text(),
  slug: model.text().unique(),
  notionPageId: model.text().unique().nullable(),
  status: model.enum(["draft", "published"]).default("published"),
  year: model.number().nullable(),
  sortOrder: model.number().default(0),
  location: model.text().nullable(),
  publishedAt: model.text().nullable(),
  cover: model.json().nullable(),
  blocks: model.hasMany(() => PostBlock, {
    mappedBy: "post",
  }),
})
