import { App } from "@/lib/app/app"
import { LogDb, LogDbBackup } from "@/lib/logDb"
import "@/lib/ui/global.css"
import { compressGzip } from "@/lib/utils/miscUtils"
import { sleep } from "radash"
import { FC, useEffect, useRef, useState } from "react"
import { AppContextProvider } from "../appContext"
import { LogContextProvider } from "../hvlog/logContext"
import { XIcon } from "../icons/tailwind"
import { Button } from "../shadcn/button"

export const ExportDialog: FC<{ app: App }> = ({ app }) => {
    return (
        <AppContextProvider app={app}>
            <LogContextProvider>
                <ExportDialogInner />
            </LogContextProvider>
        </AppContextProvider>
    )
}

function ExportDialogInner() {
    const anchorEl = useRef<HTMLAnchorElement>(null)
    const dialogEl = useRef<HTMLDialogElement>(null)
    const { status, download } = useDownloader()

    useEffect(() => {
        if (anchorEl.current) {
            download(anchorEl.current)
        }
    }, [anchorEl.current])

    function onClose() {
        dialogEl.current?.dispatchEvent(
            new CustomEvent("unmountme", {
                bubbles: true,
                composed: true,
            })
        )
    }

    let statusEl
    switch (status.type) {
        case "idle":
            statusEl = <>Exporting 0 / ??? logs</>
            break
        case "loading":
            statusEl = <>{status.detail}</>
            break
        case "done":
            statusEl = <>Done! Exported {status.count} logs.</>
            break
        case "error":
            statusEl = <>Error. ${status.detail}</>
            break
    }

    return (
        <div
            onClick={() => onClose()}
            className="hvlog-dialog-container"
        >
            <dialog
                onClick={(ev) => ev.stopPropagation()}
                ref={dialogEl}
                open
                className="max-w-[30rem] max-h-[15rem] z-20 flex flex-col items-center justify-center"
            >
                <span className="text-lg font-mono pt-4 text-center">
                    {statusEl}
                </span>

                <Button
                    onClick={() => onClose()}
                    variant="ghost"
                    className="rounded-full cursor-pointer size-12 p-3! absolute top-4 right-4 hover:bg-white/40"
                    type="button"
                >
                    <XIcon className="size-full" />
                </Button>

                <a ref={anchorEl} className="hidden"></a>
            </dialog>
        </div>
    )
}

function useDownloader() {
    const [status, setStatus] = useState<
        | { type: "idle" }
        | { type: "loading"; detail: string }
        | { type: "done"; count: number }
        | { type: "error"; detail: string }
    >({
        type: "idle",
    })

    async function download(
        backup: LogDbBackup,
        anchorEl: HTMLAnchorElement,
        version: number
    ) {
        const now = new Date().toISOString()
        const asStr = backup.map((x) => JSON.stringify(x)).join("\n")
        const asCompressed = await compressGzip(asStr)
        const asBlob = new Blob(asCompressed, {
            type: "application/octet-stream",
        })
        anchorEl.href = URL.createObjectURL(asBlob)
        anchorEl.download = `hvlog_${now}_${version
            .toString()
            .padStart(4, "0")}.jsonl.gz`
        anchorEl.click()
    }

    async function buildBackup() {
        const persistentDb = await LogDb.ainit("persistent")
        const isekaiDb = await LogDb.ainit("isekai")

        if (persistentDb.db.version !== isekaiDb.db.version) {
            setStatus({
                type: "error",
                detail: `Persistent db version (${persistentDb.db.version}) does not match isekai db version (${isekaiDb.db.version})`,
            })
            throw new Error()
        }

        const backup: LogDbBackup = [
            { type: "meta", version: persistentDb.db.version },
        ]

        const total =
            (await persistentDb.count("complete")) +
            (await isekaiDb.count("complete"))

        let idx = 0

        for await (const log of persistentDb.iterArchive()) {
            idx += 1
            backup.push({ type: "persistent", log })
            setStatus({
                type: "loading",
                detail: `Exporting logs (${idx} / ${total}) ...`,
            })
        }

        for await (const log of isekaiDb.iterArchive()) {
            idx += 1
            backup.push({ type: "isekai", log })
            setStatus({
                type: "loading",
                detail: `Exporting logs (${idx} / ${total}) ...`,
            })
        }

        return { backup, total, version: persistentDb.db.version }
    }

    return {
        status,
        download: async (anchorEl: HTMLAnchorElement) => {
            if (status.type !== "idle") {
                return
            }

            setStatus({
                type: "loading",
                detail: "Exporting logs ...",
            })
            const { backup, total, version } = await buildBackup()

            setStatus({
                type: "loading",
                detail: `Generating download ...`,
            })
            await sleep(10)
            await download(backup, anchorEl, version)

            setStatus({
                type: "done",
                count: total,
            })
        },
    }
}
