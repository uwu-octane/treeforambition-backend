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
    { resolve: "./src/modules/customerExtension" },
    { resolve: "./src/modules/wechatPayment" },
    {
      resolve: "@medusajs/medusa/payment",
      options: {
        providers: [
          {
            resolve: "./src/modules/wechatPayment/providers",
            id: "default",
            options: {},
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
