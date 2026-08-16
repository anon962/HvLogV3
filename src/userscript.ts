import { WorkerPoolN, isEqual, patchUrlChange, readUrl } from "myutils"
import { registerLogExport } from "./commands/registerLegacyImport.tsx"
import { registerViewLogs } from "./commands/registerViewLogs.ts"
import { DbN } from "./lib/db/dbN.ts"
import { HvLog } from "./lib/ui/hvlog/hvLog.tsx"
import { BattleLogger } from "./lib/utils/battleLogger.ts"
import { mountReact } from "./lib/utils/miscUtils.ts"

async function main() {
    patchUrlChange("hvlog:urlchange")
    const { parts } = readUrl()

    // Logger
    const world: DbN.HvWorld =
        parts[0] !== "isekai" || isEqual(parts.slice(0, 2), ["hvlog", "isekai"])
            ? "persistent"
            : "isekai"
    new BattleLogger({ world }).attach()

    // Log UI
    if (parts[0] === "hvlog") {
        window.HV_LOG.workerPool = new WorkerPoolN.Pool()

        document.title = "HvLog"
        document.body.innerHTML = ""

        const hostEl = document.createElement("div")
        document.body.appendChild(hostEl)
        hostEl.classList.add("hvlog-container")
        hostEl.classList.add("dark")

        await mountReact(
            HvLog,
            { prefix: ["hvlog"] },
            {
                target: {
                    hostEl,
                },
            },
        )
    }

    // Userscript extension UI
    registerLogExport()
    registerViewLogs()
}

main()
