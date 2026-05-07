import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "zod"

export const ExportQuerySchema = z.object({
  format: z.enum(["xlsx", "pdf"]).default("xlsx"),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
})

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
) {
  const query = req.scope.resolve("query")
  const logger = req.scope.resolve("logger")
  const searchParams = new URL(req.url, `http://${req.headers.host || "localhost"}`).searchParams
  const params = ExportQuerySchema.parse({
    format: searchParams.get("format") || "xlsx",
    startDate: searchParams.get("startDate") || undefined,
    endDate: searchParams.get("endDate") || undefined,
  })

  logger.info(`[OrderExport] Exporting as ${params.format}`)

  try {
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
      return res.send(csv)
    }

    // PDF would need PDFKit - return JSON for now
    res.json({
      format: "pdf",
      orderCount: orders.length,
      message: "PDF generation requires PDFKit integration (TODO)",
    })
  } catch (error) {
    logger.error(`[OrderExport] Error: ${error}`)
    res.status(500).json({ error: "Export failed" })
  }
}
