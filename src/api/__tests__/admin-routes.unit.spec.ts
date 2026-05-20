import { getOrdersListWorkflow } from "@medusajs/core-flows"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { GET as adminCustomGet } from "../admin/custom/route"
import { POST as materialsImportPost } from "../admin/materials-import/route"
import { GET as orderExportGet } from "../admin/orders/export/route"
import { GET as adminOrdersGet } from "../admin/orders/route"
import { GET as productMaterialsGet } from "../admin/products/[id]/materials/route"
import { GET as salesAnalysisGet } from "../admin/sales-analysis/route"
import {
  createLogger,
  createMedusaRequest,
  createMedusaResponse,
  createScope,
  muteRouteLogs,
} from "./route-test-utils"

jest.mock("@medusajs/core-flows", () => ({
  getOrdersListWorkflow: jest.fn(),
}))

muteRouteLogs()

describe("admin API route handlers", () => {
  test("GET /admin/custom returns a health status", async () => {
    const res = createMedusaResponse()

    await adminCustomGet(createMedusaRequest(), res)

    expect(res.sendStatus).toHaveBeenCalledWith(200)
  })

  test("POST /admin/materials-import queues a materials import", async () => {
    const res = createMedusaResponse()

    await materialsImportPost(
      createMedusaRequest({
        scope: createScope({ logger: createLogger() }),
        validatedBody: { fileBase64: "dGVzdA==" },
      }),
      res
    )

    expect(res.body).toEqual(
      expect.objectContaining({
        message: "Materials import queued. Full implementation pending.",
        status: "queued",
      })
    )
  })

  test("GET /admin/sales-analysis returns order totals", async () => {
    const query = {
      graph: jest.fn().mockResolvedValue({
        data: [
          {
            items: [
              { product_id: "prod_test", quantity: 2, unit_price: 49.99 },
            ],
            total: 49.99,
          },
        ],
      }),
    }
    const res = createMedusaResponse()

    await salesAnalysisGet(
      createMedusaRequest({
        scope: createScope({
          logger: createLogger(),
          query,
        }),
      }),
      res
    )

    expect(res.body).toEqual(
      expect.objectContaining({
        totalItems: 1,
        totalOrders: 1,
        totalRevenue: 49.99,
      })
    )
    expect(res.body.byProduct).toEqual([
      { revenue: 49.99, sold: 2, title: "prod_test" },
    ])
  })

  test("GET /admin/products/:id/materials returns product materials", async () => {
    const query = {
      graph: jest
        .fn()
        .mockResolvedValueOnce({
          data: [
            {
              cover_person: { name: "Cover Person" },
              id: "prod_test",
              product_info_template: {
                estimated_dispatch_time: "3 days",
                title: "Template",
              },
            },
          ],
        })
        .mockResolvedValueOnce({
          data: [{ code: "cotton", id: "mat_test", status: "active", title: "Cotton", type: "fabric" }],
        }),
    }
    const res = createMedusaResponse()

    await productMaterialsGet(
      createMedusaRequest({
        params: { id: "prod_test" },
        scope: createScope({
          logger: createLogger(),
          query,
        }),
      }),
      res
    )

    expect(query.graph).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        entity: "product",
        filters: { id: "prod_test" },
      })
    )
    expect(res.body).toEqual({
      coverPerson: { name: "Cover Person" },
      infoTemplate: {
        estimatedDispatchTime: "3 days",
        title: "Template",
      },
      materials: [{ code: "cotton", id: "mat_test", status: "active", title: "Cotton", type: "fabric" }],
    })
  })

  test("GET /admin/orders/export returns a CSV export", async () => {
    const query = {
      graph: jest.fn().mockResolvedValue({
        data: [
          {
            created_at: "2026-05-14T00:00:00.000Z",
            display_id: 1001,
            email: "buyer@example.com",
            items: [{ product_title: "Test Product", quantity: 2 }],
            status: "completed",
            total: 49.99,
          },
        ],
      }),
    }
    const res = createMedusaResponse()

    await orderExportGet(
      createMedusaRequest({
        scope: createScope({
          logger: createLogger(),
          query,
        }),
        url: "http://localhost/admin/orders/export?format=xlsx",
      }),
      res
    )

    expect(res.setHeader).toHaveBeenCalledWith("Content-Type", "text/csv; charset=utf-8")
    expect(res.send).toHaveBeenCalledWith(expect.stringContaining("订单号,邮箱,金额,状态,创建时间,商品,数量"))
    expect(res.send).toHaveBeenCalledWith(expect.stringContaining("1001,buyer@example.com,49.99,completed"))
  })

  test("GET /admin/orders delegates to the orders list workflow", async () => {
    const run = jest.fn().mockResolvedValue({
      result: {
        metadata: { count: 1, skip: 0, take: 20 },
        rows: [{ id: "order_test" }],
      },
    })
    ;(getOrdersListWorkflow as jest.Mock).mockReturnValue({ run })
    const res = createMedusaResponse()

    await adminOrdersGet(
      createMedusaRequest({
        scope: createScope({
          [ContainerRegistrationKeys.QUERY]: { graph: jest.fn() },
          logger: createLogger(),
        }),
        url: "http://localhost/admin/orders?limit=20&offset=0",
      }),
      res
    )

    expect(run).toHaveBeenCalledWith({
      input: expect.objectContaining({
        variables: expect.objectContaining({
          filters: { is_draft_order: false },
          skip: 0,
          take: 20,
        }),
      }),
    })
    expect(res.body).toEqual({
      count: 1,
      limit: 20,
      offset: 0,
      orders: [{ id: "order_test" }],
    })
  })
})
