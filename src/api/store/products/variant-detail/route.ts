import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
) {
  const { searchParams } = new URL(
    req.url,
    `http://${req.headers.host || "localhost"}`
  )
  const slug = searchParams.get("slug")

  if (!slug) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "slug query parameter is required"
    )
  }

  const query = req.scope.resolve("query")
  const logger = req.scope.resolve("logger")

  // Query the product by handle (slug) with linked module data
  const { data: products } = await query.graph({
    entity: "product",
    fields: [
      "id",
      "title",
      "subtitle",
      "description",
      "handle",
      "status",
      "thumbnail",
      "width",
      "height",
      "weight",
      "length",
      "origin_country",
      "material",
      "type.*",
      "collection.*",
      "categories.*",
      "tags.*",
      "variants.*",
      "variants.prices.*",
      "variants.options.*",
      "images.*",
      "metadata",
      "created_at",
      "updated_at",
    ],
    filters: {
      handle: slug,
    },
  })

  if (!products || products.length === 0) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `Product not found: ${slug}`
    )
  }

  const product = products[0]

  // Resolve linked cover person data if the link exists
  let coverPerson: any = null
  try {
    const { data: linkedCoverPersons } = await query.graph({
      entity: "product_cover_person",
      fields: ["*"],
      filters: { product_id: product.id },
    })
    if (linkedCoverPersons && linkedCoverPersons.length > 0) {
      coverPerson = linkedCoverPersons[0]
    }
  } catch {
    // Link may not exist or no data
  }

  // Resolve product info template with shipping methods
  let productInfoTemplate: any = null
  try {
    const { data: templates } = await query.graph({
      entity: "product_product_info_template",
      fields: [
        "*",
        "shipping_methods.*",
      ],
      filters: { product_id: product.id },
    })
    if (templates && templates.length > 0) {
      productInfoTemplate = templates[0]
    }
  } catch {
    // Link may not exist or no data
  }

  // Resolve material information from product metadata
  let materials: any = null
  if (product.metadata && (product.metadata as any).materialCodes) {
    const materialService: any = req.scope.resolve("material")
    const materialAssetService: any = req.scope.resolve("materialAsset")
    const materialCodes: string[] = Array.isArray((product.metadata as any).materialCodes)
      ? (product.metadata as any).materialCodes
      : [(product.metadata as any).materialCodes]

    try {
      const materialRecords: any[] = await materialService.listMaterials({
        code: materialCodes,
      })

      if (materialRecords.length > 0) {
        materials = await Promise.all(
          materialRecords.map(async (mat: any) => {
            let assets: any[] = []
            try {
              const assetRefs = mat.assetRefs || []
              if (assetRefs.length > 0) {
                assets = (
                  await Promise.all(
                    assetRefs.map(async (ref: any) => {
                      try {
                        return await materialAssetService.retrieveMaterialAsset(ref.assetId)
                      } catch {
                        return null
                      }
                    })
                  )
                ).filter(Boolean)
              }
            } catch {
              // Assets not available
            }

            return {
              id: mat.id,
              code: mat.code,
              title: mat.title,
              type: mat.type,
              assets,
            }
          })
        )
      }
    } catch {
      // Materials not found
    }
  }

  logger.info(`Variant detail retrieved: slug=${slug}`)

  return res.json({
    product: {
      ...product,
      coverPerson,
      productInfoTemplate,
      materials,
    },
  })
}
