import { Module } from "@medusajs/framework/utils"
import ManualPaymentModuleService from "./service"

export const MANUAL_PAYMENT_MODULE = "manualPayment"

export default Module(MANUAL_PAYMENT_MODULE, {
  service: ManualPaymentModuleService,
})
