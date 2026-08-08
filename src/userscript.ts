import { HvLog } from "./lib/ui/hvlog/hvLog.tsx"
import { mountReact, readUrl } from "./lib/utils/userscriptUtils.ts"

async function main() {
    const { parts } = readUrl()
    if (parts[0] === "hvlog") {
        await mountReact(HvLog, { prefix: ["hvlog"] })
    }
}

main()
