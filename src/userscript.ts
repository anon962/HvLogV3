import { WorkerPoolN, isEqual, patchUrlChange, readUrl } from "myutils"
import { registerLegacyLogs } from "./commands/registerLegacyLogs.tsx"
import { registerViewLogs } from "./commands/registerViewLogs.ts"
import { DbN } from "./lib/db/dbN.ts"
import { HvLog } from "./lib/ui/hvlog/hvLog.tsx"
import { BattleLogger } from "./lib/utils/battleLogger.ts"
import { mountReact } from "./lib/utils/miscUtils.ts"
import {
    DEFAULT_USERSCRIPT_CONFIG,
    loadUserscriptConfig,
} from "./lib/db/userscriptConfig.ts"
import { registerLogManager } from "./commands/registerLogManager.tsx"

async function main() {
    patchUrlChange("hvlog:urlchange")

    window.HV_LOG.userscriptConfig = DEFAULT_USERSCRIPT_CONFIG()
    loadUserscriptConfig().then(
        (config) => (window.HV_LOG.userscriptConfig = config),
    )

    const { parts } = readUrl()

    // Logger
    const world: DbN.HvWorld =
        parts[0] !== "isekai" || isEqual(parts.slice(0, 2), ["hvlog", "isekai"])
            ? "persistent"
            : "isekai"
    new BattleLogger({ world }).attach()

    // Log UI
    if (parts[0] === "hvlog") {
        init(window)
    }

    // Userscript extension UI
    registerViewLogs(init)
    registerLogManager()
    registerLegacyLogs()

    async function init(w: Window) {
        w.HV_LOG.workerPool ??= new WorkerPoolN.Pool()

        w.document.head.innerHTML = ""
        w.document.title = "HvLog"

        w.document.body.className = "hvlog-container dark"
        w.document.body.innerHTML = `<div class="hvlog-host"></div>`

        const hostEl = w.document.querySelector(".hvlog-host")!

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
}

main()
