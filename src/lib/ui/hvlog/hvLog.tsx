import { LogId } from "@/lib/logDb/logDb"
import "@/lib/ui/global.css"
import {
    ResizableHandle,
    ResizablePanel,
    ResizablePanelGroup,
} from "@/lib/ui/shadcn/resizable"
import { RootComponent } from "@/lib/utils/userscriptUtils"
import { StrictMode, useCallback, useMemo } from "react"
import { AppContextProvider } from "../appContext"
import { DbContextProvider } from "../dbContext"
import { Sidebar } from "../sidebar"
import { useLocalJsonState } from "./hooks"
import { LogContextProvider, useLogContext } from "./logContext"
import { LogDetailsPane } from "./logDetailsPane"
import { LogStatsProvider } from "./logStatsContext"
import { LogSummaryTable } from "./logSummaryTable/logSummaryTable"
import { SummaryDbProvider } from "./summaryDbContext"

export const HvLog: RootComponent = ({
    app,
    persistentDb,
    isekaiDb,
}) => {
    return (
        <StrictMode>
            <AppContextProvider app={app}>
                <DbContextProvider
                    persistentDb={persistentDb}
                    isekaiDb={isekaiDb}
                >
                    <LogContextProvider>
                        <SummaryDbProvider>
                            <LogStatsProvider>
                                <Sidebar>
                                    <HvLogInner />
                                </Sidebar>
                            </LogStatsProvider>
                        </SummaryDbProvider>
                    </LogContextProvider>
                </DbContextProvider>
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

    const logsSorted = useMemo(
        () => [...logIds.values().map(({ id }) => id)],
        [logIds]
    )

    const fetcher = useLogFetch([selectedLogId])

    const onClick = useCallback(
        (id: LogId) => setSelectedLogId(id),
        [setSelectedLogId]
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
                        selectionId={selectedLogId}
                        logIds={logsSorted}
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
                {fetcher.logs[0] ? (
                    <LogDetailsPane log={fetcher.logs[0]} />
                ) : (
                    "Loading..."
                )}
            </ResizablePanel>
        </ResizablePanelGroup>
    )
}
