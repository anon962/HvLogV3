import { LogId } from "@/lib/logDb/logDb"
import "@/lib/ui/global.css"
import { RootComponent } from "@/lib/utils/userscriptUtils"
import { AppContextProvider } from "../appContext"
import { DbContextProvider } from "../dbContext"
import { useLocalJsonState } from "../hvlog/hooks"
import {
    LogContextProvider,
    useLogContext,
} from "../hvlog/logContext"
import { LogStatsProvider } from "../hvlog/logStatsContext"
import { SummaryDbProvider } from "../hvlog/summaryDbContext"
import { Sidebar } from "../sidebar"

export const EquipLog: RootComponent = ({
    app,
    persistentDb,
    isekaiDb,
}) => {
    return (
        <AppContextProvider app={app}>
            <DbContextProvider
                persistentDb={persistentDb}
                isekaiDb={isekaiDb}
            >
                <LogContextProvider bothDbs>
                    <SummaryDbProvider>
                        <LogStatsProvider>
                            <Sidebar>lmao</Sidebar>
                        </LogStatsProvider>
                    </SummaryDbProvider>
                </LogContextProvider>
            </DbContextProvider>
        </AppContextProvider>
    )
}

interface TableItem {
    equip: string
    logId: LogId
    date: string
    battleType: string
}

const Table = () => {
    const { logIds, useLogFetch } = useLogContext()

    const [filters, setFilters] = useLocalJsonState(
        {
            prefixes: ["Peerless", "Legendary", "Magnificent"],
            isekai: true,
            persistent: true,
        },
        "hvlog_equip_log_filter"
    )
}
