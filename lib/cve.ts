import type { CveApiEntry, CveFinding, Severity } from "@/lib/types"

const knownSeverities = new Set<string>(["critical", "high", "medium", "low", "n/a"])

function isSeverity(value: string): value is Severity {
  return knownSeverities.has(value)
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
