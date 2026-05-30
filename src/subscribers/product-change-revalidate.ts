import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import type { Logger } from "@medusajs/framework/types"

const STOREFRONT_URL = process.env.STOREFRONT_URL ?? "http://localhost:8000"
const REVALIDATION_SECRET = process.env.REVALIDATION_SECRET ?? "tfa-revalidate"

export default async function productChangeRevalidateHandler({
  event: { name, data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger: Logger = container.resolve("logger")

  try {
    const res = await fetch(`${STOREFRONT_URL}/api/revalidate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret: REVALIDATION_SECRET }),
    })

    if (!res.ok) {
      logger.warn(
        `[CacheRevalidate] ${name} for ${data.id}: storefront returned ${res.status}`
      )
      return
    }

    logger.info(`[CacheRevalidate] ${name} for ${data.id}: home + /products purged`)
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    logger.warn(`[CacheRevalidate] ${name} for ${data.id}: ${msg}`)
  }
}

export const config: SubscriberConfig = {
  event: ["product.created", "product.updated"],
}
