import { WorkerPoolN } from "myutils"
import { UserscriptConfig } from "./db/userscriptConfig"
import { init, compress, decompress } from "@bokuweb/zstd-wasm"

export {}

declare global {
    interface Window {
        HV_LOG: {
            isRemote?: boolean
            zstdInit?: Promise<void>
            workerPool: WorkerPoolN.Pool
            userscriptConfig: UserscriptConfig
        }

        unsafeWindow: Window

        GM_registerMenuCommand: (
            name: string,
            open: (ev: MouseEvent | KeyboardEvent) => void,
            // https://violentmonkey.github.io/api/gm/
            // https://www.tampermonkey.net/documentation.php?locale=en&q=GM_registerMenuCommand
            options?: {
                id?: string
                icon?: string
                title?: string
                autoclose?: boolean
                // TM
                accessKey?: string
            },
        ) => void
    }

    var zstdWasm: {
        init: typeof init
        compress: typeof compress
        decompress: typeof decompress
    }
}
