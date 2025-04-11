import { App } from "@/lib/app/app"
import { LogDb, LogDbBackup } from "@/lib/logDb/logDb"
import { migrateCompleteLogs } from "@/lib/logDb/migrateLogs"
import "@/lib/ui/global.css"
import { FC, FormEvent, useRef, useState } from "react"
import { AppContextProvider } from "../appContext"
import { LogContextProvider } from "../hvlog/logContext"
import { XIcon } from "../icons/tailwind"
import { Button } from "../shadcn/button"

export const ImportDialog: FC<{ app: App }> = ({ app }) => {
    return (
        <AppContextProvider app={app}>
            <LogContextProvider>
                <ImportDialogInner />
            </LogContextProvider>
        </AppContextProvider>
    )
}

function ImportDialogInner() {
    const dialogEl = useRef<HTMLDialogElement>(null)

    const [file, setFile] = useState<File | null>(null)

    const { status, upload } = useImporter()

    let statusEl = <span></span>
    switch (status.type) {
        case "loading":
            statusEl = <span>{status.detail}</span>
            break
        case "error":
            statusEl = (
                <span className="text-red-500">{status.detail}</span>
            )
            break
        case "result":
            statusEl = (
                <span>
                    Done! Imported{" "}
                    {status.backup.persistent.length +
                        status.backup.isekai.length}{" "}
                    logs.
                </span>
            )
            break
        default:
            statusEl = <span></span>
            break
    }

    function onClose() {
        dialogEl.current?.dispatchEvent(
            new CustomEvent("unmountme", {
                bubbles: true,
                composed: true,
            })
        )
    }

    function onSubmit(ev: FormEvent) {
        ev.preventDefault()

        if (!file) {
            return
        }

        upload(file)
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
                <form
                    onSubmit={(ev) => onSubmit(ev)}
                    className="size-full text-base flex flex-col"
                >
                    {/* Title */}
                    <div className="flex h-16 justify-between items-center border-b border-black pl-8! pr-4! bg-gray-400 text-gray-100">
                        <span className="font-bold text-xl">
                            Import Backup
                        </span>

                        <Button
                            onClick={() => onClose()}
                            variant="ghost"
                            className="rounded-full cursor-pointer size-12 p-3! hover:bg-white/20 hover:text-inherit"
                            type="button"
                        >
                            <XIcon className="size-full" />
                        </Button>
                    </div>

                    {/* Body */}
                    <div className="grow px-8! flex flex-col items-center">
                        <span className="text-red-700 py-4!">
                            This will replace all logs!{" "}
                            <span className="font-bold">
                                Export a backup first!
                            </span>
                        </span>

                        <div className="flex flex-col gap-1 items-center justify-center w-full">
                            <input
                                onChange={(ev) =>
                                    setFile(
                                        ev.target.files?.[0] ?? null
                                    )
                                }
                                accept=".gz"
                                type="file"
                                className="rounded-sm cursor-pointer"
                                style={{
                                    border: "1.5px solid rgba(0,0,0,50%)",
                                    backgroundColor:
                                        "rgba(0,0,0,10%)",
                                }}
                                disabled={status.type === "loading"}
                            />
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="w-full flex justify-between items-center p-4! border-t border-black">
                        {statusEl}

                        <Button
                            className="cursor-pointer h-auto font-semibold bg-blue-500 hover:bg-blue-600 text-white px-6"
                            disabled={
                                file === null ||
                                status.type === "loading"
                            }
                        >
                            Import
                        </Button>
                    </div>
                </form>
            </dialog>
        </div>
    )
}

function useImporter() {
    const [status, setStatus] = useState<
        | { type: "idle" }
        | { type: "loading"; detail: string }
        | { type: "error"; detail: string }
        | { type: "result"; backup: LogDbBackup }
    >({
        type: "idle",
    })

    async function upload(file: File) {
        if (status.type === "loading") {
            return
        }
        setStatus({
            type: "loading",
            detail: "",
        })

        let backup
        try {
            setStatus({
                type: "loading",
                detail: "Reading file...",
            })
            backup = await readFile(file)
        } catch (e) {
            console.error(e)
            setStatus({
                type: "error",
                detail: "Failed to read file",
            })
            return
        }

        try {
            const persistentDb = await LogDb.ainit("persistent")
            const isekaiDb = await LogDb.ainit("isekai")

            let { version, persistent: pl, isekai: il } = backup
            while (version !== persistentDb.db.version) {
                pl = migrateCompleteLogs(pl, version)
                il = migrateCompleteLogs(il, version)
                version += 1
            }

            const persistentIter = persistentDb.replaceLogs(pl)
            for await (const idx of persistentIter) {
                setStatus({
                    type: "loading",
                    detail: `Importing persistent logs (${
                        idx + 1
                    } / ${pl.length}) ...`,
                })
            }

            const isekaiIter = isekaiDb.replaceLogs(il)
            for await (const idx of isekaiIter) {
                setStatus({
                    type: "loading",
                    detail: `Importing isekai logs (${idx + 1} / ${
                        il.length
                    }) ...`,
                })
            }
        } catch (e) {
            console.error(e)
            setStatus({
                type: "error",
                detail: "Failed to update database",
            })
            return
        }

        setStatus({
            type: "result",
            backup: backup,
        })
    }

    async function readFile(file: File): Promise<LogDbBackup> {
        const fr = new FileReader()
        const frPromise: Promise<ArrayBuffer> = new Promise(
            (resolve, reject) => {
                fr.onload = () => resolve(fr.result as any)
                fr.onerror = () => reject(fr.error)
            }
        )
        fr.readAsArrayBuffer(file)

        const asCompressedBytes = await frPromise
        const asStream = new ReadableStream({
            start(controller) {
                controller.enqueue(asCompressedBytes)
                controller.close()
            },
        })
            .pipeThrough(new DecompressionStream("gzip"))
            .getReader()

        const textDecoder = new TextDecoder()
        let asStr = ""
        while (true) {
            const { done, value } = (await asStream.read()) as {
                done: boolean
                value: Uint8Array
            }
            asStr += textDecoder.decode(value)
            if (done) {
                break
            }
        }

        const backup = JSON.parse(asStr)
        return backup
    }

    return {
        status,
        upload(file: File) {
            upload(file)
        },
    }
}
