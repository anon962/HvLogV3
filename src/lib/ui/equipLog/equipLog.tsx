import { LogId } from "@/lib/logDb/logDb"
import "@/lib/ui/global.css"
import { RootComponent } from "@/lib/utils/userscriptUtils"
import { alphabetical, zip } from "radash"
import React, { useMemo } from "react"
import { AppContextProvider } from "../appContext"
import { DbContextProvider } from "../dbContext"
import { useLocalJsonState } from "../hvlog/hooks"
import {
    LogContextProvider,
    useLogContext,
} from "../hvlog/logContext"
import {
    LogStatsProvider,
    useStatsMaybe,
} from "../hvlog/logStatsContext"
import { preprocessBattleTypeSingle } from "../hvlog/logSummaryTable/cols"
import { SummaryDbProvider } from "../hvlog/summaryDbContext"
import { ArrowExternalIcon, CheckIcon } from "../icons/tailwind"
import { Button } from "../shadcn/button"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "../shadcn/table"
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
                            <Sidebar>
                                <EquipLogInner />
                            </Sidebar>
                        </LogStatsProvider>
                    </SummaryDbProvider>
                </LogContextProvider>
            </DbContextProvider>
        </AppContextProvider>
    )
}

const EquipLogInner = React.memo(() => {
    return (
        <div className="flex flex-col w-full p-8">
            <EquipTable />
        </div>
    )
})

const EquipTable = React.memo(() => {
    const items = useTableItems()

    const rowEls = items.map((item, idx) => {
        const url = new URL(
            location.origin +
                (item.isIsekai ? "/isekai/hvlog/logs" : "/hvlog/logs")
        )
        url.searchParams.append("id", item.logId)

        return (
            <TableRow
                key={idx}
                className="cursor-pointer"
                onClick={() => (window.location.href = url.href)}
            >
                <TableCell>{item.equip}</TableCell>

                <TableCell className="text-right">
                    {item.date}
                </TableCell>

                <TableCell>{item.battleType}</TableCell>

                <TableCell>
                    <span className="flex justify-center items-center w-full">
                        {item.isClearBonus ? <CheckIcon /> : " "}
                    </span>
                </TableCell>

                <TableCell>
                    <Button
                        variant="ghost"
                        className="flex justify-center items-center w-full rounded-full cursor-pointer"
                    >
                        <a
                            href={url.href}
                            className="underline text-blue-300"
                        >
                            <ArrowExternalIcon className="size-5" />
                        </a>
                    </Button>
                </TableCell>
            </TableRow>
        )
    })

    return (
        <Table className="equip-log w-auto min-h-0 mb-8 mx-auto">
            <TableHeader>
                <TableRow>
                    <TableHead>Equip</TableHead>
                    <TableHead className="text-right">Date</TableHead>
                    <TableHead>Battle Type</TableHead>
                    <TableHead className="text-center">
                        Clear Bonus?
                    </TableHead>
                    <TableHead className="text-center"></TableHead>
                </TableRow>
            </TableHeader>

            <TableBody>{...rowEls}</TableBody>
        </Table>
    )
})

interface TableItem {
    equip: string
    logId: LogId
    start: string
    date: string
    battleType: string
    isClearBonus: boolean
    isIsekai: boolean
}

function useTableItems(): TableItem[] {
    const { logIds, getLogType } = useLogContext()

    const [filters, setFilters] = useLocalJsonState(
        {
            prefixes: ["Peerless", "Legendary", "Magnificent"],
            isekai: true,
            persistent: true,
        },
        "hvlog_equip_log_filter"
    )

    const { stats } = useStatsMaybe(
        [...logIds.values().map(({ id }) => id)],
        {
            summary: true,
            equipDrops: true,
        }
    )

    const items: TableItem[] = useMemo(() => {
        let items: TableItem[] = []
        const ids = [...logIds.values().map(({ id }) => id)]

        for (const [s, id] of zip(stats, ids)) {
            const type = getLogType(id)
            if (!filters[type]) {
                continue
            }

            const { summary, equipDrops } = s ?? {}
            if (!equipDrops || !summary) {
                continue
            }

            const goodDrops = equipDrops.filter((x) =>
                filters.prefixes.some((patt) =>
                    x.equip.startsWith(patt)
                )
            )

            const d = new Date(summary.start)
            const dateStr =
                [
                    `${d.getHours().toString().padStart(2, "0")}`,
                    `${d.getMinutes().toString().padStart(2, "0")}`,
                ].join(":") +
                " " +
                [
                    `${d.getDate().toString().padStart(2, "0")}`,
                    `${d.getMonth().toString().padStart(2, "0")}`,
                    `${d.getFullYear()}`,
                ].join("-")

            for (const x of goodDrops) {
                items.push({
                    battleType:
                        preprocessBattleTypeSingle(summary).content,
                    start: summary.start,
                    date: dateStr,
                    equip: x.equip,
                    logId: id,
                    isClearBonus: x.isClearBonus,
                    isIsekai: type === "isekai",
                })
            }
        }

        items = alphabetical(items, (it) => it.start)

        return items
    }, [stats, logIds, filters])

    return items
}
