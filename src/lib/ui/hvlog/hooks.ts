import { useEffect, useState } from "react"

export function useLocalJsonState<T extends any>(
    init: T,
    key: string
) {
    return useLocalState(
        init,
        key,
        (x) => JSON.parse(x),
        (x) => JSON.stringify(x)
    )
}

export function useLocalState<T>(
    init: T,
    key: string,
    load: (x: string) => T,
    save: (x: T) => string
) {
    let val = init

    const fromStorage = localStorage.getItem(key)
    if (fromStorage !== null) {
        val = load(fromStorage)
    }

    const [state, setState] = useState(val)

    useEffect(() => {
        const cb = () => localStorage.setItem(key, save(state))
        window.addEventListener("beforeunload", cb)
    }, [state])

    return [state, setState]
}
