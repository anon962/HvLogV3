import { HvLog } from "./lib/ui/hvlog/hvLog.tsx"
import { mountReact } from "./lib/utils/miscUtils.ts"

async function main() {
    await mountReact(
        HvLog,
        { prefix: [] },
        { target: { hostEl: document.body }, skipStyles: true },
    )
}

main()
