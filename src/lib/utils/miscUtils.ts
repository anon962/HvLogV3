import { sum } from "myutils"
import React, { Dispatch, useState } from "react"

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
