import { registerLogExport } from "./commands/registerLogImportExport.tsx"
import { HvLog } from "./lib/ui/hvlog/hvLog.tsx"
import { mountReact, readUrl } from "./lib/utils/userscriptUtils.ts"

async function main() {
    registerLogExport()

    const { parts } = readUrl()
    if (parts[0] === "hvlog") {
        document.title = "HvLog"
        document.body.innerHTML = ""
        document.body.classList.add("hvlog-container")
        await mountReact(
            HvLog,
            { prefix: ["hvlog"] },
            {
                target: {
                    hostEl: document.body,
                },
            },
        )
    }
}

main()
