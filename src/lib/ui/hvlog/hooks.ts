import { useEffect, useState } from "react"

export function useLocalJsonState<T extends any>(
    init: T,
    key: string,
    override?: T | undefined
) {
    return useLocalState<T>(
        init,
        key,
        (x) => JSON.parse(x),
        (x) => JSON.stringify(x),
        override
    )
}

export function useLocalState<T>(
    init: T,
    key: string,
    load: (x: string) => T,
    save: (x: T) => string,
    override?: T | undefined
) {
    let val = init

    const fromStorage = localStorage.getItem(key)
    if (fromStorage !== null) {
        val = load(fromStorage)
    }

    const [state, setState] = useState(override ?? val)

    useEffect(() => {
        const cb = () => localStorage.setItem(key, save(state))
        window.addEventListener("beforeunload", cb)
        return () => window.removeEventListener("beforeunload", cb)
    }, [state])

    return [state, setState] as const
}
