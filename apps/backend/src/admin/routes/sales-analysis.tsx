import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Container, Heading, Text, Table, Badge, toast } from "@medusajs/ui"
import { useQuery } from "@tanstack/react-query"
import { sdk } from "../lib/client"
import type { LoaderFunctionArgs } from "react-router-dom"

type SalesSummary = {
  totalOrders: number
  totalRevenue: number
  totalItems: number
  byPerson: Array<{ name: string; orders: number; revenue: number }>
  byProduct: Array<{ title: string; sold: number; revenue: number }>
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
          <Text size="small" className="text-ui-fg-subtle">总订单数</Text>
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

      <Heading level="h2" className="mb-4">按人物统计</Heading>
      <Table>
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell>封面人物</Table.HeaderCell>
            <Table.HeaderCell>订单数</Table.HeaderCell>
            <Table.HeaderCell>收入</Table.HeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {(data?.byPerson ?? []).map((p) => (
            <Table.Row key={p.name}>
              <Table.Cell>{p.name}</Table.Cell>
              <Table.Cell>{p.orders}</Table.Cell>
              <Table.Cell>¥{p.revenue.toLocaleString()}</Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table>

      <Heading level="h2" className="mt-8 mb-4">按商品统计</Heading>
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
        </Table.Body>
      </Table>
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "销售分析",
  icon: "chart-bar",
})

export default SalesAnalysisPage
