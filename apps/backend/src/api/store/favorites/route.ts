import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ToggleFavoriteSchemaType } from "./middlewares"

export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const customerId = req.auth_context.actor_id
  const favoriteService = req.scope.resolve("favorite")
  const productService: any = req.scope.resolve("product")
  const logger = req.scope.resolve("logger")

  const favorites: any[] = await favoriteService.listFavorites({
    customerId,
  })

  // Resolve product details for each favorite
  const resolvedFavorites: any[] = []

  for (const fav of favorites) {
    let product: any = null

    // Try resolving by productId first, then by handle (slug)
    if (fav.productId) {
      try {
        product = await productService.retrieveProduct(fav.productId, {
          select: ["id", "title", "handle"],
        })
      } catch {
        // Product not found by ID, try handle
      }
    }

    if (!product) {
      try {
        const products: any[] = await productService.listProducts({
          handle: fav.productSlug,
        })
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

  return res.json({
    favorites: resolvedFavorites,
    favoriteProductSlugs: resolvedFavorites.map((f: any) => f.productSlug),
  })
}

export async function POST(
  req: AuthenticatedMedusaRequest<ToggleFavoriteSchemaType>,
  res: MedusaResponse
) {
  const customerId = req.auth_context.actor_id
  const { productSlug } = req.validatedBody
  const favoriteService: any = req.scope.resolve("favorite")
  const productService: any = req.scope.resolve("product")
  const logger = req.scope.resolve("logger")

  // Check if already favorited
  const existing: any[] = await favoriteService.listFavorites({
    customerId,
    productSlug,
  })

  let favorited: boolean

  if (existing.length > 0) {
    // Remove favorite
    await favoriteService.deleteFavorites(existing[0].id)
    favorited = false
    logger.info(`Favorite removed: customer=${customerId}, productSlug=${productSlug}`)
  } else {
    // Resolve product ID from slug
    let productId: string | undefined
    try {
      const products: any[] = await productService.listProducts({
        handle: productSlug,
      })
      if (products.length > 0) {
        productId = products[0].id
      }
    } catch {
      // Product not found, still create favorite with slug only
    }

    // Add favorite
    await favoriteService.createFavorites({
      productSlug,
      customerId,
      savedAt: new Date(),
      productId: productId || undefined,
    })
    favorited = true
    logger.info(`Favorite added: customer=${customerId}, productSlug=${productSlug}`)
  }

  // Return updated favorites list
  const updatedFavorites: any[] = await favoriteService.listFavorites({
    customerId,
  })

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
