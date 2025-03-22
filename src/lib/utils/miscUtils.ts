import { range, sleep } from "radash"
import { InferGuardType, Or } from "./typeUtils"

export function split<T, TPass extends T = T, TFail extends T = T>(
    xs: T[],
    condition: (x: T) => boolean
): [TPass[], TFail[]] {
    const pass = [] as TPass[]
    const fail = [] as TFail[]

    for (let x of xs) {
        if (condition(x)) {
            pass.push(x as TPass)
        } else {
            fail.push(x as TFail)
        }
    }

    return [pass, fail]
}

export function splitMap<T, TPass extends T = T, TFail extends T = T>(
    xs: T[],
    fn: (
        x: T
    ) =>
        | { type: "pass"; value: TPass }
        | { type: "fail"; value: TFail }
): [TPass[], TFail[]] {
    const pass = [] as TPass[]
    const fail = [] as TFail[]

    for (let x of xs) {
        const mapped = fn(x)

        if (mapped.type === "pass") {
            pass.push(mapped.value)
        } else {
            fail.push(mapped.value)
        }
    }

    return [pass, fail]
}

export interface SleepUntilOpts {
    check: () => boolean
    tries?: number
    delay?: number
}

/** Defaults to 60 tries @ 50ms = 3s retry period */
export async function sleepUntil(opts: SleepUntilOpts) {
    const n = opts?.tries ?? 60
    for (let _ of range(n - 1)) {
        const value = opts.check()
        if (value) {
            return true
        }

        await sleep(opts.delay ?? 50)
    }

    return false
}

export function uuidWithFallback() {
    let randomUUID = () => window.crypto.randomUUID() as string

    if (randomUUID === undefined) {
        const now = new Date().toISOString()
        const n = Math.random().toString()
        randomUUID = () => `${now}_${n}`
    }

    return randomUUID()
}

export function findNext<
    TItem,
    TCond extends (x: TItem) => boolean = (x: TItem) => boolean
>(
    xs: TItem[],
    cond: TCond,
    opts: {
        reverse?: boolean
        start?: number
        end?: number
        breakOn?: (x: TItem) => boolean
    } = {}
): [Or<InferGuardType<TCond>, TItem>, number] | [null, null] {
    const reverse = opts.reverse ?? false

    let start, end, step
    if (reverse) {
        start = opts.start ?? xs.length - 1
        end = opts.end ?? 0
        step = -1
    } else {
        start = opts.start ?? 0
        end = opts.end ?? xs.length - 1
        step = 1
    }

    for (let idx = start; idx <= end; idx += step) {
        const x = xs[idx]

        if (cond(x)) {
            return [x as any, idx]
        } else if (opts?.breakOn?.(x)) {
            return [null, null]
        }
    }

    return [null, null]
}
