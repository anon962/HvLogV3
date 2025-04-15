import { isEqual, sleep } from "radash"
import { unsafeWindow } from "vite-plugin-monkey/dist/client/index"
import { App } from "./lib/app/app"
import { registerClearCache } from "./lib/app/registerClearCache.ts"
import { registerLogExport } from "./lib/app/registerLogImportExport.ts"
import { registerViewConfig } from "./lib/app/registerViewConfig.ts"
import { registerViewLogs } from "./lib/app/registerViewLogs"
import { ConfigEditor } from "./lib/ui/configEditor/configEditor.tsx"
import { EquipLog } from "./lib/ui/equipLog/equipLog.tsx"
import { HvLog } from "./lib/ui/hvlog/hvLog.tsx"
import {
    mountReact,
    patchClearInterval,
    readUrlPath,
} from "./lib/utils/userscriptUtils.ts"

// @todo: readme
// @todo: updateUrl downloadUrl
// @todo: deletable
// @todo: damage taken
// @todo: aggregate drops
// @todo: display errors
// @todo: hard-coded name of melee attacks (* Strike) because these can be indistinguishable from spell hits

// @todo: live stats
// @todo: aggregate log stats - last 90d, last 90 arenas, etc
// @todo: debug flag - disable localstorage reads
// @todo: debug console
// @todo: self-hosted ui
// @todo: heal %maxhp
// @todo: router

async function main() {
    const app = await App.ainit()
    unsafeWindow.HV_LOG = app

    registerViewLogs(app)
    registerViewConfig(app)
    registerLogExport(app)
    registerClearCache(app)

    const path = readUrlPath().parts

    if (isEqual(path, ["hvlog", "logs"])) {
        runLogCompression(app)
        return mountReact(HvLog, app)
    } else if (isEqual(path, ["hvlog", "config"])) {
        runLogCompression(app)
        return mountReact(ConfigEditor, app)
    } else if (isEqual(path, ["hvlog", "equips"])) {
        runLogCompression(app)
        return mountReact(EquipLog, app)
    } else {
        await app.runLogger()
    }
}

async function runLogCompression(app: App) {
    while (true) {
        app.db.compressLogs()
        await sleep(30 * 60_000)
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
