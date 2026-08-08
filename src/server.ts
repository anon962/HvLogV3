import { HvLog } from "./lib/ui/hvlog/hvLog.tsx"
import { mountReact } from "./lib/utils/userscriptUtils.ts"

async function main() {
    await mountReact(HvLog, { prefix: [] })
}

declare global {
    interface Window {
        HV_LOG_IS_REMOTE?: boolean
    }
}

main()
