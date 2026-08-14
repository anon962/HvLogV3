import { WorkerPoolN, readUrl } from "myutils"
import { registerLogExport } from "./commands/registerLegacyImport.tsx"
import { registerViewLogs } from "./commands/registerViewLogs.ts"
import { HvLog } from "./lib/ui/hvlog/hvLog.tsx"
import { mountReact } from "./lib/utils/miscUtils.ts"

async function main() {
    window.HV_LOG.workerPool = new WorkerPoolN.Pool()

    const { parts } = readUrl()
    if (parts[0] === "hvlog") {
        document.title = "HvLog"
        document.body.innerHTML = ""

        const hostEl = document.createElement("div")
        document.body.appendChild(hostEl)
        hostEl.classList.add("hvlog-container")

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

    registerLogExport()
    registerViewLogs()
}

main()
