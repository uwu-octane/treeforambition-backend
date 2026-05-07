import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
) {
  const { id } = req.params
  const query = req.scope.resolve("query")
  const logger = req.scope.resolve("logger")

  logger.info(`[ProductMaterials] Fetching for product ${id}`)

  try {
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

    const product = products[0] as any
    if (!product) {
      return res.status(404).json({ error: "Product not found" })
    }

    const { data: materialLinks } = await query.graph({
      entity: "material",
      fields: ["id", "code", "title", "type", "status"],
    })

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
    logger.error(`[ProductMaterials] Error: ${error}`)
    res.status(500).json({ error: "Failed to fetch product materials" })
  }
}
