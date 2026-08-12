import { WorkerPoolN } from "myutils"
import { registerLogExport } from "./commands/registerLegacyImport.tsx"
import { HvLog } from "./lib/ui/hvlog/hvLog.tsx"
import { mountReact, readUrl } from "./lib/utils/userscriptUtils.ts"

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
}

main()
