import { L, sum, zip } from "myutils"
import React, { Dispatch } from "react"
import { zstdWasm } from "../ui/constants"
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

export function newContext<T = unknown>(init: () => [T, Dispatch<T>]) {
    const ctx = React.createContext<T>(null as any)

    let setValue: (update: T) => void = null as any
    const Provider = React.memo((props: { children: React.ReactNode }) => {
        const [value, setValue2] = init()
        setValue = setValue2

        return React.createElement(ctx.Provider, {
            value,
            children: props.children,
        })
    })

    return {
        ctx,
        setValue,
        Provider,
        useContext: () => React.useContext(ctx),
    }
}

export function useAsync<TReq, TRes>(
    getter: (req: TReq) => Promise<TRes>,
    init: TReq,
) {
    const [request, setRequest] = React.useState<TReq>(init)
    const [data, setData] = React.useState<TRes | null>(null)
    const [isPending, setIsPending] = React.useState(true)

    React.useEffect(() => {
        let isCancelled = false

        const req = request
        ;(async () => {
            const d = await getter(req)
            if (!isCancelled) {
                setData(d)
                setIsPending(false)
            }
        })()

        setIsPending(true)

        return () => {
            isCancelled = true
        }
    }, [request])

    return {
        data,
        isPending,
        request,
        setRequest,
    }
}

export function useAsync2<TReq, TRes>(
    getter: (req: TReq) => Promise<TRes>,
    request: TReq,
) {
    const [data, setData] = React.useState<TRes | null>(null)
    const [isPending, setIsPending] = React.useState(true)

    React.useEffect(() => {
        let isCancelled = false
        setIsPending(true)
        ;(async () => {
            const d = await getter(request)
            if (!isCancelled) {
                setData(d)
                setIsPending(false)
            }
        })()
        return () => {
            isCancelled = true
        }
    }, [request])

    return { data, isPending }
}

export function useAsyncGen<TReq, TRes>(
    getter: (req: TReq) => AsyncGenerator<TRes, TRes, void>,
    init: TReq,
) {
    const [request, setRequest] = React.useState<TReq>(init)
    const [data, setData] = React.useState<TRes | null>(null)
    const [isPending, setIsPending] = React.useState(true)
    const [isStale, setIsStale] = React.useState(true)

    React.useEffect(() => {
        let isCancelled = false

        const req = request
        const gen = getter(req)
        ;(async () => {
            while (true) {
                const { value, done } = await gen.next()
                if (isCancelled) {
                    return
                }

                if (done) {
                    setData(value)
                    setIsStale(false)
                    setIsPending(false)
                    return
                } else {
                    setData(value)
                    setIsStale(true)
                }
            }
        })()

        setIsPending(true)
        setIsStale(true)

        return () => {
            isCancelled = true
            gen.return(null as any)
        }
    }, [request])

    return {
        data,
        isPending,
        isStale,
        request,
        setRequest,
    }
}

export function ReactMemo<T, P = {}>(component: (props: P) => React.ReactNode) {
    return React.memo(component) as (props: P) => React.ReactNode
}

export type CommonProps = Pick<
    React.ComponentProps<"div">,
    "className" | "style"
>

type MergePropStrategy<T = unknown> =
    | { type: "override" }
    | { type: "add"; sep?: T }
    | {
          type: "custom"
          fn: (base: T, override: T) => T
      }
type MergePropStrategyMap = {
    string: MergePropStrategy<string>
    number: MergePropStrategy<number>
    bigint: MergePropStrategy<bigint>
    boolean: MergePropStrategy<boolean>
}

export function mergeProps<TBase extends React.ComponentProps<"div">>(
    base: TBase,
    overrides?: any,
    strategy?: Partial<MergePropStrategyMap>,
): any {
    const result = { ...base } as any

    const strat: MergePropStrategyMap = {
        string: {
            type: "add",
            sep: " ",
        },
        number: {
            type: "override",
        },
        bigint: {
            type: "override",
        },
        boolean: {
            type: "override",
        },
        ...strategy,
    }

    for (const k of Object.keys(overrides ?? {})) {
        const bv = (base as any)[k]
        const bt = typeof bv
        const ov = overrides[k]
        const ot = typeof ov

        if (!(k in base)) {
            result[k] = ov
        } else if (!bv && ov) {
            result[k] = ov
        } else if (bv && !ov) {
            // result[k] = bv
        } else if (!bv && !ov) {
            // result[k] = bv
        } else if (bt !== ot) {
            L.error(`Cannot merge ${bv} (${bt}) with ${ov} (${ot})`)
        } else {
            switch (bt) {
                case "string":
                case "number":
                case "bigint":
                case "boolean":
                    const s = strat[bt]
                    switch (s.type) {
                        case "override":
                            result[k] = ov
                            break
                        case "add":
                            if (s.sep) {
                                result[k] += s.sep
                            }
                            result[k] += ov
                            break
                        case "custom":
                            result[k] = (s.fn as any)(bv, ov)
                            break
                    }
                    break
                case "symbol":
                case "object":
                case "function":
                    L.error(`Cannot merge ${bv} (${bt}) with ${ov} (${ot})`)
                    break
            }
        }
    }

    return result
}

export function css(
    strings: TemplateStringsArray,
    ...values: unknown[]
): string {
    return strings.reduce((acc, s, i) => acc + s + (values[i] ?? ""), "")
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
                initCtx: async () => {
                    globalThis.eval(__zstdInline__)
                    // @ts-ignore
                    await zstdWasm.init(__zstdWasmUrl__)
                },
                initCtxReps: {
                    __zstdInline__: JSON.stringify(__zstdInline__),
                    __zstdWasmUrl__: JSON.stringify(__zstdWasmUrl__),
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
