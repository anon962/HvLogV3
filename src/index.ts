import { CompleteLog } from "./lib/logDb/schema.ts"
import { DetailsSummary } from "./lib/summary"
import { HvLog } from "./lib/ui/hvlog/hvLog.tsx"
import { mountReact } from "./lib/utils/userscriptUtils.ts"

async function main() {
    await mountReact(HvLog, {})
}

declare global {
    interface Window {
        // @todo: spaghetti
        HV_LOG: {
            apiData: {
                logs?: Array<CompleteLog>
                details: Array<Omit<DetailsSummary, "finances" | "indexMap">>
                username?: string
            }
        }
        HV_LOG_PRICES: Record<string, number>
    }
}

main()
