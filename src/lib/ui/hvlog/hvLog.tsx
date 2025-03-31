import "@/lib/ui/global.css"
import {
    ResizableHandle,
    ResizablePanel,
    ResizablePanelGroup,
} from "@/lib/ui/shadcn/resizable"
import { alphabetical } from "radash"
import { StrictMode, useEffect, useMemo } from "react"
import { LogContextProvider, useLogContext } from "../logContext"
import { LogStatsProvider } from "../logStatsContext"
import { SummaryDbProvider } from "../summaryDbContext"
import { useLocalJsonState } from "./hooks"
import { LogDetailsPane } from "./logDetailsPane"
import { LogSummaryTable } from "./logSummaryTable"

export function HvLog() {
    return (
        <StrictMode>
            <LogContextProvider>
                <SummaryDbProvider>
                    <LogStatsProvider>
                        <HvLogInner />
                    </LogStatsProvider>
                </SummaryDbProvider>
            </LogContextProvider>
        </StrictMode>
    )
}

function HvLogInner() {
    const [selectedLogId, setSelectedLog] = useLocalJsonState(
        "",
        "hvlog_selected_log"
    )

    const { logs, loading: logsLoading } = useLogContext()

    const logsSorted = alphabetical(logs, (l) => l.meta.start, "desc")
    const selectionIdx = logsSorted.findIndex(
        (l) => l.id === selectedLogId
    )

    useEffect(() => {
        // @ts-ignore
        window.HV_LOG_INIT_STYLES()
    }, [])

    return (
        <ResizablePanelGroup
            direction="horizontal"
            autoSaveId="hvlog_detail_split"
        >
            <ResizablePanel className="overflow-auto!">
                <div
                    className="flex flex-col items-center w-full h-full"
                    style={{ containerType: "inline-size" }}
                >
                    <LogSummaryTable
                        onClick={(log) => setSelectedLog(log.id)}
                        selectionIdx={selectionIdx}
                        logs={logsSorted}
                        loading={logsLoading}
                    />

                    {logs.length === 0 ? (
                        <span>No battles found!</span>
                    ) : (
                        ""
                    )}
                </div>
            </ResizablePanel>

            <ResizableHandle withHandle />

            <ResizablePanel className="flex justify-center">
                {useMemo(
                    () => (
                        <LogDetailsPane
                            log={logsSorted[selectionIdx]}
                        />
                    ),
                    [logsSorted[selectionIdx]?.id]
                )}
            </ResizablePanel>
        </ResizablePanelGroup>
    )
}
