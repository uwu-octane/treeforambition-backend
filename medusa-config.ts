import { defineConfig } from '@medusajs/framework/utils'
import {
  DATABASE_URL,
  REDIS_URL,
  STORE_CORS,
  ADMIN_CORS,
  AUTH_CORS,
  JWT_SECRET,
  COOKIE_SECRET,
  WORKER_MODE,
  MEDUSA_FILE_URL,
  MEDUSA_FILE_ACCESS_KEY_ID,
  MEDUSA_FILE_SECRET_ACCESS_KEY,
  MEDUSA_FILE_REGION,
  MEDUSA_FILE_BUCKET,
  MEDUSA_FILE_ENDPOINT,
  MEDUSA_FILE_PREFIX,
  WECHAT_API_BASE,
  WECHAT_MP_APP_ID,
  WECHAT_MP_APP_SECRET,
  WECHAT_MP_CALLBACK_URL,
  WECHAT_MP_SCOPE,
  WECHAT_PAY_API_V3_KEY,
  WECHAT_PAY_APP_ID,
  WECHAT_PAY_MCH_ID,
  WECHAT_PAY_MERCHANT_SERIAL_NO,
  WECHAT_PAY_NOTIFY_URL,
  WECHAT_PAY_PRIVATE_KEY_PEM,
  WECHAT_PAY_PUBLIC_KEY_PEM,
  WECHAT_PAY_PUB_KEY_ID,
  logEnvSummary,
} from './src/lib/env'

logEnvSummary()

module.exports = defineConfig({
  projectConfig: {
    databaseUrl: DATABASE_URL,
    redisUrl: REDIS_URL,
    http: {
      storeCors: STORE_CORS,
      adminCors: ADMIN_CORS,
      authCors: AUTH_CORS,
      jwtSecret: JWT_SECRET,
      cookieSecret: COOKIE_SECRET,
      authMethodsPerActor: {
        customer: ["emailpass", "wechat-mp"],
        user: ["emailpass"],
      },
    },
    workerMode: WORKER_MODE,
  },
  modules: [
    { resolve: "./src/modules/coverPerson" },
    { resolve: "./src/modules/productInfoTemplate" },
    { resolve: "./src/modules/materialAsset" },
    { resolve: "./src/modules/material" },
    { resolve: "./src/modules/post" },
    { resolve: "./src/modules/favorite" },
    { resolve: "./src/modules/salesLeaderboard" },
    { resolve: "./src/modules/customerExtension" },
    { resolve: "./src/modules/wechatPayment" },
    {
      resolve: "@medusajs/medusa/auth",
      options: {
        providers: [
          {
            resolve: "@medusajs/medusa/auth-emailpass",
            id: "emailpass",
            options: {},
          },
          {
            resolve: "./src/modules/wechatAuth/providers",
            id: "wechat-mp",
            options: {
              apiBase: WECHAT_API_BASE,
              appId: WECHAT_MP_APP_ID,
              appSecret: WECHAT_MP_APP_SECRET,
              callbackUrl: WECHAT_MP_CALLBACK_URL,
              scope: WECHAT_MP_SCOPE,
            },
          },
        ],
      },
    },
    {
      resolve: "@medusajs/medusa/payment",
      options: {
        providers: [
          {
            resolve: "./src/modules/wechatPayment/providers",
            id: "default",
            options: {
              apiV3Key: WECHAT_PAY_API_V3_KEY,
              appId: WECHAT_PAY_APP_ID,
              mchId: WECHAT_PAY_MCH_ID,
              merchantSerialNo: WECHAT_PAY_MERCHANT_SERIAL_NO,
              notifyUrl: WECHAT_PAY_NOTIFY_URL,
              platformPublicKey: WECHAT_PAY_PUBLIC_KEY_PEM,
              platformPublicKeyId: WECHAT_PAY_PUB_KEY_ID,
              privateKey: WECHAT_PAY_PRIVATE_KEY_PEM,
            },
          },
          {
            resolve: "./src/modules/manualPayment/providers",
            id: "default",
            options: {},
          },
        ],
      },
    },
    {
      resolve: "@medusajs/medusa/fulfillment",
      options: {
        providers: [
          {
            resolve: "./src/modules/tfaLogistics",
            id: "logistics",
            options: {},
          },
        ],
      },
    },
    {
      resolve: "@medusajs/medusa/file",
      options: {
        providers: [
          {
            resolve: "@medusajs/medusa/file-s3",
            id: "s3",
            options: {
              file_url: MEDUSA_FILE_URL,
              access_key_id: MEDUSA_FILE_ACCESS_KEY_ID,
              secret_access_key: MEDUSA_FILE_SECRET_ACCESS_KEY,
              region: MEDUSA_FILE_REGION,
              bucket: MEDUSA_FILE_BUCKET,
              endpoint: MEDUSA_FILE_ENDPOINT,
              prefix: MEDUSA_FILE_PREFIX,
            },
          },
        ],
      },
    },
  ],
  plugins: [],
})
