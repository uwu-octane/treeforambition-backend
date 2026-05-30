import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Container, Heading, Text, Table } from "@medusajs/ui"
import { useQuery } from "@tanstack/react-query"
import { sdk } from "../lib/client"

type LeaderboardEntry = {
  rank: number
  name: string
  note: string
  copies: number
}

type LeaderboardProduct = {
  productId: string
  totalSold: number
  entries: LeaderboardEntry[]
}

type SalesSummary = {
  totalOrders: number
  totalRevenue: number
  totalItems: number
  byProduct: Array<{ title: string; sold: number; revenue: number }>
  leaderboard: LeaderboardProduct[]
}

const SalesAnalysisPage = () => {
  const { data, isLoading, isError } = useQuery<SalesSummary>({
    queryFn: () => sdk.client.fetch("/admin/sales-analysis"),
    queryKey: ["sales-analysis"],
  })

  if (isLoading) {
    return (
      <Container>
        <Heading>销售分析</Heading>
        <Text>加载中...</Text>
      </Container>
    )
  }

  if (isError) {
    return (
      <Container>
        <Heading>销售分析</Heading>
        <Text className="text-ui-fg-error">加载失败，请稍后重试</Text>
      </Container>
    )
  }

  return (
    <Container>
      <Heading level="h1" className="mb-4">销售分析</Heading>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="shadow-elevation-card-rest bg-ui-bg-component rounded-md p-4">
          <Text size="small" className="text-ui-fg-subtle">已付款订单数</Text>
          <Heading level="h2">{data?.totalOrders ?? 0}</Heading>
        </div>
        <div className="shadow-elevation-card-rest bg-ui-bg-component rounded-md p-4">
          <Text size="small" className="text-ui-fg-subtle">总收入</Text>
          <Heading level="h2">¥{(data?.totalRevenue ?? 0).toLocaleString()}</Heading>
        </div>
        <div className="shadow-elevation-card-rest bg-ui-bg-component rounded-md p-4">
          <Text size="small" className="text-ui-fg-subtle">总件数</Text>
          <Heading level="h2">{data?.totalItems ?? 0}</Heading>
        </div>
      </div>

      <Heading level="h2" className="mb-4">按商品统计</Heading>
      <Table>
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell>商品</Table.HeaderCell>
            <Table.HeaderCell>销量</Table.HeaderCell>
            <Table.HeaderCell>收入</Table.HeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {(data?.byProduct ?? []).map((p) => (
            <Table.Row key={p.title}>
              <Table.Cell>{p.title}</Table.Cell>
              <Table.Cell>{p.sold}</Table.Cell>
              <Table.Cell>¥{p.revenue.toLocaleString()}</Table.Cell>
            </Table.Row>
          ))}
          {data?.byProduct?.length === 0 && (
            <Table.Row>
              <Table.Cell colSpan={3} className="text-center text-ui-fg-muted">
                暂无数据
              </Table.Cell>
            </Table.Row>
          )}
        </Table.Body>
      </Table>

      <Heading level="h2" className="mt-8 mb-4">销售排行（前5名客户）</Heading>
      {(data?.leaderboard ?? []).map((product) => (
        <div key={product.productId} className="mb-6">
          <Text size="small" className="text-ui-fg-subtle mb-2">
            产品 {product.productId} — 总销量 {product.totalSold}
          </Text>
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>排名</Table.HeaderCell>
                <Table.HeaderCell>客户</Table.HeaderCell>
                <Table.HeaderCell>备注</Table.HeaderCell>
                <Table.HeaderCell>购买数量</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {product.entries.map((entry) => (
                <Table.Row key={`${product.productId}-${entry.rank}`}>
                  <Table.Cell>#{entry.rank}</Table.Cell>
                  <Table.Cell>{entry.name}</Table.Cell>
                  <Table.Cell>{entry.note}</Table.Cell>
                  <Table.Cell>{entry.copies}</Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        </div>
      ))}
      {data?.leaderboard?.length === 0 && (
        <Text className="text-ui-fg-muted">暂无排行数据</Text>
      )}
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "销售分析",
  icon: "chart-bar",
})

export default SalesAnalysisPage
