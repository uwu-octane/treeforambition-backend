/**
 * Comprehensive API integration test script
 *
 * Usage:
 *   npx medusa exec src/scripts/test-api.ts
 */

const BASE_URL = "http://localhost:9000"
const PK = "pk_cbbc52186e8e7b99b85d6fedac8705d32c8771277e9417fa070f43483f373093"
let ADMIN_TOKEN = ""
let CUSTOMER_TOKEN = ""

async function request(path: string, options: RequestInit = {}) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) || {}),
  }
  if (path.startsWith("/store") && !headers["Authorization"]) {
    headers["x-publishable-api-key"] = PK
  }
  if (path.startsWith("/admin") && ADMIN_TOKEN) {
    headers["Authorization"] = `Bearer ${ADMIN_TOKEN}`
  }
  if (CUSTOMER_TOKEN && headers["use-customer-token"]) {
    headers["Authorization"] = `Bearer ${CUSTOMER_TOKEN}`
    delete headers["use-customer-token"]
  }
  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers })
  const body = await res.json().catch(() => null)
  return { status: res.status, body }
}

let passed = 0
let failed = 0

function test(name: string) {
  return {
    assert: (condition: boolean, msg?: string) => {
      if (condition) {
        passed++
        console.log(`  ✅ ${name}`)
      } else {
        failed++
        console.log(`  ❌ ${name}: ${msg || "assertion failed"}`)
      }
    },
  }
}

export default async function runTests() {
  console.log("\n=== Medusa API Integration Tests ===\n")

  // -----------------------------------------------------------------------
  // 1. Admin Login
  // -----------------------------------------------------------------------
  console.log("1. Admin Authentication")
  const loginRes = await request("/auth/user/emailpass", {
    method: "POST",
    body: JSON.stringify({ email: "admin@treeparis.com", password: "Shenfei6255!" }),
  })
  ADMIN_TOKEN = loginRes.body?.token || ""
  test("Admin login").assert(!!ADMIN_TOKEN, "Failed to get admin token")
  test("Admin token is string").assert(typeof ADMIN_TOKEN === "string")

  // -----------------------------------------------------------------------
  // 2. Store Products
  // -----------------------------------------------------------------------
  console.log("\n2. Store Products API")
  const productsRes = await request("/store/products?limit=5")
  test("Products list returns 200").assert(productsRes.status === 200)
  test("Products has count").assert(typeof productsRes.body?.count === "number")
  test("Products has items").assert(Array.isArray(productsRes.body?.products))

  // -----------------------------------------------------------------------
  // 3. Checkout (Mock)
  // -----------------------------------------------------------------------
  console.log("\n3. Checkout API (Mock Mode)")
  const checkoutRes = await request("/store/checkout", {
    method: "POST",
    body: JSON.stringify({
      items: [{ productSlug: "t-shirt", quantity: 1 }],
      paymentMethod: "wechat_jsapi",
    }),
  })
  test("Checkout returns 200").assert(checkoutRes.status === 200)
  test("Checkout success").assert(checkoutRes.body?.success === true)
  test("Checkout orderNumber").assert(typeof checkoutRes.body?.orderNumber === "string")
  test("WeChat prepayId").assert(typeof checkoutRes.body?.paymentSession?.prepayId === "string")

  // -----------------------------------------------------------------------
  // 4. Leaderboard
  // -----------------------------------------------------------------------
  console.log("\n4. Product Leaderboard API")
  const lbRes = await request("/store/products/leaderboard?key=test&targetSlug=t-shirt")
  test("Leaderboard returns 200").assert(lbRes.status === 200)
  test("Leaderboard has totalSold").assert(typeof lbRes.body?.totalSold === "number")
  test("Leaderboard has entries").assert(Array.isArray(lbRes.body?.entries))

  // -----------------------------------------------------------------------
  // 5. Variant Detail
  // -----------------------------------------------------------------------
  console.log("\n5. Product Variant Detail API")
  const vdRes = await request("/store/products/variant-detail?slug=t-shirt")
  test("Variant detail returns 200 or 404").assert([200, 404].includes(vdRes.status))

  // -----------------------------------------------------------------------
  // 6. Admin Sales Analysis
  // -----------------------------------------------------------------------
  console.log("\n6. Admin Sales Analysis")
  const salesRes = await request("/admin/sales-analysis")
  test("Sales analysis returns 200").assert(salesRes.status === 200)
  test("Sales has totalOrders").assert(typeof salesRes.body?.totalOrders === "number")
  test("Sales has totalRevenue").assert(typeof salesRes.body?.totalRevenue === "number")

  // -----------------------------------------------------------------------
  // 7. Admin Orders Export
  // -----------------------------------------------------------------------
  console.log("\n7. Admin Orders Export")
  const exportRes = await request("/admin/orders/export?format=xlsx")
  test("Orders export returns 200").assert(exportRes.status === 200)

  // -----------------------------------------------------------------------
  // 8. Admin Materials Import
  // -----------------------------------------------------------------------
  console.log("\n8. Admin Materials Import")
  const importRes = await request("/admin/materials-import", {
    method: "POST",
    body: JSON.stringify({ fileBase64: "dGVzdA==" }),
  })
  test("Materials import returns 200").assert(importRes.status === 200)
  test("Import has id").assert(typeof importRes.body?.id === "string")

  // -----------------------------------------------------------------------
  // 9. Preview Login
  // -----------------------------------------------------------------------
  console.log("\n9. Preview Customer Login")
  const previewRes = await request("/store/preview-login", {
    method: "POST",
    body: JSON.stringify({ returnTo: "/products" }),
  })
  test("Preview login returns 200").assert(previewRes.status === 200)
  if (previewRes.body?.token) {
    CUSTOMER_TOKEN = previewRes.body.token
    test("Preview login has token").assert(true)
    test("Preview login has customer").assert(typeof previewRes.body?.customer === "object")
  } else {
    test("Preview login has token").assert(false, "No token in response")
    test("Preview login has customer").assert(false, "No customer in response")
  }

  // -----------------------------------------------------------------------
  // 10. Database Verification
  // -----------------------------------------------------------------------
  console.log("\n10. Database Verification")
  const { Client } = require("pg")
  const client = new Client({ connectionString: process.env.DATABASE_URL || "postgres://postgres@localhost/medusa_backend" })
  await client.connect()

  // Check cover_person table
  const cpCount = await client.query('SELECT COUNT(*) FROM "cover_person" WHERE deleted_at IS NULL')
  test("cover_person has records").assert(parseInt(cpCount.rows[0].count) > 0, `Found ${cpCount.rows[0].count}`)

  // Check material_asset table
  const maCount = await client.query('SELECT COUNT(*) FROM "material_asset" WHERE deleted_at IS NULL')
  test("material_asset has records").assert(parseInt(maCount.rows[0].count) > 0, `Found ${maCount.rows[0].count}`)

  // Check material table
  const mCount = await client.query('SELECT COUNT(*) FROM "material" WHERE deleted_at IS NULL')
  test("material has records").assert(parseInt(mCount.rows[0].count) > 0, `Found ${mCount.rows[0].count}`)

  // Check post table
  const pCount = await client.query('SELECT COUNT(*) FROM "post" WHERE deleted_at IS NULL')
  test("post has records").assert(parseInt(pCount.rows[0].count) > 0, `Found ${pCount.rows[0].count}`)

  // Check product table (Medusa's own)
  const prodCount = await client.query('SELECT COUNT(*) FROM "product" WHERE deleted_at IS NULL')
  test("product has records").assert(parseInt(prodCount.rows[0].count) > 0, `Found ${prodCount.rows[0].count}`)

  // Check customer table (Medusa's own)
  const custCount = await client.query('SELECT COUNT(*) FROM "customer" WHERE deleted_at IS NULL')
  test("customer has records").assert(parseInt(custCount.rows[0].count) > 0, `Found ${custCount.rows[0].count}`)

  // Check order table (Medusa's own)
  const orderCount = await client.query('SELECT COUNT(*) FROM "order" WHERE deleted_at IS NULL')
  test("order has records").assert(parseInt(orderCount.rows[0].count) > 0, `Found ${orderCount.rows[0].count}`)

  await client.end()

  // -----------------------------------------------------------------------
  // Summary
  // -----------------------------------------------------------------------
  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`)
}
