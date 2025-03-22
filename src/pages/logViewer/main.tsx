import "@/lib/ui/global.css"
import { createContext, StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { unsafeWindow } from "vite-plugin-monkey/dist/client"
import { LogList } from "./logList"

function main() {
    createRoot(document.getElementById("root")!).render(
        <LogViewer></LogViewer>
    )
}

function LogViewer() {
    return (
        <StrictMode>
            <AppContext.Provider value={unsafeWindow.HV_LOG}>
                <LogList />
            </AppContext.Provider>
        </StrictMode>
    )
}

export const AppContext = createContext(unsafeWindow.HV_LOG)

main()
