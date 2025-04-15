import { createContext, useContext } from "react"
import { LogDb } from "../logDb/logDb"
import { ContextProviderProps } from "../utils/typeUtils"

const DbContext = createContext<{
    persistentDb: LogDb
    isekaiDb: LogDb
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
    return (
        <DbContext.Provider
            value={{
                persistentDb,
                isekaiDb,
            }}
        >
            {children}
        </DbContext.Provider>
    )
}
