import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { Container, Heading, Text, Badge } from "@medusajs/ui"
import { useQuery } from "@tanstack/react-query"
import { sdk } from "../lib/client"

type ProductMaterialsData = {
  coverPerson?: { name: string }
  materials: Array<{ code: string; title: string; type: string }>
  infoTemplate?: { title: string; estimatedDispatchTime: string }
}

const ProductMaterialsWidget = ({ data: product }: { data: { id: string } }) => {
  const { data: materialsData, isLoading } = useQuery<ProductMaterialsData>({
    queryFn: () =>
      sdk.client.fetch(`/admin/products/${product.id}/materials`),
    queryKey: ["product-materials", product.id],
  })

  if (isLoading || !materialsData) {
    return (
      <Container>
        <Heading level="h3">物料信息</Heading>
        <Text size="small" className="text-ui-fg-subtle">加载中...</Text>
      </Container>
    )
  }

  return (
    <Container>
      <Heading level="h3" className="mb-4">物料与物流信息</Heading>

      {materialsData.coverPerson && (
        <div className="mb-4">
          <Text size="small" weight="plus">封面人物</Text>
          <Text>{materialsData.coverPerson.name}</Text>
        </div>
      )}

      <div className="mb-4">
        <Text size="small" weight="plus">关联物料</Text>
        {materialsData.materials.length > 0 ? (
          <div className="space-y-2 mt-2">
            {materialsData.materials.map((m) => (
              <div key={m.code} className="flex items-center gap-2">
                <Badge size="small">{m.type}</Badge>
                <Text size="small">{m.title}</Text>
                <Text size="small" className="text-ui-fg-subtle">{m.code}</Text>
              </div>
            ))}
          </div>
        ) : (
          <Text size="small" className="text-ui-fg-subtle">无</Text>
        )}
      </div>

      {materialsData.infoTemplate && (
        <div>
          <Text size="small" weight="plus">物流模板</Text>
          <Text size="small">{materialsData.infoTemplate.title}</Text>
          <Text size="small" className="text-ui-fg-subtle">
            预计发货: {materialsData.infoTemplate.estimatedDispatchTime}
          </Text>
        </div>
      )}
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "product.details.after",
})

export default ProductMaterialsWidget
