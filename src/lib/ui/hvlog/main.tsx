import "@/lib/ui/global.css"
import {
    ResizableHandle,
    ResizablePanel,
    ResizablePanelGroup,
} from "@/lib/ui/shadcn/resizable"
import { alphabetical } from "radash"
import { createContext, StrictMode, useMemo } from "react"
import { createRoot } from "react-dom/client"
import { createLogContext, LogContext } from "../logContext"
import { useLocalJsonState } from "./hooks"
import { LogDetailsPane } from "./logDetailsPane"
import { LogSummaryTable } from "./logSummaryTable"

export const AppContext = createContext(window.HV_LOG)

function main() {
    createRoot(document.getElementById("root")!).render(
        <HvLog></HvLog>
    )
}

function HvLog() {
    const [selectedLogId, setSelectedLog] = useLocalJsonState(
        "",
        "hvlog_selected_log"
    )

    const ctx = createLogContext()
    const { logs, logsLoading } = ctx

    const logsSorted = alphabetical(logs, (l) => l.meta.start, "desc")
    const selectionIdx = logsSorted.findIndex(
        (l) => l.id === selectedLogId
    )

    return (
        <StrictMode>
            <AppContext.Provider value={window.HV_LOG}>
                <LogContext.Provider value={ctx}>
                    <ResizablePanelGroup
                        direction="horizontal"
                        autoSaveId="hvlog_detail_split"
                    >
                        <ResizablePanel className="overflow-auto!">
                            <LogSummaryTable
                                onClick={(log) =>
                                    setSelectedLog(log.id)
                                }
                                selectionIdx={selectionIdx}
                                logs={logsSorted}
                                loading={logsLoading}
                            />
                        </ResizablePanel>

                        <ResizableHandle withHandle />

                        <ResizablePanel className="flex justify-center">
                            {useMemo(
                                () => (
                                    <LogDetailsPane
                                        log={logsSorted[selectionIdx]}
                                    />
                                ),
                                [selectionIdx]
                            )}
                        </ResizablePanel>
                    </ResizablePanelGroup>
                </LogContext.Provider>
            </AppContext.Provider>
        </StrictMode>
    )
}

main()
