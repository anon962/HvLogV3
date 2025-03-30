import { range, sleep, sum, zip } from "radash"
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
    TCond extends (x: TItem, idx: number) => boolean = (
        x: TItem
    ) => boolean
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

    for (
        let idx = start;
        reverse ? idx >= end : idx <= end;
        idx += step
    ) {
        const x = xs[idx]

        if (cond(x, idx)) {
            return [x as any, idx]
        } else if (opts?.breakOn?.(x)) {
            return [null, null]
        }
    }

    return [null, null]
}

export function enumerate<T>(xs: T[]): Array<[number, T]> {
    return xs.map((x, idx) => [idx, x])
}

export interface SortByCriteria<TItem = any> {
    fn: (x: TItem) => number | string
    reverse?: boolean
}
export function sortBy<TItem = any>(
    xs: TItem[],
    criteria: SortByCriteria<TItem>[]
): TItem[] {
    const mapped = xs.map((x) => ({
        x,
        value: criteria.map((crit) => crit.fn(x)),
    }))

    const sorted = mapped.sort((a, b) => {
        for (const [aa, bb, crit] of zip(
            a.value,
            b.value,
            criteria
        )) {
            // prettier-ignore
            const diff =
                aa < bb ? -1 :
                aa > bb ? 1 :
                0
            if (diff === 0) {
                continue
            }

            const mult = crit.reverse ? -1 : 1
            return diff * mult
        }

        return 0
    })

    return sorted.map((x) => x.x)
}

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

export function takeWhile<
    TItem,
    TCond extends (x: TItem, idx: number) => boolean = (
        x: TItem
    ) => boolean
>(
    xs: TItem[],
    cond: TCond,
    opts: {
        reverse?: boolean
        start?: number
        end?: number
    } = {}
): Array<Or<InferGuardType<TCond>, TItem>> {
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

    const items: any[] = []

    for (
        let idx = start;
        reverse ? idx >= end : idx <= end;
        idx += step
    ) {
        const x = xs[idx]

        if (cond(x, idx)) {
            items.push(x)
        } else {
            break
        }
    }

    return items
}

export function setDefault<
    TKey extends string | number | symbol,
    TRecord extends Record<TKey, any>
>(record: TRecord, key: TKey, value: TRecord[TKey]): TRecord[TKey] {
    record[key] = record[key] ?? value
    return record[key]
}

export function avg(xs: number[]) {
    if (xs.length === 0) {
        return 0
    }

    return sum(xs) / xs.length
}
