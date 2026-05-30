import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { createScope } from "../../api/__tests__/route-test-utils"
import { config } from "../complete-order-on-delivery"
import {
  evaluateDeliveryCompletion,
  isOrderFullyDelivered,
} from "../../workflows/complete-order-on-delivery"

describe("complete order on delivery", () => {
  test("listens for fulfillment delivery events", () => {
    expect(config.event).toBe("delivery.created")
  })

  test("treats an order as fully delivered when every item quantity is delivered", () => {
    expect(
      isOrderFullyDelivered({
        id: "order_test",
        items: [
          { quantity: 1, detail: { delivered_quantity: 1 } },
          { quantity: "2", detail: { delivered_quantity: "2" } },
        ],
      })
    ).toBe(true)
  })

  test("does not treat partially delivered orders as fully delivered", () => {
    expect(
      isOrderFullyDelivered({
        id: "order_test",
        items: [
          { quantity: 2, detail: { delivered_quantity: 1 } },
        ],
      })
    ).toBe(false)
  })

  test("marks a pending fully delivered order as ready to complete", async () => {
    const link = {
      list: jest.fn().mockResolvedValue([
        {
          fulfillment_id: "ful_test",
          order_id: "order_test",
        },
      ]),
    }
    const query = {
      graph: jest.fn().mockResolvedValue({
        data: [
          {
            id: "order_test",
            status: "pending",
            canceled_at: null,
            items: [
              { quantity: 1, detail: { delivered_quantity: 1 } },
            ],
          },
        ],
      }),
    }

    const result = await evaluateDeliveryCompletion(
      createScope({
        [ContainerRegistrationKeys.LINK]: link,
        [ContainerRegistrationKeys.QUERY]: query,
      }) as any,
      "ful_test"
    )

    expect(link.list).toHaveBeenCalledWith({ fulfillment_id: "ful_test" })
    expect(query.graph).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: "order",
        filters: { id: "order_test" },
      })
    )
    expect(result).toEqual({
      fulfillment_id: "ful_test",
      order_id: "order_test",
      should_complete: true,
    })
  })

  test("skips partially delivered orders", async () => {
    const link = {
      list: jest.fn().mockResolvedValue([
        {
          fulfillment_id: "ful_test",
          order_id: "order_test",
        },
      ]),
    }
    const query = {
      graph: jest.fn().mockResolvedValue({
        data: [
          {
            id: "order_test",
            status: "pending",
            canceled_at: null,
            items: [
              { quantity: 2, detail: { delivered_quantity: 1 } },
            ],
          },
        ],
      }),
    }

    const result = await evaluateDeliveryCompletion(
      createScope({
        [ContainerRegistrationKeys.LINK]: link,
        [ContainerRegistrationKeys.QUERY]: query,
      }) as any,
      "ful_test"
    )

    expect(result).toEqual({
      fulfillment_id: "ful_test",
      order_id: "order_test",
      should_complete: false,
      reason: "not_fully_delivered",
    })
  })

  test("skips delivery events that are not linked to orders", async () => {
    const link = {
      list: jest.fn().mockResolvedValue([{ return_id: "return_test" }]),
    }
    const query = {
      graph: jest.fn(),
    }

    const result = await evaluateDeliveryCompletion(
      createScope({
        [ContainerRegistrationKeys.LINK]: link,
        [ContainerRegistrationKeys.QUERY]: query,
      }) as any,
      "ful_test"
    )

    expect(query.graph).not.toHaveBeenCalled()
    expect(result).toEqual({
      fulfillment_id: "ful_test",
      should_complete: false,
      reason: "no_order_link",
    })
  })
})
