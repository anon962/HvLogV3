import { LogId } from "@/lib/logDb/logDb"
import { LogSummary } from "@/lib/summaryDb"
import "@/lib/ui/global.css"
import { setDefault } from "@/lib/utils/miscUtils"
import { RootComponent } from "@/lib/utils/userscriptUtils"
import { alphabetical, set, zip } from "radash"
import React, { SetStateAction, useMemo } from "react"
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
import {
    ARENA_ALIASES,
    preprocessBattleTypeSingle,
} from "../hvlog/logSummaryTable/cols"
import { SummaryDbProvider } from "../hvlog/summaryDbContext"
import { ArrowExternalIcon, CheckIcon } from "../icons/tailwind"
import { Button } from "../shadcn/button"
import { Checkbox } from "../shadcn/checkbox"
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

const DEFAULT_FILTERS = {
    prefixes: {
        peerless: true,
        legendary: true,
        magnificent: true,
        superior: false,
    },
    modes: {
        arena: true,
        rob: true,
        gf: true,
        iw: true,
        tower: true,
        re: true,
    },
    isekai: true,
    persistent: true,
}

const EquipLogInner = React.memo(() => {
    const items = useTableItems()
    const [filters, setFilters] = useLocalJsonState(
        DEFAULT_FILTERS,
        "hvlog_equip_log_filter"
    )

    const itemsFiltered = useMemo(() => {
        return items.filter((item) => {
            const { world, mode, prefix } = item.filters
            return (
                !!filters[world] &&
                !!(filters.modes as any)[mode] &&
                !!(filters.prefixes as any)[prefix]
            )
        })
    }, [items, filters])

    return (
        <div className="flex flex-col w-full py-8 max-w-[66rem] mx-auto h-full">
            <Filters
                items={items}
                filters={filters}
                setFilters={setFilters}
            />

            <hr className="my-6 border border-foreground/20" />

            <EquipTable items={itemsFiltered} />
        </div>
    )
})

const EquipTable = React.memo(({ items }: { items: TableItem[] }) => {
    const rowEls = items.map((item, idx) => {
        const url = new URL(
            location.origin +
                (item.filters.world === "isekai"
                    ? "/isekai/hvlog/logs"
                    : "/hvlog/logs")
        )
        url.searchParams.append("id", item.logId)

        return (
            <TableRow
                key={idx}
                className="cursor-pointer"
                onClick={() => (window.location.href = url.href)}
            >
                <TableCell className="text-right">
                    {items.length - idx}
                </TableCell>

                <TableCell>{item.equip}</TableCell>

                <TableCell className="text-right" title={item.start}>
                    {item.date}
                </TableCell>

                <TableCell className={item.filters.mode}>
                    {item.battleType}
                </TableCell>

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
        <Table className="equip-log w-auto mb-8 px-8 mx-auto">
            <TableHeader>
                <TableRow>
                    <TableHead className="w-[3rem] text-right">
                        #
                    </TableHead>
                    <TableHead className="w-[30rem]">Equip</TableHead>
                    <TableHead className="text-right">Date</TableHead>
                    <TableHead className="w-[10rem]">
                        Battle Type
                    </TableHead>
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

const Filters = React.memo(
    ({
        items,
        filters,
        setFilters,
    }: {
        items: TableItem[]
        filters: typeof DEFAULT_FILTERS
        setFilters: React.Dispatch<
            SetStateAction<typeof DEFAULT_FILTERS>
        >
    }) => {
        const prefixCounts = useMemo(() => {
            return items.reduce((acc, item) => {
                setDefault(acc, item.filters.prefix, 0)
                acc[item.filters.prefix] += 1
                return acc
            }, {} as Record<string, number>)
        }, [items])

        const prefixes = Object.entries(filters.prefixes).map(
            ([id, isEnabled]) => {
                return (
                    <FilterCheckbox
                        key={id}
                        checked={isEnabled}
                        label={`${PREFIX_FILTERS[id].label} (${
                            prefixCounts[id] ?? 0
                        })`}
                        path={`prefixes.${id}`}
                        setFilters={setFilters}
                    />
                )
            }
        )

        const modeCounts = useMemo(() => {
            return items.reduce((acc, item) => {
                setDefault(acc, item.filters.mode, 0)
                acc[item.filters.mode] += 1
                return acc
            }, {} as Record<string, number>)
        }, [items])

        const modes = Object.entries(filters.modes).map(
            ([id, isEnabled]) => {
                return (
                    <FilterCheckbox
                        key={id}
                        checked={isEnabled}
                        label={`${MODE_FILTERS[id].label} (${
                            modeCounts[id] ?? 0
                        })`}
                        path={`modes.${id}`}
                        setFilters={setFilters}
                    />
                )
            }
        )

        const worldCounts = useMemo(() => {
            return items.reduce((acc, item) => {
                setDefault(acc, item.filters.world, 0)
                acc[item.filters.world] += 1
                return acc
            }, {} as Record<string, number>)
        }, [items])

        return (
            <form className="flex flex-col gap-2">
                <div className="flex flex-col gap-1">
                    <h1 className="font-medium">Equip Type</h1>
                    <div className="pl-4 flex gap-4">
                        {...prefixes}
                    </div>
                </div>

                <div className="flex flex-col gap-1">
                    <h1 className="font-medium">Battle Type</h1>
                    <div className="pl-4 flex gap-4">{...modes}</div>
                </div>

                <div className="flex flex-col gap-1">
                    <h1 className="font-medium">World</h1>
                    <div className="pl-4 flex gap-4">
                        <FilterCheckbox
                            checked={filters.persistent}
                            label={`Persistent (${
                                worldCounts["persistent"] ?? 0
                            })`}
                            path="persistent"
                            setFilters={setFilters}
                        />

                        <FilterCheckbox
                            checked={filters.isekai}
                            label={`Isekai (${
                                worldCounts["isekai"] ?? 0
                            })`}
                            path="isekai"
                            setFilters={setFilters}
                        />
                    </div>
                </div>
            </form>
        )
    }
)

const FilterCheckbox = React.memo(
    ({
        label,
        checked,
        path,
        setFilters,
    }: {
        label: string
        checked: boolean
        path: string
        setFilters: React.Dispatch<
            SetStateAction<typeof DEFAULT_FILTERS>
        >
    }) => {
        const handleChange = (checked: boolean) => {
            setFilters((filters) => set(filters, path, checked))
        }

        return (
            <div
                onClick={(ev) => {
                    if (
                        (ev.target as HTMLElement).tagName !== "INPUT"
                    ) {
                        handleChange(!checked)
                    }
                }}
                className="flex gap-1 cursor-pointer items-center"
            >
                <Checkbox
                    className="cursor-pointer bg-primary/30! data-[state=checked]:bg-primary! text-background"
                    checked={checked}
                    onCheckedChange={handleChange}
                />
                <span>{label}</span>
            </div>
        )
    }
)

interface TableItem {
    equip: string
    logId: LogId
    start: string
    date: string
    battleType: string
    isClearBonus: boolean
    //
    filters: {
        world: "persistent" | "isekai"
        mode: string
        prefix: string
    }
}

const PREFIX_FILTERS: Record<
    string,
    { label: string; match: (equip: string) => boolean }
> = {
    peerless: {
        label: "Peerless",
        match: (eq) => !!eq.match(/peerless/i),
    },
    legendary: {
        label: "Legendary",
        match: (eq) => !!eq.match(/legendary/i),
    },
    magnificent: {
        label: "Magnificent",
        match: (eq) => !!eq.match(/magnificent/i),
    },
    superior: {
        label: "Superior",
        match: (eq) => !!eq.match(/superior/i),
    },
}

const MODE_FILTERS: Record<
    string,
    {
        label: string
        match: (bt: LogSummary["battleType"]) => boolean
    }
> = {
    gf: {
        label: "Grindfest",
        match: (bt) => bt?.name === "Grindfest",
    },
    iw: {
        label: "Item World",
        match: (bt) => bt?.name === "Item World",
    },
    tower: { label: "Tower", match: (bt) => bt?.name === "Tower" },
    re: {
        label: "Random Encounter",
        match: (bt) => bt?.name === "random encounter",
    },
    arena: {
        label: "Arena",
        match: (bt) =>
            bt?.name === "Arena" &&
            !ARENA_ALIASES[bt.id]?.startsWith("RoB"),
    },
    rob: {
        label: "Ring of Blood",
        match: (bt) =>
            bt?.name === "Arena" &&
            !!ARENA_ALIASES[bt.id]?.startsWith("RoB"),
    },
}

function useTableItems() {
    const { logIds, getLogType } = useLogContext()

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

            const { summary, equipDrops } = s ?? {}
            if (!equipDrops || !summary) {
                continue
            }

            const mode =
                Object.entries(MODE_FILTERS).find(([id, { match }]) =>
                    match(summary.battleType)
                )?.[0] ?? ""

            const d = new Date(summary.start)
            const dateStr =
                // [
                //     `${d.getHours().toString().padStart(2, "0")}`,
                //     `${d.getMinutes().toString().padStart(2, "0")}`,
                // ].join(":") +
                // " " +
                [
                    `${d.getDate().toString().padStart(2, "0")}`,
                    `${d.getMonth().toString().padStart(2, "0")}`,
                    `${d.getFullYear()}`,
                ].join("-")

            for (const x of equipDrops) {
                const prefix =
                    Object.entries(PREFIX_FILTERS).find(
                        ([id, { match }]) => match(x.equip)
                    )?.[0] ?? ""

                items.push({
                    battleType:
                        preprocessBattleTypeSingle(summary).content,
                    start: summary.start,
                    date: dateStr,
                    equip: x.equip,
                    logId: id,
                    isClearBonus: x.isClearBonus,
                    filters: {
                        world: type,
                        mode: mode,
                        prefix: prefix,
                    },
                })
            }
        }

        items = alphabetical(items, (it) => it.start, "desc")

        return items
    }, [stats, logIds])

    return items
}
