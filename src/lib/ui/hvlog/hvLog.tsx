import { App } from "@/lib/app/app"
import "@/lib/ui/global.css"
import {
    ResizableHandle,
    ResizablePanel,
    ResizablePanelGroup,
} from "@/lib/ui/shadcn/resizable"
import { alphabetical } from "radash"
import { StrictMode, useMemo } from "react"
import { AppContextProvider } from "../appContext"
import { Sidebar } from "../sidebar"
import { useLocalJsonState } from "./hooks"
import { LogContextProvider, useLogContext } from "./logContext"
import { LogDetailsPane } from "./logDetailsPane"
import { LogStatsProvider } from "./logStatsContext"
import { LogSummaryTable } from "./logSummaryTable"
import { SummaryDbProvider } from "./summaryDbContext"

export function HvLog(props: { app: App }) {
    return (
        <StrictMode>
            <AppContextProvider app={props.app}>
                <LogContextProvider>
                    <SummaryDbProvider>
                        <LogStatsProvider>
                            <Sidebar>
                                <HvLogInner />
                            </Sidebar>
                        </LogStatsProvider>
                    </SummaryDbProvider>
                </LogContextProvider>
            </AppContextProvider>
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
