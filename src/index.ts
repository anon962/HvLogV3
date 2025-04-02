import { isEqual } from "radash"
import { App } from "./lib/app/app"
import { registerClearCache } from "./lib/app/registerClearCache.ts"
import { registerLogExport } from "./lib/app/registerLogImportExport.ts"
import { registerViewConfig } from "./lib/app/registerViewConfig.ts"
import { registerViewLogs } from "./lib/app/registerViewLogs"
import { ConfigEditor } from "./lib/ui/configEditor/configEditor.tsx"
import { HvLog } from "./lib/ui/hvlog/hvLog.tsx"
import {
    mountReact,
    patchClearInterval,
    readUrlPath,
} from "./lib/utils/userscriptUtils.ts"

// @todo: compression - 48144 turns = 599045 events = 6.7738e+7 bytes = 4089446.4 bytes compressed (5%)
// @todo: reparse errors
// @todo: test db migration

// @todo: sort
// @todo: filter
// @todo: live stats
// @todo: debug flag - disable localstorage reads
// @todo: debug console
// @todo: self-hosted ui
// @todo: heal %maxhp

async function main() {
    const app = await App.ainit()

    registerViewLogs(app)
    registerViewConfig(app)
    registerLogExport(app)
    registerClearCache(app)

    const path = readUrlPath().parts

    if (isEqual(path, ["hvlog", "logs"])) {
        return mountReact(HvLog, app)
    } else if (isEqual(path, ["hvlog", "config"])) {
        return mountReact(ConfigEditor, app)
    } else {
        await app.runLogger()
    }
}

declare global {
    interface Window {
        HV_LOG: App
        HV_LOG_INIT_STYLES: () => void
    }
}

patchClearInterval()

main()
