import "@/lib/ui/global.css"
import {
    ResizableHandle,
    ResizablePanel,
    ResizablePanelGroup,
} from "@/lib/ui/shadcn/resizable"
import { alphabetical } from "radash"
import { createContext, StrictMode, useEffect, useMemo } from "react"
import { createLogContext, LogContext } from "../logContext"
import { useLocalJsonState } from "./hooks"
import { LogDetailsPane } from "./logDetailsPane"
import { LogSummaryTable } from "./logSummaryTable"

export const AppContext = createContext(window.HV_LOG)

export function HvLog() {
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

    useEffect(() => {
        // @ts-ignore
        window.HV_LOG_INIT_STYLES()
    }, [])

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
