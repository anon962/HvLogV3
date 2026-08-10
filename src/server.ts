import { HvLog } from "./lib/ui/hvlog/hvLog.tsx"
import { mountReact } from "./lib/utils/userscriptUtils.ts"

async function main() {
    await mountReact(
        HvLog,
        { prefix: [] },
        { target: { hostEl: document.body }, skipStyles: true },
    )
}

main()
