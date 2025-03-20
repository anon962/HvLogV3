import { range, sleep } from "radash"

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
