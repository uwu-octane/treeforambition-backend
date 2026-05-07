import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "zod"

export const ImportBodySchema = z.object({
  fileBase64: z.string().min(1),
})

export type ImportBody = z.infer<typeof ImportBodySchema>

export async function POST(
  req: MedusaRequest<ImportBody>,
  res: MedusaResponse
) {
  const logger = req.scope.resolve("logger")

  try {
    const { fileBase64 } = req.validatedBody

    logger.info(`[MaterialsImport] Import job queued, file size: ${fileBase64.length} bytes`)

    // TODO: Decode base64, parse CSV/XLSX, and queue material import job
    // For now, return mock success
    res.json({
      id: `import_${Date.now().toString(36)}`,
      status: "queued",
      rowsToImport: 0,
      message: "Materials import queued. Full implementation pending.",
    })
  } catch (error) {
    logger.error(`[MaterialsImport] Error: ${error}`)
    res.status(500).json({
      id: null,
      status: "error",
      message: error instanceof Error ? error.message : "Import failed",
    })
  }
}
