import { MonsterSummary } from "@/lib/summary"
import { ListTable } from "../listTable"
import { alphabeticalBy, sort, sum } from "myutils"
import { formatNumber, useAsync } from "@/lib/utils/miscUtils"
import { LOG_SOURCE } from "./logSource"
import { useMemo, useState } from "react"
import { lucide } from "../constants"

export function MonsterPage(props: {}) {
    const logSource = LOG_SOURCE.useContext()
    const mobQuery = useAsync(
        async () => await logSource.fetchGlobalMonsterSummary(),
        {},
    )
    const monlabQuery = useAsync(async () => await logSource.fetchMonlab(), {})

    const [age, setAge] = useState<number | null>(null)
    const [page, setPage] = useState({
        idx: 0,
        size: 25,
        sort: null as null | ListTable.SortCriteria,
    })

    const rows: Array<MonsterPageN.Row> = useMemo(() => {
        if (!mobQuery.data) {
            return []
        }

        const d = mobQuery.data.find((x) => x.days === age)!
        const m = d.monsters

        const rows: Array<MonsterPageN.Row> = []
        let totalAppearances = 0
        for (let idx = 0; idx < m.mid.length; idx++) {
            totalAppearances += m.appearances[idx]

            const mid = parseInt(m.mid[idx])
            const ml = monlabQuery.data?.[mid]

            rows.push({
                mid,
                name: m.name[idx],
                appearances: m.appearances[idx],
                globalCount: 0,
                hp: m.hp[idx],
                level: m.level[idx],
                damage: {
                    given:
                        sum(
                            Object.values(m.damage.given).map(
                                (v) => v.total[idx],
                            ),
                        ) / m.appearances[idx],
                    taken:
                        sum(
                            Object.values(m.damage.taken).map(
                                (v) => v.total[idx],
                            ),
                        ) /
                        sum(
                            Object.values(m.damage.taken).map(
                                (v) => v.count[idx],
                            ),
                        ),
                },
                trainer: ml?.trainer ?? null,
                race: ml?.monsterClass ?? null,
                pl: ml?.plvl ?? null,
            })
        }

        for (const r of rows) {
            r.globalCount = totalAppearances
        }

        return rows
    }, [mobQuery.data, monlabQuery.data])

    const data = useMemo(() => {
        const cid = page.sort?.cid ?? MonsterPageN.COLS.frequency.id
        const order = page.sort?.order ?? "desc"

        let rowsSorted = rows
        let vn: ((x: MonsterPageN.Row) => number) | null = null
        let vs: ((x: MonsterPageN.Row) => string) | null = null
        switch (cid) {
            case MonsterPageN.COLS.frequency.id:
                vn ||= (x) => x.appearances
            case MonsterPageN.COLS.damageGiven.id:
                vn ||= (x) => x.damage.given
            case MonsterPageN.COLS.damageTaken.id:
                vn ||= (x) => x.damage.taken
            case MonsterPageN.COLS.pl.id:
                vn ||= (x) => x.pl ?? 0
                rowsSorted = sort(rows, vn, order === "desc")
                break
            case MonsterPageN.COLS.name.id:
                vs ||= (x) => x.name
            case MonsterPageN.COLS.trainer.id:
                vs ||= (x) =>
                    x.trainer ? x.trainer : order === "desc" ? "aaa" : "zzz"
            case MonsterPageN.COLS.race.id:
                vs ||= (x) =>
                    x.race ? x.race : order === "desc" ? "aaa" : "zzz"
                rowsSorted = alphabeticalBy(rows, vs, order === "desc")
                break
        }

        const st = page.idx * page.size
        return rowsSorted.slice(st, st + page.size)
    }, [rows, page])

    return (
        <div className="flex flex-col justify-center">
            <ListTable
                data={data}
                cols={[
                    MonsterPageN.COLS.name,
                    MonsterPageN.COLS.trainer,
                    MonsterPageN.COLS.pl,
                    MonsterPageN.COLS.race,
                    MonsterPageN.COLS.frequency,
                    MonsterPageN.COLS.damageGiven,
                    MonsterPageN.COLS.damageTaken,
                    // MonsterPageN.COLS.mid,
                ]}
                count={rows.length}
                getId={(d) => String(d.mid)}
                pageIndex={page.idx}
                setPageIndex={(idx) => {
                    setPage({ ...page, idx })
                }}
                setPageSize={{
                    options: [25, 100, 1000, 99999],
                    handler: (size: number) => {
                        setPage({ ...page, size })
                    },
                }}
                pageSize={page.size}
                sortCols={
                    new Set([
                        MonsterPageN.COLS.name.id,
                        MonsterPageN.COLS.trainer.id,
                        MonsterPageN.COLS.pl.id,
                        MonsterPageN.COLS.race.id,
                        MonsterPageN.COLS.frequency.id,
                        MonsterPageN.COLS.damageGiven.id,
                        MonsterPageN.COLS.damageTaken.id,
                        // MonsterPageN.COLS.mid.id,
                    ])
                }
                sortCriteria={page.sort}
                setSortCriteria={(sort) => {
                    setPage({ ...page, sort })
                }}
                className="monster-list"
                tableProps={{ className: "overflow-hidden" }}
            />
        </div>
    )
}

namespace MonsterPageN {
    export type Row = {
        mid: number
        name: string
        hp: number
        level: number
        appearances: number
        globalCount: number
        damage: {
            taken: number
            given: number
        }

        trainer: string | null
        race: string | null
        pl: number | null
    }

    export const COLS = {
        mid: {
            id: "mid",
            header: { content: "ID", className: "text-center" },
            align: "text-right",
            cell: (x) => ({
                content: x.mid,
                className: "mid",
            }),
        },
        name: {
            id: "name",
            header: { content: "Name" },
            align: "text-right",
            cell: (x) => ({
                content: x.name,
                className: "name",
            }),
        },
        frequency: {
            id: "frequency",
            header: { content: <lucide.Eye /> },
            align: "text-right",
            cell: (x) => ({
                content: Math.round(
                    x.appearances, // * (1_000_000 / x.globalCount),
                ),
            }),
        },
        damageTaken: {
            id: "damageTaken",
            header: { content: <lucide.Shield /> },
            align: "text-right",
            cell: (x) => ({
                content: formatNumber(100 * x.damage.taken) + "%",
                className: "taken",
            }),
        },
        damageGiven: {
            id: "damageGiven",
            header: { content: <lucide.Sword /> },
            align: "text-right",
            cell: (x) => ({
                content: Math.round(1000 * x.damage.given),
                className: "given",
            }),
        },
        trainer: {
            id: "trainer",
            header: { content: "Trainer" },
            align: "text-right",
            cell: (x) => ({
                content: x.trainer !== null ? x.trainer || "-" : "???",
                className: "trainer",
            }),
        },
        pl: {
            id: "pl",
            header: { content: "Level" },
            align: "text-right",
            cell: (x) => ({
                content: x.pl !== null ? x.pl || "-" : "???",
                className: "pl",
            }),
        },
        race: {
            id: "race",
            header: { content: "Race" },
            align: "text-right",
            cell: (x) => ({
                content: x.race !== null ? x.race || "-" : "???",
                className: "race",
            }),
        },
    } as const satisfies Record<string, ListTable.Column<Row, any>>
}
