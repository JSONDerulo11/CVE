export type Severity = "critical" | "high" | "medium" | "low" | "n/a"

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
