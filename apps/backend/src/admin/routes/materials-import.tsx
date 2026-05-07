import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Badge, Container, Heading, Text, Button, toast } from "@medusajs/ui"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { sdk } from "../lib/client"
import { useState } from "react"

type MaterialsImportJob = {
  id: string
  status: string
  rowsProcessed: number
  rowsImported: number
  errors: Array<{ row: number; message: string }>
  createdAt: string
}

const MaterialsImportPage = () => {
  const queryClient = useQueryClient()
  const [uploading, setUploading] = useState(false)

  const { data: jobs, isLoading } = useQuery<MaterialsImportJob[]>({
    queryFn: () => sdk.client.fetch("/admin/materials-import/jobs"),
    queryKey: ["materials-import-jobs"],
  })

  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      const reader = new FileReader()
      const base64 = await new Promise<string>((resolve) => {
        reader.onload = () => resolve((reader.result as string).split(",")[1])
        reader.readAsDataURL(file)
      })
      return sdk.client.fetch("/admin/materials-import", {
        method: "POST",
        body: { fileBase64: base64 },
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["materials-import-jobs"] })
      toast.success("导入任务已提交")
    },
    onError: () => {
      toast.error("导入失败")
    },
  })

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      // First do a dry run
      const reader = new FileReader()
      const base64 = await new Promise<string>((resolve) => {
        reader.onload = () => resolve((reader.result as string).split(",")[1])
        reader.readAsDataURL(file)
      })
      const dryRun = await sdk.client.fetch("/admin/materials-import/dry-run", {
        method: "POST",
        body: { fileBase64: base64 },
      })
      // Show dry run results then ask for confirmation
      toast.info(`预览：${(dryRun as any).rowsToImport ?? 0} 条待导入`)
    } finally {
      setUploading(false)
    }
  }

  return (
    <Container>
      <Heading level="h1" className="mb-4">物料导入</Heading>

      <div className="mb-8">
        <Text className="mb-4">上传 Excel 文件批量导入杂志物料数据</Text>
        <input
          type="file"
          accept=".xlsx,.xls"
          onChange={handleFileUpload}
          disabled={uploading}
          className="mb-4"
        />
        {uploading && <Text>上传中...</Text>}
      </div>

      <Heading level="h2" className="mb-4">导入历史</Heading>
      {isLoading ? (
        <Text>加载中...</Text>
      ) : (
        <div className="space-y-2">
          {(jobs ?? []).map((job) => (
            <div
              key={job.id}
              className="shadow-elevation-card-rest bg-ui-bg-component rounded-md p-4"
            >
              <div className="flex items-center justify-between">
                <Text size="small">任务 {job.id}</Text>
                <Badge
                  color={job.status === "succeeded" ? "green" : job.status === "failed" ? "red" : "grey"}
                >
                  {job.status}
                </Badge>
              </div>
              <Text size="small" className="text-ui-fg-subtle">
                处理 {job.rowsProcessed} 行 / 导入 {job.rowsImported} 行
              </Text>
              {job.errors.length > 0 && (
                <div className="mt-2">
                  {job.errors.map((err, i) => (
                    <Text key={i} size="small" className="text-ui-fg-error">
                      第 {err.row} 行: {err.message}
                    </Text>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "物料导入",
  icon: "folder-open",
})

export default MaterialsImportPage
