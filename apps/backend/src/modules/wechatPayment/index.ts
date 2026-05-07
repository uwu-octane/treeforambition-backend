import { Module } from "@medusajs/framework/utils"
import WechatPaymentModuleService from "./service"

export const WECHAT_PAYMENT_MODULE = "wechatPayment"

export default Module(WECHAT_PAYMENT_MODULE, {
  service: WechatPaymentModuleService,
})
