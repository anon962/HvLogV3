import { GM_registerMenuCommand } from "vite-plugin-monkey/dist/client"
import { ExportDialog } from "../ui/exportDialog/exportDialog"
import { ImportDialog } from "../ui/importDialog/importDialog"
import { mountReact } from "../utils/userscriptUtils"
import { App } from "./app"

export function registerLogExport(app: App) {
    openDialog(app, "import")

    GM_registerMenuCommand(
        "Export Logs",
        () => openDialog(app, "export"),
        {
            id: "export_logs",
        }
    )

    GM_registerMenuCommand(
        "Import Logs",
        () => openDialog(app, "import"),
        {
            id: "import_logs",
        }
    )
}

async function openDialog(app: App, type: "import" | "export") {
    const oldEl = document.querySelector("#hvlog_import_export")
    if (oldEl !== null) {
        oldEl.dispatchEvent(new CustomEvent("unmountme"))
    }

    const rootEl = document.createElement("div")
    rootEl.id = "hvlog_import_export"
    document.body.appendChild(rootEl)

    const component = type === "export" ? ExportDialog : ImportDialog
    mountReact(component, app, rootEl)
}
