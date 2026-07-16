import { CveResults } from "@/components/cve-results";
import { mapCveReportToFindings } from "@/lib/cve";
import type { CveApiEntry } from "@/lib/types";

export default async function Home() {
  const data = await fetch("https://dummyjson.com/c/6b25-ad69-4222-b625");
  const cveReport: CveApiEntry[] = await data.json();
  const findings = mapCveReportToFindings(cveReport);

  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-background font-sans text-foreground">
      <main className="w-full max-w-6xl space-y-4 bg-background p-8">
        <CveResults findings={findings} />
      </main>
    </div>
  );
}
