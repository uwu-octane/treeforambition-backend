import { PREVIEW_PAYMENT_MODE as PREVIEW_PAYMENT_MODE_ENV } from "../../lib/env"

export const PREVIEW_PAYMENT_MODES = ["mock_success", "mock_fail"] as const

export type PreviewPaymentMode = (typeof PREVIEW_PAYMENT_MODES)[number]

export function getPreviewPaymentMode(): PreviewPaymentMode | null {
  const mode = PREVIEW_PAYMENT_MODE_ENV
  if (mode && PREVIEW_PAYMENT_MODES.includes(mode as any)) {
    return mode as PreviewPaymentMode
  }
  return null
}

export function isPreviewMockPaymentEnabled(): boolean {
  return getPreviewPaymentMode() !== null
}

export function isMockSuccess(): boolean {
  return getPreviewPaymentMode() === "mock_success"
}

export function isMockFail(): boolean {
  return getPreviewPaymentMode() === "mock_fail"
}

export function makeMockId(): string {
  return `mock_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`
}
