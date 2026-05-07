import { loadEnv, defineConfig } from '@medusajs/framework/utils'

loadEnv(process.env.NODE_ENV || 'development', process.cwd())

module.exports = defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    redisUrl: process.env.REDIS_URL,
    http: {
      storeCors: process.env.STORE_CORS!,
      adminCors: process.env.ADMIN_CORS!,
      authCors: process.env.AUTH_CORS!,
      jwtSecret: process.env.JWT_SECRET || "supersecret",
      cookieSecret: process.env.COOKIE_SECRET || "supersecret",
    },
    workerMode: (process.env.WORKER_MODE as "shared" | "worker" | "server") || "shared",
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
              file_url: process.env.MEDUSA_FILE_URL || "https://cdn.treeparis.cn",
              access_key_id: process.env.MEDUSA_FILE_ACCESS_KEY_ID,
              secret_access_key: process.env.MEDUSA_FILE_SECRET_ACCESS_KEY,
              region: process.env.MEDUSA_FILE_REGION || "ap-guangzhou",
              bucket: process.env.MEDUSA_FILE_BUCKET || "magazin-1313679194",
              endpoint: process.env.MEDUSA_FILE_ENDPOINT || "https://cos.ap-guangzhou.myqcloud.com",
              prefix: process.env.MEDUSA_FILE_PREFIX || "products/",
            },
          },
        ],
      },
    },
  ],
  plugins: [],
})
