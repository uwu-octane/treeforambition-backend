export const TEST_CUSTOMER = {
  id: "cus_test_api",
  email: "preview-test@customer.treeforambition.local",
  password: "preview-test-password-123",
}

export const TEST_USER = {
  id: "user_test_api",
  email: "admin-test@treeforambition.local",
}

export const createLogger = () => ({
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
})

export const createScope = (services: Record<string, unknown>) => ({
  resolve: jest.fn((key: string) => {
    if (Object.prototype.hasOwnProperty.call(services, key)) {
      return services[key]
    }

    throw new Error(`Missing mocked service: ${String(key)}`)
  }),
})

export const createMedusaRequest = ({
  authCustomerId = TEST_CUSTOMER.id,
  headers,
  params,
  query,
  scope,
  url = "http://localhost/test",
  validatedBody,
}: {
  authCustomerId?: string
  headers?: Record<string, string | string[]>
  params?: Record<string, string>
  query?: Record<string, unknown>
  scope?: ReturnType<typeof createScope>
  url?: string
  validatedBody?: unknown
} = {}) => {
  const requestHeaders = {
    host: "localhost",
    ...(headers ?? {}),
  }

  return {
    auth_context: {
      actor_id: authCustomerId,
    },
    get: jest.fn((name: string) => {
      const key = name.toLowerCase()
      const value = requestHeaders[key] ?? requestHeaders[name]
      return Array.isArray(value) ? value[0] : value
    }),
    headers: requestHeaders,
    params: params ?? {},
    protocol: "http",
    query: query ?? {},
    scope: scope ?? createScope({}),
    url,
    validatedBody,
  } as any
}

export const createMedusaResponse = () => {
  const res: any = {
    body: undefined,
    headers: {},
    statusCode: 200,
  }

  res.json = jest.fn((body: unknown) => {
    res.body = body
    return res
  })
  res.send = jest.fn((body: unknown) => {
    res.body = body
    return res
  })
  res.sendStatus = jest.fn((statusCode: number) => {
    res.statusCode = statusCode
    return res
  })
  res.setHeader = jest.fn((name: string, value: unknown) => {
    res.headers[name.toLowerCase()] = value
    return res
  })
  res.status = jest.fn((statusCode: number) => {
    res.statusCode = statusCode
    return res
  })

  return res
}

export const muteRouteLogs = () => {
  beforeEach(() => {
    jest.spyOn(console, "error").mockImplementation(() => undefined)
    jest.spyOn(console, "log").mockImplementation(() => undefined)
    jest.spyOn(console, "warn").mockImplementation(() => undefined)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })
}
