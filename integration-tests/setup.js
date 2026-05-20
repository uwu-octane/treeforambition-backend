const defaults = {
  ADMIN_CORS: "http://localhost:7001",
  AUTH_CORS: "http://localhost:8000",
  COOKIE_SECRET: "unit-test-cookie-secret",
  DATABASE_URL: "postgres://unit:unit@localhost:5432/unit",
  JWT_SECRET: "unit-test-jwt-secret",
  MEDUSA_BACKEND_URL: "http://localhost:9000",
  MEDUSA_FILE_ACCESS_KEY_ID: "unit-test-access-key",
  MEDUSA_FILE_BUCKET: "unit-test-bucket",
  MEDUSA_FILE_ENDPOINT: "http://localhost:9001",
  MEDUSA_FILE_REGION: "unit-test-region",
  MEDUSA_FILE_SECRET_ACCESS_KEY: "unit-test-secret-key",
  MEDUSA_FILE_URL: "http://localhost:9001/unit-test-bucket",
  REDIS_URL: "redis://localhost:6379",
  STORE_CORS: "http://localhost:8000",
  TEST_CUSTOMER_EMAIL: "preview-test@customer.treeforambition.local",
  TEST_CUSTOMER_PASSWORD: "preview-test-password-123",
  WECHAT_SERVICE_APP_ID: "wx_unit_test_app",
};

for (const [key, value] of Object.entries(defaults)) {
  if (!process.env[key]) {
    process.env[key] = value;
  }
}
