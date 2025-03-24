import "@/lib/ui/global.css"
import {
    ResizableHandle,
    ResizablePanel,
    ResizablePanelGroup,
} from "@/lib/ui/shadcn/resizable"
import { createContext, StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { LogSummaryTable } from "./logSummaryTable"

function main() {
    createRoot(document.getElementById("root")!).render(
        <LogViewer></LogViewer>
    )
}

function LogViewer() {
    return (
        <StrictMode>
            <AppContext.Provider value={window.HV_LOG}>
                <ResizablePanelGroup direction="horizontal">
                    <ResizablePanel className="overflow-auto!">
                        <LogSummaryTable />
                    </ResizablePanel>

                    <ResizableHandle withHandle />

                    <ResizablePanel className="flex justify-center p-8">
                        Two
                    </ResizablePanel>
                </ResizablePanelGroup>
            </AppContext.Provider>
        </StrictMode>
    )
}

export const AppContext = createContext(window.HV_LOG)

main()
