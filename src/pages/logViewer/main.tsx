import "@/lib/ui/global.css"
import { createContext, StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { LogTable } from "./logTable"

function main() {
    createRoot(document.getElementById("root")!).render(
        <LogViewer></LogViewer>
    )
}

function LogViewer() {
    return (
        <StrictMode>
            <AppContext.Provider value={window.HV_LOG}>
                <LogTable />
            </AppContext.Provider>
        </StrictMode>
    )
}

export const AppContext = createContext(window.HV_LOG)

main()
