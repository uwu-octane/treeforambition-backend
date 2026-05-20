import { POST as previewLoginPost } from "../store/preview-login/route"
import {
  TEST_CUSTOMER,
  createMedusaRequest,
  createMedusaResponse,
  createScope,
  muteRouteLogs,
} from "./route-test-utils"

muteRouteLogs()

describe("POST /store/preview-login", () => {
  const originalFetch = global.fetch

  afterEach(() => {
    global.fetch = originalFetch
  })

  test("authenticates the configured preview test account", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(
        Response.json({ token: "jwt_test_customer" })
      )
      .mockResolvedValueOnce(
        Response.json({ customer: { id: TEST_CUSTOMER.id } })
      )
      .mockResolvedValueOnce(
        Response.json({ customer: { id: TEST_CUSTOMER.id }, addresses: [] })
      )
      .mockResolvedValueOnce(
        Response.json({
          addresses: [
            {
              id: "addr_test",
              metadata: { source: "preview_test_customer" },
            },
          ],
        })
      )
    global.fetch = fetchMock as any

    const customerExtension = {
      createCustomerExtensions: jest.fn().mockResolvedValue({ id: "ext_test" }),
      listAndCountCustomerExtensions: jest.fn().mockResolvedValue([[]]),
      updateCustomerExtensions: jest.fn(),
    }
    const res = createMedusaResponse()

    await previewLoginPost(
      createMedusaRequest({
        headers: {
          host: "localhost:9000",
          "x-publishable-api-key": "pk_test",
        },
        scope: createScope({ customerExtension }),
        validatedBody: { returnTo: "/user" },
      }),
      res
    )

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:9000/auth/customer/emailpass",
      expect.objectContaining({
        body: JSON.stringify({
          email: TEST_CUSTOMER.email,
          password: TEST_CUSTOMER.password,
        }),
        method: "POST",
      })
    )
    expect(customerExtension.createCustomerExtensions).toHaveBeenCalledWith(
      expect.objectContaining({
        customerId: TEST_CUSTOMER.id,
        wechatLastLoginSource: "service_h5",
      })
    )
    expect(res.body).toEqual({ token: "jwt_test_customer" })
  })
})
