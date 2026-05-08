import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "zod"

const log = (entry: Record<string, unknown>) => {
  console.log(JSON.stringify({ ts: new Date().toISOString(), ...entry }))
}

export const ExportQuerySchema = z.object({
  format: z.enum(["xlsx", "pdf"]).default("xlsx"),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
})

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
) {
  const t0 = Date.now()
  const query = req.scope.resolve("query")
  const logger = req.scope.resolve("logger")
  const searchParams = new URL(req.url, `http://${req.headers.host || "localhost"}`).searchParams
  const params = ExportQuerySchema.parse({
    format: searchParams.get("format") || "xlsx",
    startDate: searchParams.get("startDate") || undefined,
    endDate: searchParams.get("endDate") || undefined,
  })

  log({ level: "info", module: "orderExport", operation: "exportOrders", format: params.format, startDate: params.startDate, endDate: params.endDate })

  logger.info(`[OrderExport] Exporting as ${params.format}`)

  try {
    const queryT0 = Date.now()
    const { data: orders } = await query.graph({
      entity: "order",
      fields: [
        "id",
        "display_id",
        "email",
        "total",
        "currency_code",
        "status",
        "created_at",
        "shipping_address.*",
        "items.*",
        "items.product_title",
        "items.quantity",
        "items.unit_price",
      ],
      filters: {
        ...(params.startDate || params.endDate ? {
          created_at: {
            ...(params.startDate ? { $gte: params.startDate } : {}),
            ...(params.endDate ? { $lte: params.endDate } : {}),
          },
        } : {}),
      },
      pagination: { take: 500, skip: 0 },
    })
    log({ level: "info", module: "orderExport", operation: "queryOrders", duration: Date.now() - queryT0, entity: "order", orderCount: orders.length, filterKeys: "created_at" })

    if (params.format === "xlsx") {
      // Generate simple CSV for now (full XLSX generation with ExcelJS would be in a separate module)
      const headers = ["订单号", "邮箱", "金额", "状态", "创建时间", "商品", "数量"]
      const rows = orders.flatMap((o) =>
        (o.items || []).map((item: any) => [
          o.display_id || o.id,
          o.email,
          o.total,
          o.status,
          o.created_at,
          item.product_title || item.product_id,
          item.quantity,
        ])
      )
      const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n")
      res.setHeader("Content-Type", "text/csv; charset=utf-8")
      res.setHeader("Content-Disposition", `attachment; filename=orders-export.csv`)

      log({ level: "info", module: "orderExport", operation: "exportOrders", duration: Date.now() - t0, format: "csv", orderCount: orders.length, rowCount: rows.length, status: "success" })

      return res.send(csv)
    }

    // PDF would need PDFKit - return JSON for now
    log({ level: "info", module: "orderExport", operation: "exportOrders", duration: Date.now() - t0, format: "pdf", orderCount: orders.length, status: "unsupported" })

    res.json({
      format: "pdf",
      orderCount: orders.length,
      message: "PDF generation requires PDFKit integration (TODO)",
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.error(`[OrderExport] Error: ${error}`)
    log({ level: "error", module: "orderExport", operation: "exportOrders", duration: Date.now() - t0, error: errorMessage })
    res.status(500).json({ error: "Export failed" })
  }
}
