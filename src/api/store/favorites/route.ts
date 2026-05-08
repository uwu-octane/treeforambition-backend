import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ToggleFavoriteSchemaType } from "./middlewares"

const log = (entry: Record<string, unknown>) => {
  console.log(JSON.stringify({ ts: new Date().toISOString(), ...entry }))
}

export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const t0 = Date.now()
  const customerId = req.auth_context.actor_id
  const favoriteService = req.scope.resolve("favorite")
  const productService: any = req.scope.resolve("product")
  const logger = req.scope.resolve("logger")

  log({ level: "info", module: "backend-store-favorites", operation: "listFavorites", customerId })

  const t1 = Date.now()
  const favorites: any[] = await favoriteService.listFavorites({
    customerId,
  })
  log({ level: "info", module: "backend-store-favorites", operation: "listFavoritesQuery", duration: Date.now() - t1, customerId, favoriteCount: favorites.length })

  // Resolve product details for each favorite
  const resolvedFavorites: any[] = []

  for (const fav of favorites) {
    let product: any = null

    // Try resolving by productId first, then by handle (slug)
    if (fav.productId) {
      try {
        const t2 = Date.now()
        product = await productService.retrieveProduct(fav.productId, {
          select: ["id", "title", "handle"],
        })
        log({ level: "info", module: "backend-store-favorites", operation: "retrieveProductById", duration: Date.now() - t2, productId: fav.productId, favoriteId: fav.id })
      } catch {
        // Product not found by ID, try handle
      }
    }

    if (!product) {
      try {
        const t3 = Date.now()
        const products: any[] = await productService.listProducts({
          handle: fav.productSlug,
        })
        log({ level: "info", module: "backend-store-favorites", operation: "listProductsByHandle", duration: Date.now() - t3, productSlug: fav.productSlug, favoriteId: fav.id, found: products.length > 0 })
        if (products.length > 0) {
          product = {
            id: products[0].id,
            title: products[0].title,
            handle: products[0].handle,
          }
        }
      } catch {
        // Product not found
      }
    }

    resolvedFavorites.push({
      id: fav.id,
      customerId: fav.customerId,
      productSlug: fav.productSlug,
      productId: fav.productId || null,
      savedAt: fav.savedAt instanceof Date
        ? fav.savedAt.toISOString()
        : String(fav.savedAt),
      product,
    })
  }

  logger.info(`Favorites retrieved for customer: ${customerId}`)
  log({ level: "info", module: "backend-store-favorites", operation: "listFavorites", duration: Date.now() - t0, customerId, resolvedCount: resolvedFavorites.length, status: "success" })

  return res.json({
    favorites: resolvedFavorites,
    favoriteProductSlugs: resolvedFavorites.map((f: any) => f.productSlug),
  })
}

export async function POST(
  req: AuthenticatedMedusaRequest<ToggleFavoriteSchemaType>,
  res: MedusaResponse
) {
  const t0 = Date.now()
  const customerId = req.auth_context.actor_id
  const { productSlug } = req.validatedBody
  const favoriteService: any = req.scope.resolve("favorite")
  const productService: any = req.scope.resolve("product")
  const logger = req.scope.resolve("logger")

  log({ level: "info", module: "backend-store-favorites", operation: "toggleFavorite", customerId, productSlug })

  // Check if already favorited
  const t1 = Date.now()
  const existing: any[] = await favoriteService.listFavorites({
    customerId,
    productSlug,
  })
  log({ level: "info", module: "backend-store-favorites", operation: "checkExisting", duration: Date.now() - t1, customerId, productSlug, existingCount: existing.length })

  let favorited: boolean

  if (existing.length > 0) {
    // Remove favorite
    const t2 = Date.now()
    await favoriteService.deleteFavorites(existing[0].id)
    favorited = false
    logger.info(`Favorite removed: customer=${customerId}, productSlug=${productSlug}`)
    log({ level: "info", module: "backend-store-favorites", operation: "deleteFavorite", duration: Date.now() - t2, customerId, productSlug, favoriteId: existing[0].id })
  } else {
    // Resolve product ID from slug
    let productId: string | undefined
    try {
      const t3 = Date.now()
      const products: any[] = await productService.listProducts({
        handle: productSlug,
      })
      log({ level: "info", module: "backend-store-favorites", operation: "resolveProductId", duration: Date.now() - t3, productSlug, found: products.length > 0 })
      if (products.length > 0) {
        productId = products[0].id
      }
    } catch {
      // Product not found, still create favorite with slug only
    }

    // Add favorite
    const t4 = Date.now()
    await favoriteService.createFavorites({
      productSlug,
      customerId,
      savedAt: new Date(),
      productId: productId || undefined,
    })
    favorited = true
    logger.info(`Favorite added: customer=${customerId}, productSlug=${productSlug}`)
    log({ level: "info", module: "backend-store-favorites", operation: "createFavorite", duration: Date.now() - t4, customerId, productSlug, productId })
  }

  // Return updated favorites list
  const t5 = Date.now()
  const updatedFavorites: any[] = await favoriteService.listFavorites({
    customerId,
  })
  log({ level: "info", module: "backend-store-favorites", operation: "relistFavorites", duration: Date.now() - t5, customerId, updatedCount: updatedFavorites.length })

  log({ level: "info", module: "backend-store-favorites", operation: "toggleFavorite", duration: Date.now() - t0, customerId, productSlug, favorited, status: "success" })

  return res.json({
    favorited,
    message: favorited ? "已加入收藏。" : "已取消收藏。",
    favorites: updatedFavorites.map((f: any) => ({
      id: f.id,
      productSlug: f.productSlug,
      savedAt: f.savedAt instanceof Date ? f.savedAt.toISOString() : String(f.savedAt),
    })),
    favoriteProductSlugs: updatedFavorites.map((f: any) => f.productSlug),
  })
}
