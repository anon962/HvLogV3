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
