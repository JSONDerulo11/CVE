import { SEVERITIES, type CveApiEntry, type CveFinding, type Severity } from "@/lib/types"

function isSeverity(value: string): value is Severity {
  return SEVERITIES.some((severity) => severity === value)
}

function normalizeSeverity(severity: string): Severity {
  const lower = severity.toLowerCase()
  return isSeverity(lower) ? lower : "n/a"
}

export function mapCveReportToFindings(entries: CveApiEntry[]): CveFinding[] {
  return entries.flatMap((entry) =>
    entry.products.map((product, index) => ({
      id: `${entry.cveid}-${index}`,
      cveId: entry.cveid,
      product: product.product,
      version: product.version,
      severity: normalizeSeverity(entry.severity),
      patchAvailable: entry.patch.length > 0,
    }))
  )
}
