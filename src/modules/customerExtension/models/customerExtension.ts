import { model } from "@medusajs/framework/utils"

const CustomerExtension = model.define("customer_extension", {
  id: model.id().primaryKey(),
  customerId: model.text().unique(), // links to Medusa customer
  phone: model.text().unique().nullable(),
  phoneVerifiedAt: model.dateTime().nullable(),
  wechatAppId: model.text().nullable(),
  wechatOpenId: model.text().unique().nullable(),
  wechatUnionId: model.text().unique().nullable(),
  wechatNickname: model.text().nullable(),
  wechatAvatarUrl: model.text().nullable(),
  wechatLastLoginSource: model.enum(["service_h5", "website_qr"]).nullable(),
  wechatAuthorizedAt: model.dateTime().nullable(),
  lastLoginAt: model.dateTime().nullable(),
})

export default CustomerExtension
