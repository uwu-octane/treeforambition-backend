import type {
  CalculatedShippingOptionPrice,
  CalculateShippingOptionPriceDTO,
  CreateFulfillmentResult,
  CreateShippingOptionDTO,
  FulfillmentDTO,
  FulfillmentItemDTO,
  FulfillmentOption,
  FulfillmentOrderDTO,
  Logger,
  ValidateFulfillmentDataContext,
} from "@medusajs/framework/types"
import { AbstractFulfillmentProviderService } from "@medusajs/framework/utils"

type InjectedDependencies = {
  logger?: Logger
}

type LogisticsRule = {
  id: string
  name: string
  basePriceAmount: number
  incrementalPricePerUnit: number
  freeShippingThreshold: number
}

const DEFAULT_RULES: LogisticsRule[] = [
  {
    id: "sf-air",
    name: "顺丰空运",
    basePriceAmount: 23,
    incrementalPricePerUnit: 2,
    freeShippingThreshold: 50,
  },
  {
    id: "sf-ground",
    name: "顺丰陆运",
    basePriceAmount: 18,
    incrementalPricePerUnit: 2,
    freeShippingThreshold: 50,
  },
  {
    id: "standard",
    name: "普通快递",
    basePriceAmount: 10,
    incrementalPricePerUnit: 2,
    freeShippingThreshold: 50,
  },
]

const RULE_ALIASES: Record<string, string> = {
  default: "standard",
  express: "standard",
  normal: "standard",
  sf: "sf-ground",
  shunfeng: "sf-ground",
  "sf-express": "sf-ground",
  "sf-land": "sf-ground",
  standard: "standard",
  "顺丰": "sf-ground",
  "顺丰速运": "sf-ground",
  "顺丰陆运": "sf-ground",
  "顺丰空运": "sf-air",
  "普通快递": "standard",
}

const log = (entry: Record<string, unknown>) => {
  console.log(JSON.stringify({ ts: new Date().toISOString(), ...entry }))
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value)

const readString = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim() : undefined

const readNumber = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }

  return undefined
}

const positiveInteger = (value: unknown) => {
  const number = readNumber(value)
  if (typeof number !== "number") {
    return undefined
  }

  return Math.max(1, Math.floor(number))
}

const findRule = (methodId?: string | null) => {
  const normalized = methodId?.trim()
  const resolvedId = normalized ? (RULE_ALIASES[normalized] ?? normalized) : "standard"

  return DEFAULT_RULES.find((rule) => rule.id === resolvedId) ?? DEFAULT_RULES[2]
}

const resolveRule = (optionData: Record<string, unknown>, data: Record<string, unknown>) => {
  const methodId =
    readString(data.method_id) ??
    readString(data.methodId) ??
    readString(optionData.method_id) ??
    readString(optionData.methodId) ??
    readString(optionData.code) ??
    readString(optionData.id) ??
    readString(optionData.label) ??
    readString(optionData.name)
  const baseRule = findRule(methodId)

  return {
    ...baseRule,
    basePriceAmount:
      readNumber(optionData.basePriceAmount) ??
      readNumber(optionData.base_price_amount) ??
      readNumber(optionData.base_amount) ??
      readNumber(optionData.base) ??
      readNumber(optionData.price) ??
      baseRule.basePriceAmount,
    freeShippingThreshold:
      readNumber(optionData.freeShippingThreshold) ??
      readNumber(optionData.free_shipping_threshold) ??
      readNumber(optionData.free_threshold) ??
      baseRule.freeShippingThreshold,
    incrementalPricePerUnit:
      readNumber(optionData.incrementalPricePerUnit) ??
      readNumber(optionData.incremental_price_per_unit) ??
      readNumber(optionData.additional_price_per_unit) ??
      readNumber(optionData.per_unit_amount) ??
      readNumber(optionData.extra) ??
      baseRule.incrementalPricePerUnit,
  }
}

const getLineItemUnits = (item: Record<string, unknown>) => {
  const quantity = positiveInteger(item.quantity) ?? 1
  const metadata = isRecord(item.metadata) ? item.metadata : {}
  const unitsPerItem =
    positiveInteger(metadata.shipping_unit_count_per_item) ??
    positiveInteger(metadata.shippingUnitCountPerItem) ??
    1

  return quantity * unitsPerItem
}

const getShippingUnitCount = (
  data: Record<string, unknown>,
  context: CalculateShippingOptionPriceDTO["context"]
) => {
  const explicit =
    positiveInteger(data.shipping_unit_count) ??
    positiveInteger(data.shippingUnitCount) ??
    positiveInteger(data.unit_count) ??
    positiveInteger(data.quantity)

  if (explicit) {
    return explicit
  }

  const items = Array.isArray(context.items) ? context.items : []
  const total = items.reduce((sum, item) => {
    return sum + getLineItemUnits(item as unknown as Record<string, unknown>)
  }, 0)

  return Math.max(1, total || 1)
}

class TfaLogisticsProviderService extends AbstractFulfillmentProviderService {
  static identifier = "tfa-logistics"

  protected logger_: Logger | undefined

  constructor({ logger }: InjectedDependencies) {
    super()
    this.logger_ = logger
  }

  async getFulfillmentOptions(): Promise<FulfillmentOption[]> {
    return DEFAULT_RULES.map((rule) => ({
      id: rule.id,
      name: rule.name,
      basePriceAmount: rule.basePriceAmount,
      base_price_amount: rule.basePriceAmount,
      freeShippingThreshold: rule.freeShippingThreshold,
      free_shipping_threshold: rule.freeShippingThreshold,
      incrementalPricePerUnit: rule.incrementalPricePerUnit,
      incremental_price_per_unit: rule.incrementalPricePerUnit,
    }))
  }

  async validateFulfillmentData(
    optionData: Record<string, unknown>,
    data: Record<string, unknown>,
    _context: ValidateFulfillmentDataContext
  ): Promise<Record<string, unknown>> {
    const rule = resolveRule(optionData, data)

    return {
      ...data,
      method_id: rule.id,
      method_name: rule.name,
    }
  }

  async validateOption(_data: Record<string, unknown>): Promise<boolean> {
    return true
  }

  async canCalculate(_data: CreateShippingOptionDTO): Promise<boolean> {
    return true
  }

  async calculatePrice(
    optionData: CalculateShippingOptionPriceDTO["optionData"],
    data: CalculateShippingOptionPriceDTO["data"],
    context: CalculateShippingOptionPriceDTO["context"]
  ): Promise<CalculatedShippingOptionPrice> {
    const safeOptionData = isRecord(optionData) ? optionData : {}
    const safeData = isRecord(data) ? data : {}
    const rule = resolveRule(safeOptionData, safeData)
    const quantity = getShippingUnitCount(safeData, context)
    const isFreeShipping = quantity >= rule.freeShippingThreshold
    const calculatedAmount = isFreeShipping
      ? 0
      : rule.basePriceAmount + Math.max(0, quantity - 1) * rule.incrementalPricePerUnit

    log({
      level: "info",
      module: "provider-tfaLogistics",
      operation: "calculatePrice",
      methodId: rule.id,
      methodName: rule.name,
      quantity,
      calculatedAmount,
      isFreeShipping,
    })

    return {
      calculated_amount: calculatedAmount,
      is_calculated_price_tax_inclusive: false,
    }
  }

  async createFulfillment(
    data: Record<string, unknown>,
    _items: Partial<Omit<FulfillmentItemDTO, "fulfillment">>[],
    _order: Partial<FulfillmentOrderDTO> | undefined,
    fulfillment: Partial<Omit<FulfillmentDTO, "provider_id" | "data" | "items">>
  ): Promise<CreateFulfillmentResult> {
    return {
      data: {
        ...data,
        fulfillment_id: fulfillment.id,
      },
      labels: [],
    }
  }

  async cancelFulfillment(_data: Record<string, unknown>): Promise<Record<string, unknown>> {
    return {}
  }

  async getFulfillmentDocuments(_data: Record<string, unknown>): Promise<never[]> {
    return []
  }

  async createReturnFulfillment(
    fulfillment: Record<string, unknown>
  ): Promise<CreateFulfillmentResult> {
    return {
      data: fulfillment,
      labels: [],
    }
  }

  async getReturnDocuments(_data: Record<string, unknown>): Promise<never[]> {
    return []
  }

  async getShipmentDocuments(_data: Record<string, unknown>): Promise<never[]> {
    return []
  }

  async retrieveDocuments(
    _fulfillmentData: Record<string, unknown>,
    _documentType: string
  ): Promise<void> {
    return undefined
  }
}

export default TfaLogisticsProviderService
