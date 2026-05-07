import { model } from "@medusajs/framework/utils"
import { Post } from "./post"
import { PostParagraph } from "./postParagraph"

export const PostBlock = model.define("post_block", {
  id: model.id().primaryKey(),
  blockType: model.enum(["richText", "image"]),
  src: model.text().nullable(),
  alt: model.text().nullable(),
  caption: model.text().nullable(),
  aspectRatio: model.enum(["portrait", "landscape", "square"]).nullable(),
  sortOrder: model.number().default(0),
  post: model.belongsTo(() => Post, {
    mappedBy: "blocks",
  }),
  paragraphs: model.hasMany(() => PostParagraph, {
    mappedBy: "block",
  }),
})
