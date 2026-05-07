import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"

function normalizeString(value: string | null | undefined): string | undefined {
  if (typeof value !== "string") return undefined
  const normalized = value.trim()
  return normalized || undefined
}

function maskPhone(phone: string): string {
  if (!phone || phone.length < 7) return phone || ""
  return phone.slice(0, 3) + "****" + phone.slice(-4)
}

function buildCustomerName({
  firstName,
  lastName,
  wechatNickname,
  phone,
}: {
  firstName?: string
  lastName?: string
  wechatNickname?: string
  phone?: string
}) {
  const displayName = [firstName, lastName].filter(Boolean).join(" ").trim()
  return displayName || wechatNickname || (phone ? `用户 ${maskPhone(phone)}` : "微信顾客")
}

function buildCustomerNote({
  firstName,
  lastName,
  wechatNickname,
  phone,
}: {
  firstName?: string
  lastName?: string
  wechatNickname?: string
  phone?: string
}) {
  const displayName = [firstName, lastName].filter(Boolean).join(" ").trim()
  if (wechatNickname && wechatNickname !== displayName) {
    return `微信昵称 ${wechatNickname}`
  }
  if (phone) {
    return `手机号 ${maskPhone(phone)}`
  }
  return "顾客支持"
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const { searchParams } = new URL(
    req.url,
    `http://${req.headers.host || "localhost"}`
  )
  const key = normalizeString(searchParams.get("key"))
  const targetSlugs = [
    ...new Set(
      searchParams
        .getAll("targetSlug")
        .map((slug) => normalizeString(slug))
        .filter((slug): slug is string => Boolean(slug))
    ),
  ]

  if (!key || targetSlugs.length === 0) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Missing valid sales targets"
    )
  }

  const query = req.scope.resolve("query")
  const logger = req.scope.resolve("logger")

  const { data: orders } = await query.graph({
    entity: "order",
    fields: [
      "id",
      "customer_id",
      "email",
      "items.product_id",
      "items.product.handle",
      "items.product.title",
      "items.product.metadata",
      "items.quantity",
    ],
    filters: {
      status: ["completed"],
    },
  })

  const targetSlugSet = new Set(targetSlugs)
  const customerCopies = new Map<string, number>()
  let totalSold = 0

  for (const order of orders) {
    const items: any[] = order.items || []
    let orderMatchedCopies = 0

    for (const item of items) {
      if (!item) continue
      const product = item.product || {}
      const handle = normalizeString(product?.handle)
      const storefrontSlug = normalizeString(product?.metadata?.storefront_slug)
      const quantity = typeof item.quantity === "number" ? item.quantity : 0

      if (quantity <= 0) continue

      const matches =
        (handle && targetSlugSet.has(handle)) ||
        (storefrontSlug && targetSlugSet.has(storefrontSlug))

      if (matches) {
        orderMatchedCopies += quantity
      }
    }

    if (orderMatchedCopies <= 0) continue

    totalSold += orderMatchedCopies

    const customerId = normalizeString(order.customer_id)
    if (customerId) {
      customerCopies.set(
        customerId,
        (customerCopies.get(customerId) ?? 0) + orderMatchedCopies
      )
    }
  }

  const sortedEntries = [...customerCopies.entries()]
    .map(([customerId, copies]) => ({
      id: customerId,
      name: "Customer",
      copies,
      note: "顾客支持",
    }))
    .sort((a, b) => {
      if (b.copies !== a.copies) return b.copies - a.copies
      return a.id.localeCompare(b.id, "en", { numeric: true })
    })
    .slice(0, 5)

  // Enrich customer entries with names and wechat data
  const customerService: any = req.scope.resolve("customer")
  const customerExtensionService = (() => {
    try {
      return req.scope.resolve("customerExtension")
    } catch {
      return null
    }
  })()

  const enrichedEntries: any[] = []

  for (const entry of sortedEntries) {
    try {
      const customer: any = await customerService.retrieveCustomer(entry.id, {
        select: ["id", "first_name", "last_name", "phone"],
      })

      let wechatNickname: string | undefined
      if (customerExtensionService) {
        try {
          const extensions: any = await customerExtensionService.listCustomerExtensions({
            filters: { customerId: entry.id },
          })
          if (extensions?.length > 0) {
            wechatNickname = extensions[0].wechatNickname || undefined
          }
        } catch {
          // customerExtension may not have listCustomerExtensions
        }
      }

      enrichedEntries.push({
        id: entry.id,
        copies: entry.copies,
        name: buildCustomerName({
          firstName: customer.first_name,
          lastName: customer.last_name,
          wechatNickname,
          phone: customer.phone,
        }),
        note: buildCustomerNote({
          firstName: customer.first_name,
          lastName: customer.last_name,
          wechatNickname,
          phone: customer.phone,
        }),
      })
    } catch {
      enrichedEntries.push(entry)
    }
  }

  logger.info(
    `Leaderboard retrieved: key=${key}, entries=${enrichedEntries.length}, totalSold=${totalSold}`
  )

  return res.json({
    entries: enrichedEntries,
    totalSold,
  })
}
