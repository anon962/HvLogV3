import { createContext, useContext } from "react"
import { SummaryDb } from "../summaryDb"
import { ContextProviderProps } from "../utils/typeUtils"

const ctx = createContext<SummaryDb>(null as any)

export function useSummaryDbContext() {
    return useContext(ctx)
}

export function SummaryDbProvider({
    children,
}: ContextProviderProps) {
    const value = new SummaryDb()
    return <ctx.Provider value={value}>{children}</ctx.Provider>
}
