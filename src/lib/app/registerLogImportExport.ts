import { GM_registerMenuCommand } from "vite-plugin-monkey/dist/client"
import { ExportDialog } from "../ui/exportDialog/exportDialog"
import { mountReact } from "../utils/userscriptUtils"
import { App } from "./app"

export function registerLogExport(app: App) {
    GM_registerMenuCommand("Export Logs", () => exportLogs(app), {
        id: "export_logs",
    })

    GM_registerMenuCommand("Import Logs", () => exportLogs(app), {
        id: "import_logs",
    })
}

async function exportLogs(app: App) {
    if (document.querySelector("#hvlog_import_export") !== null) {
        return
    }

    const rootEl = document.createElement("div")
    rootEl.id = "hvlog_import_export"
    document.body.appendChild(rootEl)
    const reactEl = mountReact(ExportDialog, app, rootEl)

    rootEl.addEventListener("unmountme", () => {
        reactEl.unmount()
        rootEl.remove()
    })
}
