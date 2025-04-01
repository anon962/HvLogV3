import { createContext, useContext } from "react"
import { App } from "../app/app"
import { ContextProviderProps } from "../utils/typeUtils"

export const AppContext = createContext<App>(null as any)

export function useAppContext() {
    return useContext(AppContext)
}

export function AppContextProvider({
    app,
    children,
}: ContextProviderProps & { app: App }) {
    return (
        <AppContext.Provider value={app}>
            {children}
        </AppContext.Provider>
    )
}
