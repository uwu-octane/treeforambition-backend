import { model } from "@medusajs/framework/utils"

const MaterialAsset = model.define("material_asset", {
  id: model.id().primaryKey(),
  kind: model.enum(["cover", "gallery", "pdf", "attachment", "other"]),
  displayName: model.text().nullable(),
  title: model.text().nullable(),
  adminLabel: model.text().nullable(),
  filename: model.text().unique(),
  storageDir: model.enum(["covers", "galleries", "pdfs", "attachments", "misc"]),
  prefix: model.text().nullable(),
  url: model.text().nullable(),
  thumbnailURL: model.text().nullable(),
  mimeType: model.text().nullable(),
  filesize: model.number().nullable(),
  width: model.number().nullable(),
  height: model.number().nullable(),
  focalX: model.number().nullable(),
  focalY: model.number().nullable(),
  variants: model.json().nullable(),
  sizes: model.json().nullable(),
  coverPersonNames: model.json().nullable(),
  deletedAt: model.dateTime().nullable(),
})

export default MaterialAsset
