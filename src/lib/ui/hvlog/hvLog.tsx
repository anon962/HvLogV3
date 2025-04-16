import "@/lib/ui/global.css"
import {
    ResizableHandle,
    ResizablePanel,
    ResizablePanelGroup,
} from "@/lib/ui/shadcn/resizable"
import { RootComponent } from "@/lib/utils/userscriptUtils"
import { StrictMode } from "react"
import { AppContextProvider } from "../appContext"
import { DbContextProvider } from "../dbContext"
import { Sidebar } from "../sidebar"
import { LogContextProvider, useLogContext } from "./logContext"
import { LogDetailsPane } from "./logDetailsPane"
import { LogStatsProvider } from "./logStatsContext"
import { LogSummaryTable } from "./logSummaryTable/logSummaryTable"
import {
    SummaryTableContextProvider,
    useSummaryTableContext,
} from "./logSummaryTable/summaryTableContext"
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
                                    <SummaryTableContextProvider>
                                        <HvLogInner />
                                    </SummaryTableContextProvider>
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
    const { selectedLogId } = useSummaryTableContext()

    const { useLogFetch, isFetching } = useLogContext()
    const fetcher = useLogFetch([selectedLogId])

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
                    <LogSummaryTable />
                </div>
            </ResizablePanel>

            <ResizableHandle withHandle />

            <ResizablePanel className="flex justify-center">
                {fetcher.logs[0] ? (
                    <LogDetailsPane log={fetcher.logs[0]} />
                ) : (
                    <div className="py-8">
                        {isFetching(selectedLogId)
                            ? "Loading..."
                            : "Select a log!"}
                    </div>
                )}
            </ResizablePanel>
        </ResizablePanelGroup>
    )
}
