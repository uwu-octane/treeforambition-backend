import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { GET as storeCustomGet } from "../store/custom/route"
import { DELETE as deleteAddress } from "../store/addresses/[id]/route"
import { GET as getAddresses, POST as postAddress } from "../store/addresses/route"
import { GET as customerLookupGet } from "../store/customer-lookup/route"
import { GET as customerSessionGet } from "../store/customer-session/route"
import { GET as getFavorites, POST as postFavorite } from "../store/favorites/route"
import { GET as getOrder } from "../store/orders/[id]/route"
import { GET as getOrders } from "../store/orders/route"
import { GET as getLeaderboard } from "../store/products/leaderboard/route"
import { GET as getVariantDetail } from "../store/products/variant-detail/route"
import {
  TEST_CUSTOMER,
  createLogger,
  createMedusaRequest,
  createMedusaResponse,
  createScope,
  muteRouteLogs,
} from "./route-test-utils"

jest.mock("@medusajs/medusa/core-flows", () => ({
  addShippingMethodToCartWorkflow: jest.fn(),
  completeCartWorkflow: jest.fn(),
  createCartWorkflow: jest.fn(),
  createPaymentCollectionForCartWorkflow: jest.fn(),
  updateCartWorkflow: jest.fn(),
}))

muteRouteLogs()

describe("store API route handlers", () => {
  test("GET /store/custom returns a health status", async () => {
    const res = createMedusaResponse()

    await storeCustomGet(createMedusaRequest(), res)

    expect(res.sendStatus).toHaveBeenCalledWith(200)
  })

  test("GET /store/orders lists the authenticated test customer's orders", async () => {
    const orders = [{ id: "order_test", customer_id: TEST_CUSTOMER.id }]
    const query = {
      graph: jest.fn().mockResolvedValue({ data: orders, metadata: { count: 1 } }),
    }
    const res = createMedusaResponse()

    await getOrders(
      createMedusaRequest({
        scope: createScope({
          logger: createLogger(),
          query,
        }),
      }),
      res
    )

    expect(query.graph).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: "order",
        filters: { customer_id: TEST_CUSTOMER.id },
      })
    )
    expect(res.body).toEqual({ orders, count: 1 })
  })

  test("GET /store/orders/:id returns an owned order", async () => {
    const order = { id: "order_test", customer_id: TEST_CUSTOMER.id }
    const query = {
      graph: jest.fn().mockResolvedValue({ data: [order] }),
    }
    const res = createMedusaResponse()

    await getOrder(
      createMedusaRequest({
        params: { id: order.id },
        scope: createScope({
          logger: createLogger(),
          query,
        }),
      }),
      res
    )

    expect(query.graph).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: "order",
        filters: { id: order.id },
      })
    )
    expect(res.body).toEqual({ order })
  })

  test("GET /store/addresses lists the test customer's saved addresses", async () => {
    const addresses = [{ id: "addr_test", customer_id: TEST_CUSTOMER.id }]
    const customer = {
      listCustomerAddresses: jest.fn().mockResolvedValue(addresses),
    }
    const res = createMedusaResponse()

    await getAddresses(
      createMedusaRequest({
        scope: createScope({ customer }),
      }),
      res
    )

    expect(customer.listCustomerAddresses).toHaveBeenCalledWith({
      customer_id: TEST_CUSTOMER.id,
    })
    expect(res.body).toEqual({ addresses })
  })

  test("POST /store/addresses creates an address for the test customer", async () => {
    const address = { id: "addr_test", customer_id: TEST_CUSTOMER.id }
    const customer = {
      createCustomerAddresses: jest.fn().mockResolvedValue(address),
    }
    const res = createMedusaResponse()

    await postAddress(
      createMedusaRequest({
        scope: createScope({
          customer,
          logger: createLogger(),
        }),
        validatedBody: {
          address_1: "永嘉路 000 号",
          city: "上海市",
          country_code: "cn",
        },
      }),
      res
    )

    expect(customer.createCustomerAddresses).toHaveBeenCalledWith(
      expect.objectContaining({
        address_1: "永嘉路 000 号",
        customer_id: TEST_CUSTOMER.id,
      })
    )
    expect(res.body).toEqual({ address })
  })

  test("DELETE /store/addresses/:id deletes an owned address", async () => {
    const customer = {
      deleteCustomerAddresses: jest.fn().mockResolvedValue(undefined),
      listCustomerAddresses: jest.fn().mockResolvedValue([{ id: "addr_test" }]),
    }
    const res = createMedusaResponse()

    await deleteAddress(
      createMedusaRequest({
        params: { id: "addr_test" },
        scope: createScope({
          customer,
          logger: createLogger(),
        }),
      }),
      res
    )

    expect(customer.listCustomerAddresses).toHaveBeenCalledWith({
      customer_id: TEST_CUSTOMER.id,
      id: "addr_test",
    })
    expect(customer.deleteCustomerAddresses).toHaveBeenCalledWith("addr_test")
    expect(res.body).toEqual({ success: true })
  })

  test("GET /store/customer-session assembles the test customer's profile", async () => {
    const favorite = {
      listFavorites: jest.fn().mockResolvedValue([
        { productId: "prod_test", productSlug: "test-product" },
      ]),
    }
    const customer = {
      retrieveCustomer: jest.fn().mockResolvedValue({
        created_at: "2026-05-14T00:00:00.000Z",
        email: TEST_CUSTOMER.email,
        first_name: "Tree",
        id: TEST_CUSTOMER.id,
        last_name: "Tester",
        phone: "13800000000",
      }),
    }
    const customerExtension = {
      listAndCountCustomerExtensions: jest.fn().mockResolvedValue([
        [
          {
            lastLoginAt: "2026-05-14T00:00:00.000Z",
            phone: "13800000000",
            wechatOpenId: "openid_test",
          },
        ],
      ]),
    }
    const query = {
      graph: jest.fn().mockResolvedValue({
        data: [{ id: "addr_test", is_default_shipping: true }],
      }),
    }
    const res = createMedusaResponse()

    await customerSessionGet(
      createMedusaRequest({
        scope: createScope({
          customer,
          customerExtension,
          favorite,
          logger: createLogger(),
          query,
        }),
      }),
      res
    )

    expect(customer.retrieveCustomer).toHaveBeenCalledWith(TEST_CUSTOMER.id, expect.any(Object))
    expect(res.body.customer.id).toBe(TEST_CUSTOMER.id)
    expect(res.body.favoriteProductSlugs).toBeUndefined()
    expect(res.body.favorites).toEqual([
      { product_id: "prod_test", product_slug: "test-product" },
    ])
    expect(res.body.defaultAddressID).toBe("addr_test")
  })

  test("GET /store/customer-lookup resolves a customer by phone", async () => {
    const extension = {
      customerId: TEST_CUSTOMER.id,
      phone: "13800000000",
      wechatOpenId: "openid_test",
    }
    const customerExtension = {
      listAndCountCustomerExtensions: jest.fn().mockResolvedValue([[extension]]),
    }
    const customer = {
      retrieveCustomer: jest.fn().mockResolvedValue({
        email: TEST_CUSTOMER.email,
        first_name: "Tree",
        id: TEST_CUSTOMER.id,
        last_name: "Tester",
        phone: "13800000000",
      }),
    }
    const res = createMedusaResponse()

    await customerLookupGet(
      createMedusaRequest({
        query: { phone: "13800000000" },
        scope: createScope({
          customer,
          customerExtension,
          logger: createLogger(),
        }),
      }),
      res
    )

    expect(customerExtension.listAndCountCustomerExtensions).toHaveBeenCalledWith({
      phone: "13800000000",
    })
    expect(res.body.customer.id).toBe(TEST_CUSTOMER.id)
  })

  test("GET /store/favorites returns resolved favorite products", async () => {
    const favorite = {
      listFavorites: jest.fn().mockResolvedValue([
        {
          id: "fav_test",
          customerId: TEST_CUSTOMER.id,
          productId: "prod_test",
          productSlug: "test-product",
          savedAt: new Date("2026-05-14T00:00:00.000Z"),
        },
      ]),
    }
    const product = {
      retrieveProduct: jest.fn().mockResolvedValue({
        handle: "test-product",
        id: "prod_test",
        title: "Test Product",
      }),
    }
    const res = createMedusaResponse()

    await getFavorites(
      createMedusaRequest({
        scope: createScope({
          favorite,
          logger: createLogger(),
          product,
        }),
      }),
      res
    )

    expect(product.retrieveProduct).toHaveBeenCalledWith("prod_test", expect.any(Object))
    expect(res.body.favoriteProductSlugs).toEqual(["test-product"])
  })

  test("POST /store/favorites adds a favorite for the test customer", async () => {
    const favorite = {
      createFavorites: jest.fn().mockResolvedValue({ id: "fav_test" }),
      listFavorites: jest
        .fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          {
            id: "fav_test",
            productSlug: "test-product",
            savedAt: new Date("2026-05-14T00:00:00.000Z"),
          },
        ]),
    }
    const product = {
      listProducts: jest.fn().mockResolvedValue([{ id: "prod_test" }]),
    }
    const res = createMedusaResponse()

    await postFavorite(
      createMedusaRequest({
        scope: createScope({
          favorite,
          logger: createLogger(),
          product,
        }),
        validatedBody: { productSlug: "test-product" },
      }),
      res
    )

    expect(favorite.createFavorites).toHaveBeenCalledWith(
      expect.objectContaining({
        customerId: TEST_CUSTOMER.id,
        productId: "prod_test",
        productSlug: "test-product",
      })
    )
    expect(res.body.favorited).toBe(true)
  })

  test("POST /store/checkout completes an existing priced cart for the test customer", async () => {
    const {
      completeCartWorkflow,
      createCartWorkflow,
      createPaymentCollectionForCartWorkflow,
      updateCartWorkflow,
    } = require("@medusajs/medusa/core-flows") as {
      completeCartWorkflow: jest.Mock
      createCartWorkflow: jest.Mock
      createPaymentCollectionForCartWorkflow: jest.Mock
      updateCartWorkflow: jest.Mock
    }
    const { POST: checkoutPost } = require("../store/checkout/route")
    const run = jest.fn().mockResolvedValue({
      errors: [],
      result: {
        display_id: 1001,
        id: "order_test",
      },
    })
    const paymentCollectionRun = jest.fn().mockResolvedValue({
      result: { amount: 49.99, id: "paycol_test" },
    })
    completeCartWorkflow.mockReturnValue({ run })
    createPaymentCollectionForCartWorkflow.mockReturnValue({ run: paymentCollectionRun })
    createCartWorkflow.mockReturnValue({ run: jest.fn() })
    const updateCartRun = jest.fn().mockResolvedValue({ result: undefined })
    updateCartWorkflow.mockReturnValue({ run: updateCartRun })

    const callLog: string[] = []
    const query = {
      graph: jest
        .fn()
        .mockImplementationOnce(async () => {
          callLog.push("query:address")
          return {
          data: [
            {
              address_1: "永嘉路 000 号",
              city: "上海市",
              country_code: "cn",
              customer_id: TEST_CUSTOMER.id,
              id: "addr_test",
              metadata: { recipientName: "Tree Dev Tester" },
            },
          ],
          }
        }),
    }
    const checkoutCart = {
      completed_at: null,
      currency_code: "cny",
      customer_id: TEST_CUSTOMER.id,
      id: "cart_test",
      items: [{ id: "item_test", quantity: 2, total: 49.99, unit_price: 24.995 }],
      shipping_address: { address_1: "永嘉路 000 号" },
      shipping_methods: [{ amount: 10, id: "ship_test", name: "普通快递" }],
    }
    const cart = {
      listCarts: jest.fn(async () => {
        callLog.push("cart:list")
        return [checkoutCart]
      }),
    }
    const paymentCreateSession = jest.fn(async () => {
      callLog.push("payment:create-session")
      return { id: "paysess_test" }
    })
    const payment = {
      get createPaymentSession() {
        callLog.push("payment:get-create-session")
        return paymentCreateSession
      },
    }
    const link = {
      create: jest.fn(async () => {
        callLog.push("link:create")
      }),
    }
    const res = createMedusaResponse()
    const scope = createScope({
      [ContainerRegistrationKeys.LINK]: link,
      [ContainerRegistrationKeys.QUERY]: query,
      [Modules.CART]: cart,
      [Modules.PAYMENT]: payment,
      logger: createLogger(),
    })

    await checkoutPost(
      createMedusaRequest({
        scope,
        validatedBody: {
          addressId: "addr_test",
          cartId: "cart_test",
          customerEmail: TEST_CUSTOMER.email,
          items: [],
          paymentMethod: "wechat_jsapi",
        },
      }),
      res
    )

    expect(updateCartRun).toHaveBeenCalledWith({
      input: expect.objectContaining({
        id: "cart_test",
        customer_id: TEST_CUSTOMER.id,
        shipping_address: expect.objectContaining({ address_1: "永嘉路 000 号" }),
      }),
    })
    expect(createCartWorkflow).not.toHaveBeenCalled()
    if (run.mock.calls.length === 0) {
      throw new Error(`completeCartWorkflow was not called: ${JSON.stringify(res.body)} calls=${callLog.join(",")} resolve=${JSON.stringify(scope.resolve.mock.calls)}`)
    }
    expect(paymentCollectionRun).toHaveBeenCalledWith({ input: { cart_id: "cart_test" } })
    expect(paymentCreateSession).toHaveBeenCalledWith("paycol_test", {
      amount: 49.99,
      currency_code: "cny",
      data: {},
      provider_id: "pp_system_default",
    })
    expect(run).toHaveBeenCalledWith({
      input: { id: "cart_test" },
      throwOnError: false,
    })
    expect(res.body).toEqual(
      expect.objectContaining({
        orderID: "order_test",
        orderNumber: 1001,
        paymentStatus: "paid",
        success: true,
      })
    )
  })

  test("POST /store/checkout creates legacy direct-checkout carts with frontend item prices", async () => {
    const {
      addShippingMethodToCartWorkflow,
      completeCartWorkflow,
      createCartWorkflow,
      createPaymentCollectionForCartWorkflow,
      updateCartWorkflow,
    } = require("@medusajs/medusa/core-flows") as {
      addShippingMethodToCartWorkflow: jest.Mock
      completeCartWorkflow: jest.Mock
      createCartWorkflow: jest.Mock
      createPaymentCollectionForCartWorkflow: jest.Mock
      updateCartWorkflow: jest.Mock
    }
    const { POST: checkoutPost } = require("../store/checkout/route")
    const completeRun = jest.fn().mockResolvedValue({
      errors: [],
      result: {
        display_id: 1002,
        id: "order_direct",
      },
    })
    const createCartRun = jest.fn().mockResolvedValue({
      result: { id: "cart_direct" },
    })
    const addShippingRun = jest.fn().mockResolvedValue({ result: undefined })
    const paymentCollectionRun = jest.fn().mockResolvedValue({
      result: { amount: 69.99, id: "paycol_direct" },
    })
    completeCartWorkflow.mockReturnValue({ run: completeRun })
    createCartWorkflow.mockReturnValue({ run: createCartRun })
    addShippingMethodToCartWorkflow.mockReturnValue({ run: addShippingRun })
    createPaymentCollectionForCartWorkflow.mockReturnValue({ run: paymentCollectionRun })
    updateCartWorkflow.mockReturnValue({ run: jest.fn() })

    const query = {
      graph: jest
        .fn()
        .mockResolvedValueOnce({
          data: [
            {
              address_1: "永嘉路 000 号",
              city: "上海市",
              country_code: "cn",
              customer_id: TEST_CUSTOMER.id,
              id: "addr_test",
              metadata: { recipientName: "Tree Dev Tester" },
            },
          ],
        })
        .mockResolvedValueOnce({
          data: [
            { currency_code: "eur", id: "reg_eur" },
            { currency_code: "cny", id: "reg_test" },
          ],
        })
        .mockResolvedValueOnce({ data: [{ id: "sc_test" }] })
        .mockResolvedValueOnce({
          data: [
            {
              handle: "test-product",
              id: "prod_test",
              variants: [{ id: "variant_test", sku: "sku_test", title: "Default" }],
            },
          ],
        })
        .mockResolvedValueOnce({ data: [{ id: "so_standard" }] }),
    }
    const cart = {
      listCarts: jest.fn(async () => [
        {
          completed_at: null,
          currency_code: "cny",
          customer_id: TEST_CUSTOMER.id,
          id: "cart_direct",
          items: [{ id: "item_direct", quantity: 2, total: 59.99, unit_price: 29.995 }],
          shipping_address: { address_1: "永嘉路 000 号" },
          shipping_methods: [{ amount: 10, id: "ship_direct", name: "普通快递" }],
        },
      ]),
    }
    const paymentCreateSession = jest.fn(async () => ({ id: "paysess_direct" }))
    const res = createMedusaResponse()

    await checkoutPost(
      createMedusaRequest({
        scope: createScope({
          [ContainerRegistrationKeys.QUERY]: query,
          [Modules.CART]: cart,
          [Modules.PAYMENT]: { createPaymentSession: paymentCreateSession },
          logger: createLogger(),
        }),
        validatedBody: {
          addressId: "addr_test",
          customerEmail: TEST_CUSTOMER.email,
          items: [
            {
              productId: "test-product",
              quantity: 2,
              unitPrice: 29.995,
              variantId: "variant_test",
            },
          ],
          paymentMethod: "wechat_jsapi",
          shippingMethodID: "standard",
          shippingMethodLabel: "普通快递",
          shippingUnitCount: 2,
        },
      }),
      res
    )

    expect(createCartRun).toHaveBeenCalledWith({
      input: expect.objectContaining({
        customer_id: TEST_CUSTOMER.id,
        items: [{ quantity: 2, unit_price: 29.995, variant_id: "variant_test" }],
        region_id: "reg_test",
      }),
    })
    expect(addShippingRun).toHaveBeenCalledWith({
      input: {
        cart_id: "cart_direct",
        options: [{ data: { shipping_unit_count: 2 }, id: "so_standard" }],
      },
    })
    expect(paymentCollectionRun).toHaveBeenCalledWith({ input: { cart_id: "cart_direct" } })
    expect(paymentCreateSession).toHaveBeenCalledWith("paycol_direct", {
      amount: 69.99,
      currency_code: "cny",
      data: {},
      provider_id: "pp_system_default",
    })
    expect(completeRun).toHaveBeenCalledWith({
      input: { id: "cart_direct" },
      throwOnError: false,
    })
    expect(res.body).toEqual(
      expect.objectContaining({
        orderID: "order_direct",
        orderNumber: 1002,
        paymentStatus: "paid",
        success: true,
      })
    )
  })

  test("GET /store/products/variant-detail returns product detail by slug", async () => {
    const product = { handle: "test-product", id: "prod_test", metadata: {}, title: "Test Product" }
    const query = {
      graph: jest
        .fn()
        .mockResolvedValueOnce({ data: [product] })
        .mockResolvedValueOnce({ data: [{ id: "cover_test", name: "Cover Person" }] })
        .mockResolvedValueOnce({ data: [{ id: "template_test", title: "Template" }] }),
    }
    const res = createMedusaResponse()

    await getVariantDetail(
      createMedusaRequest({
        scope: createScope({
          logger: createLogger(),
          query,
        }),
        url: "http://localhost/store/products/variant-detail?slug=test-product",
      }),
      res
    )

    expect(query.graph).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        entity: "product",
        filters: { handle: "test-product" },
      })
    )
    expect(res.body.product).toEqual(
      expect.objectContaining({
        coverPerson: { id: "cover_test", name: "Cover Person" },
        handle: "test-product",
        productInfoTemplate: { id: "template_test", title: "Template" },
      })
    )
  })

  test("GET /store/products/leaderboard returns sales leaders", async () => {
    const query = {
      graph: jest.fn().mockResolvedValue({
        data: [
          {
            customer_id: TEST_CUSTOMER.id,
            items: [
              {
                product: { handle: "test-product", metadata: {} },
                quantity: 2,
              },
            ],
          },
        ],
      }),
    }
    const customer = {
      retrieveCustomer: jest.fn().mockResolvedValue({
        first_name: "Tree",
        id: TEST_CUSTOMER.id,
        last_name: "Tester",
        phone: "13800000000",
      }),
    }
    const customerExtension = {
      listCustomerExtensions: jest.fn().mockResolvedValue([{ wechatNickname: "Tree Dev Tester" }]),
    }
    const res = createMedusaResponse()

    await getLeaderboard(
      createMedusaRequest({
        scope: createScope({
          customer,
          customerExtension,
          logger: createLogger(),
          query,
        }),
        url: "http://localhost/store/products/leaderboard?key=test&targetSlug=test-product",
      }),
      res
    )

    expect(res.body.totalSold).toBe(2)
    expect(res.body.entries).toEqual([
      expect.objectContaining({
        copies: 2,
        id: TEST_CUSTOMER.id,
      }),
    ])
  })
})
