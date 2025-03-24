import { CompleteLog, LogDb } from "@/lib/logDb"
import { LogAnalysis, LogStats } from "@/lib/statsDb"
import "@/lib/ui/global.css"
import {
    ResizableHandle,
    ResizablePanel,
    ResizablePanelGroup,
} from "@/lib/ui/shadcn/resizable"
import { alphabetical, sleep } from "radash"
import {
    createContext,
    StrictMode,
    useEffect,
    useMemo,
    useState,
} from "react"
import { createRoot } from "react-dom/client"
import { useLocalJsonState } from "./hooks"
import { LogDetailsPane } from "./logDetailsPane"
import { LogSummaryTable } from "./logSummaryTable"

export const AppContext = createContext(window.HV_LOG)

function main() {
    createRoot(document.getElementById("root")!).render(
        <LogViewer></LogViewer>
    )
}

function LogViewer() {
    const [activeLog, setActiveLog] = useLocalJsonState(
        "",
        "hvlog_active_log"
    )

    let { logs, loading } = useLogs()
    logs = alphabetical(logs, (l) => l.log.meta.start, "desc")

    const selectedLog = logs.find(({ log }) => log.id === activeLog)

    return (
        <StrictMode>
            <AppContext.Provider value={window.HV_LOG}>
                <ResizablePanelGroup
                    direction="horizontal"
                    autoSaveId="hvlog_detail_split"
                >
                    <ResizablePanel className="overflow-auto!">
                        <LogSummaryTable
                            onClick={(log) => setActiveLog(log.id)}
                            activeLog={activeLog}
                            logs={logs}
                            loading={loading}
                        />
                    </ResizablePanel>

                    <ResizableHandle withHandle />

                    <ResizablePanel className="flex justify-center">
                        <LogDetailsPane selectedLog={selectedLog} />
                    </ResizablePanel>
                </ResizablePanelGroup>
            </AppContext.Provider>
        </StrictMode>
    )
}

export type LogWithAnalysis = {
    log: CompleteLog
    analysis: LogAnalysis
}

function useLogs(refreshDelay = 5000) {
    const [completeLogs, setCompleteLogs] = useState<CompleteLog[]>(
        []
    )
    const [loading, setLoading] = useState(true)

    const stats = new LogStats()
    const logs = useMemo(
        () =>
            completeLogs.map((log) => ({
                log,
                analysis: stats.get(log.id) ?? stats.analyze(log),
            })),
        [completeLogs]
    )

    useEffect(() => {
        const result: CompleteLog[] = []
        const seen = new Set<string>()

        async function load() {
            const db = await LogDb.ainit()
            const iter = db.iterArchive()

            for await (const log of iter) {
                if (seen.has(log.id)) {
                    continue
                } else {
                    seen.add(log.id)
                }

                result.push(log)
                setCompleteLogs([...result])
            }

            setLoading(false)
            await sleep(refreshDelay)
            load()
        }

        load()

        return () => {}
    }, [])

    return { logs, loading }
}

main()
