import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "zod"

const log = (entry: Record<string, unknown>) => {
  console.log(JSON.stringify({ ts: new Date().toISOString(), ...entry }))
}

export const ImportBodySchema = z.object({
  fileBase64: z.string().min(1),
})

export type ImportBody = z.infer<typeof ImportBodySchema>

export async function POST(
  req: MedusaRequest<ImportBody>,
  res: MedusaResponse
) {
  const t0 = Date.now()
  const logger = req.scope.resolve("logger")

  try {
    const { fileBase64 } = req.validatedBody

    log({ level: "info", module: "materialsImport", operation: "importMaterials", fileSize: fileBase64.length })

    logger.info(`[MaterialsImport] Import job queued, file size: ${fileBase64.length} bytes`)

    // TODO: Decode base64, parse CSV/XLSX, and queue material import job
    // For now, return mock success
    log({ level: "info", module: "materialsImport", operation: "importMaterials", duration: Date.now() - t0, fileSize: fileBase64.length, status: "queued" })

    res.json({
      id: `import_${Date.now().toString(36)}`,
      status: "queued",
      rowsToImport: 0,
      message: "Materials import queued. Full implementation pending.",
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    log({ level: "error", module: "materialsImport", operation: "importMaterials", duration: Date.now() - t0, error: errorMessage })
    logger.error(`[MaterialsImport] Error: ${error}`)
    res.status(500).json({
      id: null,
      status: "error",
      message: errorMessage,
    })
  }
}
