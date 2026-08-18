import { mountReactWrapper, sum } from "myutils"
import React from "react"
// @ts-ignore
import __zstdInline__ from "virtual:zstd-inline"
// @ts-ignore
import __zstdWasmUrl__ from "@/../node_modules/@bokuweb/zstd-wasm/dist/esm/zstd.wasm?url"
import {
    BlobReader,
    BlobWriter,
    Entry,
    TextReader,
    TextWriter,
    Uint8ArrayReader,
    ZipReader,
    ZipWriter,
} from "@zip.js/zip.js"
// @ts-ignore
import cssRoot from "@/lib/ui/global.css?inline"

export type CommonProps = Pick<
    React.ComponentProps<"div">,
    "className" | "style"
>

export function formatNumber(x: number, alwaysShowSign?: boolean) {
    // prettier-ignore
    const sgn =
        x < 0 ? "-" :
        alwaysShowSign ? "+" :
        ""

    const digits = [...Math.trunc(Math.abs(x)).toString()]
        .reverse()
        .reduce((acc, digit, idx) => {
            if (idx % 3 === 0 && idx > 0) {
                acc.push(",")
            }

            acc.push(digit)

            return acc
        }, [] as string[])

    return sgn + digits.reverse().join("")
}

export function concatArrays(xs: Uint8Array[]) {
    const totalSize = sum(xs.map((x) => x.length))
    const total = new Uint8Array(totalSize)

    let start = 0
    for (const arr of xs) {
        total.set(arr, start)
        start += arr.length
    }

    return total
}

export function initZstdWasm() {
    if (!("zstdInit" in window.HV_LOG)) {
        globalThis.eval(__zstdInline__)
        // @ts-ignore
        window.HV_LOG.zstdInit = zstdWasm.init(__zstdWasmUrl__)
    }
    return window.HV_LOG.zstdInit
}

export async function compressZstd(opts: {
    x: string | Blob | Uint8Array<ArrayBuffer>
    level?: number
    pool?: boolean
}): Promise<Uint8Array<ArrayBuffer>> {
    let bytes: Uint8Array<ArrayBuffer>
    if (typeof opts.x === "string") {
        bytes = new TextEncoder().encode(opts.x)
    } else if (opts.x instanceof Blob) {
        bytes = new Uint8Array(await opts.x.arrayBuffer())
    } else {
        bytes = opts.x
    }

    if (opts.pool) {
        const { compress } = window.HV_LOG.workerPool.registerModule(
            "compressZstd",
            () => ({
                reps: {
                    '"__zstdInline__"': JSON.stringify(__zstdInline__),
                    '"__zstdWasmUrl__"': JSON.stringify(__zstdWasmUrl__),
                },
                initCtx: async () => {
                    globalThis.eval("__zstdInline__")
                    // @ts-ignore
                    await zstdWasm.init("__zstdWasmUrl__")
                },
                fns: {
                    compress: async (opts: {
                        bytes: Uint8Array<ArrayBuffer>
                        level?: number
                    }) => {
                        const result = zstdWasm.compress(
                            opts.bytes,
                            opts.level,
                        ) as Uint8Array<ArrayBuffer>
                        return result
                    },
                },
            }),
        )
        return await compress({ bytes, level: opts.level })
    } else {
        await initZstdWasm()
        const result = zstdWasm.compress(
            bytes,
            opts.level,
        ) as Uint8Array<ArrayBuffer>
        return result
    }
}
export async function decompressZstd(opts: {
    x: Blob | Uint8Array<ArrayBuffer>
}) {
    let bytes: Uint8Array<ArrayBuffer>
    if (opts.x instanceof Blob) {
        bytes = new Uint8Array(await opts.x.arrayBuffer())
    } else {
        bytes = opts.x
    }

    await initZstdWasm()

    const result = zstdWasm.decompress(bytes) as Uint8Array<ArrayBuffer>
    return result
}

export async function writeZip(
    xs: Record<string, string | ReadableStream<Uint8Array<ArrayBuffer>>>,
): Promise<Blob> {
    const writer = new ZipWriter(new BlobWriter("application/zip"), {
        compressionMethod: 0,
    })

    const toWrite = []
    for (const [k, v] of Object.entries(xs)) {
        let r
        if (typeof v === "string") {
            r = new TextReader(v)
        } else {
            r = v
        }
        toWrite.push(writer.add(k, r))
    }
    await Promise.all(toWrite)

    return writer.close()
}
type ReadZipTypeId = "string"
type ReadZipType<Id> = Id extends "string" ? string : never
export async function* readZip<T extends ReadZipTypeId>(opts: {
    data: Blob | Uint8Array<ArrayBuffer>
    type: T
    onFail?: (e: any, x: Entry) => void
}): AsyncGenerator<{
    filename: string
    data: ReadZipType<T>
}> {
    let r
    if (opts.data instanceof Blob) {
        r = new BlobReader(opts.data)
    } else {
        r = new Uint8ArrayReader(opts.data)
    }

    const reader = new ZipReader(r)
    for await (const x of reader.getEntriesGenerator()) {
        if (x.directory) {
            continue
        }

        let data: any = null
        try {
            if (opts.type === "string") {
                data = await x.getData(new TextWriter())
            }
        } catch (e) {
            opts.onFail?.(e, x)
            continue
        }

        yield {
            filename: x.filename,
            data,
        }
    }
}
export function randomUint8Array(size: number) {
    const result = new Uint8Array(size)
    const chunkSize = 65536

    for (let offset = 0; offset < size; offset += chunkSize) {
        crypto.getRandomValues(
            result.subarray(offset, Math.min(offset + chunkSize, size)),
        )
    }

    return result
}
export type RootComponent<T = {}> = React.FC<{} & T>

export const mountReact = mountReactWrapper({
    unmountEventId: "hvlog:unmount",
    shadowHostClass: "hvlog-shadow",
    shadowMountSelector: ".hvlog-host",
    shadowTemplate: (opts) => `
        <div class="hvlog-container dialog-container dark">
            <style>
                :host {
                    all: initial;
                }

                ${!opts.skipStyles ? cssRoot : ""}
            </style>
            <div class="hvlog-host h-full w-full">
            </div>
        </div>
    `,
})

// Monsterbation clears timers on new round which causes sleep() to never return
// This fixes that by patching clearInterval() to check for any ids that we're using
export const ACTIVE_TIMERS = new Set<number>()
export function patchClearInterval() {
    const clearInterval = window.unsafeWindow.clearInterval
    window.unsafeWindow.clearInterval = (id: any) => {
        if (ACTIVE_TIMERS.has(id)) {
            return
        }

        clearInterval(id)
    }

    const clearTimeout = window.unsafeWindow.clearTimeout
    window.unsafeWindow.clearTimeout = (id: any) => {
        if (ACTIVE_TIMERS.has(id)) {
            return
        }

        clearTimeout(id)
    }
}
export async function sleepWithRegistration(t: number): Promise<void> {
    return new Promise((resolve) => {
        // Apparently chrome clears timers if document (body?) is replaced
        // https://stackoverflow.com/questions/28516274/interval-set-through-content-script-being-cleared-by-webpage
        // So patching the clearInterval that MB uses above isn't enough to prevent forever-sleeps
        const forceResolve = () => {
            console.debug("Force resolving sleep()")
            resolve()
            document.removeEventListener("DOMContentLoaded", forceResolve)
        }
        document.addEventListener("DOMContentLoaded", forceResolve)

        const cb = () => {
            ACTIVE_TIMERS.delete(id)
            document.removeEventListener("DOMContentLoaded", forceResolve)
            resolve()
        }
        let id: any = setTimeout(cb, t)
        ACTIVE_TIMERS.add(id)
    })
}

export function formatMiB(sizeBytes: number, n = 1) {
    const sizeMiB = sizeBytes / 1024 / 1024
    return sizeMiB.toFixed(n)
}
