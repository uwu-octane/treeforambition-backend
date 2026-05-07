import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { Container, Heading, Text, Button, Select } from "@medusajs/ui"
import { ArrowDownTray } from "@medusajs/icons"
import { useState } from "react"
import { sdk } from "../lib/client"

const OrderExportWidget = () => {
  const [format, setFormat] = useState<"xlsx" | "pdf">("xlsx")
  const [loading, setLoading] = useState(false)

  const handleExport = async () => {
    setLoading(true)
    try {
      const response = await sdk.client.fetch(
        `/admin/orders/export?format=${format}`,
        { method: "GET" }
      )
      // Trigger file download
      const blob = new Blob([response as BlobPart], {
        type: format === "xlsx"
          ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          : "application/pdf",
      })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `orders-export.${format}`
      a.click()
      window.URL.revokeObjectURL(url)
    } catch {
      // Handle error silently
    } finally {
      setLoading(false)
    }
  }

  return (
    <Container>
      <div className="flex items-center justify-between">
        <div>
          <Heading level="h3">导出订单</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            导出订单数据为 Excel 或 PDF 格式
          </Text>
        </div>
        <div className="flex items-center gap-3">
          <Select
            value={format}
            onValueChange={(v) => setFormat(v as "xlsx" | "pdf")}
          >
            <Select.Trigger>
              <Select.Value />
            </Select.Trigger>
            <Select.Content>
              <Select.Item value="xlsx">Excel (.xlsx)</Select.Item>
              <Select.Item value="pdf">PDF</Select.Item>
            </Select.Content>
          </Select>
          <Button
            variant="secondary"
            onClick={handleExport}
            isLoading={loading}
          >
            <ArrowDownTray />
            导出
          </Button>
        </div>
      </div>
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "order.list.before",
})

export default OrderExportWidget
