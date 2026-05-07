import { model } from "@medusajs/framework/utils"
import { PostBlock } from "./postBlock"

export const PostParagraph = model.define("post_paragraph", {
  id: model.id().primaryKey(),
  paragraph: model.text(),
  sortOrder: model.number().default(0),
  block: model.belongsTo(() => PostBlock, {
    mappedBy: "paragraphs",
  }),
})
