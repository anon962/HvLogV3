import { App } from "@/lib/app/app"
import { CompleteLog } from "@/lib/logDb"
import "@/lib/ui/global.css"
import { FC, useEffect, useRef, useState } from "react"
import { AppContextProvider, useAppContext } from "../appContext"
import {
    LogContextProvider,
    useLogContext,
} from "../hvlog/logContext"
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
    const total = useDbSize()
    const { logs, loading } = useLogContext()
    const [didAutoDownload, setDidAutoDownload] = useState(false)
    const anchorEl = useRef<HTMLAnchorElement>(null)
    const dialogEl = useRef<HTMLDialogElement>(null)
    const downloader = useDownloader(anchorEl.current)

    if (!loading && !didAutoDownload && anchorEl.current) {
        setDidAutoDownload(true)
        downloader(logs)
    }

    function onClose() {
        dialogEl.current?.dispatchEvent(
            new CustomEvent("unmountme", {
                bubbles: true,
                composed: true,
            })
        )
    }

    return (
        <div
            onClick={() => onClose()}
            className="absolute top-0 left-0 right-0 bottom-0 bg-black/30 cursor-pointer"
        >
            <dialog
                onClick={(ev) => ev.stopPropagation()}
                ref={dialogEl}
                open
                className={`
                bg-gray-300 text-foreground rounded-lg border-2 border-black
                top-0 bottom-0 left-0 right-0 size-full max-w-[30rem] max-h-[15rem] m-auto
                flex flex-col items-center justify-center`}
            >
                <span className="text-lg font-mono pt-4">
                    Exporting {logs.length} / {total || "???"} logs
                    ...
                    {!loading ? (
                        <>
                            <br />
                            Done!
                        </>
                    ) : (
                        ""
                    )}
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

function useDbSize() {
    const [size, setSize] = useState(0)

    const app = useAppContext()

    useEffect(() => {
        async function load() {
            setSize(await app.db.count("complete"))
        }

        load()
    })

    return size
}

function useDownloader(anchorEl: HTMLAnchorElement | null) {
    const [currentDownload, setCurrentDownload] =
        useState<Promise<void> | null>(null)

    async function download(logs: CompleteLog[]) {
        if (!anchorEl) {
            return
        }

        const now = new Date().toISOString()
        const asStr = JSON.stringify(logs)
        const asBytes = new TextEncoder().encode(asStr)
        const asStream = new ReadableStream({
            start(controller) {
                controller.enqueue(asBytes)
                controller.close()
            },
        })
            .pipeThrough(new CompressionStream("gzip"))
            .getReader()

        const asCompressed: Array<Uint8Array> = []
        while (true) {
            const { done, value } = (await asStream.read()) as {
                done: boolean
                value: Uint8Array
            }
            asCompressed.push(value)
            if (done) {
                break
            }
        }

        const asBlob = new Blob(asCompressed, {
            type: "application/octet-stream",
        })
        anchorEl.href = URL.createObjectURL(asBlob)
        anchorEl.download = `hvlog_${now}.json.gzip`
        anchorEl.click()
        setCurrentDownload(null)
    }

    return (logs: CompleteLog[]) => {
        if (currentDownload) {
            return
        }

        setCurrentDownload(download(logs))
    }
}
