export const SEVERITIES = ["critical", "high", "medium", "low", "n/a"] as const
export type Severity = (typeof SEVERITIES)[number]

export const PATCH_STATUSES = ["available", "unavailable"] as const
export type PatchStatus = (typeof PATCH_STATUSES)[number]

export interface CveFinding {
  id: string
  cveId: string
  product: string
  version: string
  severity: Severity
  patchAvailable: boolean
}

export type CveApiEntry = {
  cveid: string
  severity: string
  patch: unknown[]
  products: { product: string; version: string }[]
}
