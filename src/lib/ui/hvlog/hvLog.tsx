import { App } from "@/lib/app/app"
import { LogId } from "@/lib/logDb"
import "@/lib/ui/global.css"
import {
    ResizableHandle,
    ResizablePanel,
    ResizablePanelGroup,
} from "@/lib/ui/shadcn/resizable"
import { StrictMode, useCallback, useEffect } from "react"
import { AppContextProvider } from "../appContext"
import { Sidebar } from "../sidebar"
import { useLocalJsonState } from "./hooks"
import { LogContextProvider, useLogContext } from "./logContext"
import { LogDetailsPane } from "./logDetailsPane"
import { LogStatsProvider } from "./logStatsContext"
import { LogSummaryTable } from "./logSummaryTable/logSummaryTable"
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
    const [selectedLogId, setSelectedLogId] = useLocalJsonState(
        "",
        "hvlog_selected_log"
    )

    const { logIds, useLogFetch } = useLogContext()

    const logsSorted = [...logIds.values()]

    const selectionIdx = logsSorted.findIndex(
        (id) => id === selectedLogId
    )

    const fetcher = useLogFetch(selectedLogId)
    useEffect(() => fetcher.setLogId(selectedLogId), [selectedLogId])

    const onClick = useCallback(
        (id: LogId) => setSelectedLogId(id),
        setSelectedLogId
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
                        onClick={onClick}
                        selectionIdx={selectionIdx}
                        logs={logsSorted}
                    />

                    {logsSorted.length === 0 ? (
                        <span>No battles found!</span>
                    ) : (
                        ""
                    )}
                </div>
            </ResizablePanel>

            <ResizableHandle withHandle />

            <ResizablePanel className="flex justify-center">
                {fetcher.log ? (
                    <LogDetailsPane log={fetcher.log} />
                ) : (
                    "Loading..."
                )}
            </ResizablePanel>
        </ResizablePanelGroup>
    )
}
