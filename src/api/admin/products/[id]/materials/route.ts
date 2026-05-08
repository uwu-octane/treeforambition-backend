import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

const log = (entry: Record<string, unknown>) => {
  console.log(JSON.stringify({ ts: new Date().toISOString(), ...entry }))
}

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
) {
  const t0 = Date.now()
  const { id } = req.params
  const query = req.scope.resolve("query")
  const logger = req.scope.resolve("logger")

  log({ level: "info", module: "productMaterials", operation: "getProductMaterials", productId: id })

  logger.info(`[ProductMaterials] Fetching for product ${id}`)

  try {
    const queryT0 = Date.now()
    const { data: products } = await query.graph({
      entity: "product",
      fields: [
        "id",
        "title",
        "metadata",
        "cover_person.*",
        "product_info_template.*",
        "product_info_template.shipping_methods.*",
      ],
      filters: { id },
    })
    log({ level: "info", module: "productMaterials", operation: "queryProduct", duration: Date.now() - queryT0, productId: id, entity: "product", filterKeys: "id", found: products.length > 0 })

    const product = products[0] as any
    if (!product) {
      log({ level: "warn", module: "productMaterials", operation: "getProductMaterials", duration: Date.now() - t0, productId: id, status: "not_found" })
      return res.status(404).json({ error: "Product not found" })
    }

    const queryT1 = Date.now()
    const { data: materialLinks } = await query.graph({
      entity: "material",
      fields: ["id", "code", "title", "type", "status"],
    })
    log({ level: "info", module: "productMaterials", operation: "queryMaterials", duration: Date.now() - queryT1, entity: "material", materialCount: materialLinks.length })

    log({ level: "info", module: "productMaterials", operation: "getProductMaterials", duration: Date.now() - t0, productId: id, hasCoverPerson: !!product.cover_person, materialCount: materialLinks.length, hasInfoTemplate: !!product.product_info_template, status: "success" })

    res.json({
      coverPerson: product.cover_person
        ? { name: product.cover_person.name }
        : undefined,
      materials: materialLinks || [],
      infoTemplate: product.product_info_template
        ? {
            title: product.product_info_template.title,
            estimatedDispatchTime:
              product.product_info_template.estimated_dispatch_time,
          }
        : undefined,
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.error(`[ProductMaterials] Error: ${error}`)
    log({ level: "error", module: "productMaterials", operation: "getProductMaterials", duration: Date.now() - t0, productId: id, error: errorMessage })
    res.status(500).json({ error: "Failed to fetch product materials" })
  }
}
