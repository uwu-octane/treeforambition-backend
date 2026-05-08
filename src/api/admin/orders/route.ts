import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { getOrdersListWorkflow } from "@medusajs/core-flows"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

const log = (entry: Record<string, unknown>) => {
  console.log(JSON.stringify({ ts: new Date().toISOString(), ...entry }))
}

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
) {
  const t0 = Date.now()
  const logger = req.scope.resolve("logger")
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  // Manually parse all query params to bypass the built-in validator
  // which strips unknown params like payment_status, fulfillment_status, etc.
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`)

  const getParam = (name: string): string | undefined =>
    url.searchParams.get(name) || undefined

  const getParamArray = (name: string): string[] => {
    const all = url.searchParams.getAll(name)
    return all.length > 0 ? all : []
  }

  // Parse operator filter params like created_at[gt]=xxx or created_at[$gt]=xxx
  const parseOperatorParam = (prefix: string): Record<string, string> | undefined => {
    const ops: Record<string, string> = {}
    for (const op of ["gt", "gte", "lt", "lte"]) {
      const val = url.searchParams.get(`${prefix}[${op}]`) ||
                  url.searchParams.get(`${prefix}[$${op}]`)
      if (val) ops[`$${op}`] = val
    }
    return Object.keys(ops).length > 0 ? ops : undefined
  }

  // ============================================================
  // 1. Parse standard filter params
  // ============================================================
  const status = getParam("status")
  const id = getParam("id")
  const q = getParam("q")
  const customerId = getParam("customer_id")
  const salesChannelIds = getParamArray("sales_channel_id")
  const regionId = getParam("region_id")
  const created_at = parseOperatorParam("created_at")
  const updated_at = parseOperatorParam("updated_at")
  const displayId = getParam("display_id")
  const currencyCode = getParam("currency_code")

  // ============================================================
  // 2. Parse custom filter params
  // ============================================================
  const paymentStatus = getParam("payment_status")
  const fulfillmentStatus = getParam("fulfillment_status")
  const email = getParam("email")
  const customerName = getParam("customer_name")
  const productTitle = getParam("product_title")
  const productHandle = getParam("product_handle")
  const orderTag = getParam("tag") || getParam("metadata_tag")
  const itemCount = parseOperatorParam("item_count")
  const totalOps = parseOperatorParam("total")

  // post-filter flags (computed / nested fields)
  const needsPostFilter = !!(paymentStatus || fulfillmentStatus || productTitle || productHandle || orderTag)

  // DB-level flags that require pulling extra data
  const needsExtraFetch = needsPostFilter || !!itemCount

  // ============================================================
  // 3. Build database-level filters
  // ============================================================
  const filters: Record<string, any> = {
    is_draft_order: false,
  }

  if (status) filters.status = status
  if (id) filters.id = id
  if (q) filters.q = q
  if (customerId) filters.customer_id = customerId
  if (salesChannelIds.length > 0) filters.sales_channel_id = salesChannelIds
  if (regionId) filters.region_id = regionId
  if (email) filters.email = { $like: `%${email}%` }
  if (displayId) filters.display_id = displayId
  if (currencyCode) filters.currency_code = currencyCode
  if (created_at) filters.created_at = created_at
  if (updated_at) filters.updated_at = updated_at
  if (totalOps) {
    filters.summary = {
      totals: {
        current_order_total: totalOps,
      },
    }
  }

  // ============================================================
  // 4. Handle customer_name filter
  //    Search customers by email, first_name, or last_name,
  //    then filter orders by matching customer IDs.
  // ============================================================
  if (customerName) {
    const t1 = Date.now()
    const { data: customers } = await query.graph({
      entity: "customer",
      fields: ["id"],
      filters: {
        $or: [
          { email: { $like: `%${customerName}%` } },
          { first_name: { $like: `%${customerName}%` } },
          { last_name: { $like: `%${customerName}%` } },
        ],
      },
      pagination: { take: 500, skip: 0 },
    })
    log({ level: "info", module: "adminOrders", operation: "queryCustomersByName", duration: Date.now() - t1, customerName, matchedCount: customers.length, entity: "customer" })

    const matchedCustomerIds = customers.map((c: any) => c.id)
    if (matchedCustomerIds.length > 0) {
      filters.customer_id = {
        $in: matchedCustomerIds,
      }
    } else {
      // No matching customers — return empty result
      log({ level: "info", module: "adminOrders", operation: "listOrders", duration: Date.now() - t0, status: "empty_customer_match" })
      return res.json({ orders: [], count: 0, offset: 0, limit: 0 })
    }
  }

  // ============================================================
  // 5. Get pagination params
  // ============================================================
  const limit = parseInt(getParam("limit") || "20")
  const offset = parseInt(getParam("offset") || "0")

  // ============================================================
  // 6. Build fields list
  // ============================================================
  const fieldsParam = getParam("fields")
  const baseFields = fieldsParam
    ? fieldsParam.split(",").map((f: string) => f.trim())
    : [
        "id",
        "display_id",
        "custom_display_id",
        "status",
        "version",
        "summary",
        "total",
        "metadata",
        "locale",
        "created_at",
        "updated_at",
        "email",
        "*items",
      ]

  // If we need to post-filter or extra-fetch, pull all related data
  const fields = (paymentStatus || fulfillmentStatus || itemCount)
    ? [...new Set([...baseFields, "payment_collections.*", "fulfillments.*", "*customer"])]
    : baseFields

  // ============================================================
  // 7. Run the workflow
  // ============================================================
  const workflow = getOrdersListWorkflow(req.scope)

  log({ level: "info", module: "adminOrders", operation: "runOrdersListWorkflow", filterCount: Object.keys(filters).length, needsExtraFetch, limit, offset })

  try {
    const workflowT0 = Date.now()
    const { result } = await workflow.run({
      input: {
        fields,
        variables: {
          filters,
          // When post-filtering, fetch enough rows to allow pagination
          // after in-memory filtering. For 366 orders, fetching all is fine.
          ...(needsExtraFetch ? { take: 1000, skip: 0 } : { take: limit, skip: offset }),
        },
      },
    })
    log({ level: "info", module: "adminOrders", operation: "workflowRun", duration: Date.now() - workflowT0, needsExtraFetch, limit, offset })

    let { rows, metadata } = result

    // ============================================================
    // 8. Post-filter for computed / nested fields
    // ============================================================
    if (needsPostFilter || itemCount || orderTag) {
      const postFilterT0 = Date.now()
      // payment_status / fulfillment_status
      if (paymentStatus) {
        rows = rows.filter((o: any) => o.payment_status === paymentStatus)
      }

      if (fulfillmentStatus) {
        rows = rows.filter((o: any) => o.fulfillment_status === fulfillmentStatus)
      }

      // product_title (search across line items)
      if (productTitle) {
        const needle = productTitle.toLowerCase()
        rows = rows.filter((o: any) =>
          (o.items || []).some(
            (item: any) =>
              item.product_title &&
              item.product_title.toLowerCase().includes(needle)
          )
        )
      }

      // product_handle
      if (productHandle) {
        const needle = productHandle.toLowerCase()
        rows = rows.filter((o: any) =>
          (o.items || []).some(
            (item: any) =>
              item.product_handle &&
              item.product_handle.toLowerCase().includes(needle)
          )
        )
      }

      // metadata tag
      if (orderTag) {
        rows = rows.filter((o: any) => {
          const tags = o.metadata?.tags
          if (Array.isArray(tags)) return tags.some((t: string) => t.toLowerCase().includes(orderTag.toLowerCase()))
          if (typeof tags === "string") return tags.toLowerCase().includes(orderTag.toLowerCase())
          return false
        })
      }

      // item_count operator filter (e.g., item_count[$gt]=3)
      if (itemCount) {
        rows = rows.filter((o: any) => {
          const count = (o.items || []).length
          if (itemCount.$gt && count <= Number(itemCount.$gt)) return false
          if (itemCount.$gte && count < Number(itemCount.$gte)) return false
          if (itemCount.$lt && count >= Number(itemCount.$lt)) return false
          if (itemCount.$lte && count > Number(itemCount.$lte)) return false
          return true
        })
      }

      // Re-apply pagination after post-filtering
      const totalCount = rows.length
      const pagedRows = rows.slice(offset, offset + limit)

      logger.info(
        `[OrdersList] Post-filtered: total=${totalCount} returned=${pagedRows.length}`
      )
      log({ level: "info", module: "adminOrders", operation: "postFilter", duration: Date.now() - postFilterT0, preFilterCount: rows.length + pagedRows.length - totalCount, postFilterCount: totalCount, returnedCount: pagedRows.length })

      log({ level: "info", module: "adminOrders", operation: "listOrders", duration: Date.now() - t0, returnedCount: pagedRows.length, totalCount, status: "post_filtered" })

      return res.json({
        orders: pagedRows,
        count: totalCount,
        offset,
        limit,
      })
    }

    // ============================================================
    // 9. Standard response (no post-filtering)
    // ============================================================
    log({ level: "info", module: "adminOrders", operation: "listOrders", duration: Date.now() - t0, returnedCount: rows.length, totalCount: metadata.count, status: "success" })

    return res.json({
      orders: rows,
      count: metadata.count,
      offset: metadata.skip,
      limit: metadata.take,
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.error(`[OrdersList] Error listing orders: ${error}`)
    log({ level: "error", module: "adminOrders", operation: "listOrders", duration: Date.now() - t0, error: errorMessage })
    throw error
  }
}
