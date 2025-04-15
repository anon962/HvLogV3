import { createContext, useContext } from "react"
import { LogDb } from "../logDb/logDb"
import { ContextProviderProps } from "../utils/typeUtils"
import { readUrlPath } from "../utils/userscriptUtils"

const DbContext = createContext<{
    persistentDb: LogDb
    isekaiDb: LogDb
    activeDb: LogDb
    activeType: "persistent" | "isekai"
}>(null as any)

export function useDbContext() {
    return useContext(DbContext)
}

export function DbContextProvider({
    persistentDb,
    isekaiDb,
    children,
}: ContextProviderProps & {
    persistentDb: LogDb
    isekaiDb: LogDb
}) {
    const { isIsekai } = readUrlPath()
    const activeDb = isIsekai ? isekaiDb : persistentDb
    const activeType = isIsekai ? "isekai" : "persistent"

    return (
        <DbContext.Provider
            value={{
                persistentDb,
                isekaiDb,
                activeDb,
                activeType,
            }}
        >
            {children}
        </DbContext.Provider>
    )
}
