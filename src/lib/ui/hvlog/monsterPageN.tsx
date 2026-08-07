import { formatNumber, newContext, useAsync } from "@/lib/utils/miscUtils"
import {
    alphabetical,
    clamp,
    dedupe,
    enumerate,
    NgramSearch,
    range,
    sortBy,
    sum,
} from "myutils"
import { useMemo, useState } from "react"
import { lucide } from "../constants"
import { ListTable } from "../listTable"
import { LOG_SOURCE } from "./logSource"
import { UrlParamN } from "./router"

// region cols
const COLS_ = {
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
        header: {
            content: <lucide.Eye />,
            tooltip: "Number of appearances (all-time).",
        },
        align: "text-right",
        cell: (x) => ({
            content: Math.round(x.appearances),
        }),
    },
    dtaken: {
        id: "dtaken",
        header: {
            content: <lucide.Shield />,
            tooltip:
                "Monster's average damage taken per hit as percentage of max HP.",
        },
        align: "text-right",
        cell: (x) => ({
            content:
                formatNumber((100 * x.damage.taken) / x.damage.takenHits) + "%",
            className: "taken",
        }),
    },
    dgiven: {
        id: "dgiven",
        header: {
            content: <lucide.Sword />,
            tooltip: "Average damage per appearance.",
        },
        align: "text-right",
        cell: (x) => ({
            content: Math.round((1000 * x.damage.given) / x.appearances),
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
    mobcount: {
        id: "mobcount",
        header: { content: "Monsters" },
        align: "text-right",
        cell: (x) => ({
            content: x.filterIds.size,
            className: "mobcount",
        }),
    },
} as const satisfies Record<string, ListTable.Column<MonsterPageN.Row, any>>

// region params
const PARAM_SCHEMA = {
    // Search options
    p: {
        type: "number",
        deser: (x) => (x !== null && x >= 1 ? x - 1 : 0),
    },
    n: {
        type: "number",
    },
    s: {
        type: "string",
        deser: (x) =>
            Object.values(COLS_).find((v) => v.id === x?.toLowerCase()) ?? null,
    },
    d: {
        type: "boolean",
    },
    m: {
        type: "string",
    },
    // Filter options
    nm: {
        type: "string[]",
        // deser: (xs) => xs.map((x) => (x.length > 0 ? x : null)),
        allowEmpty: true,
        skipTrim: true,
    },
    tr: {
        type: "string[]",
        // deser: (xs) => xs.map((x) => (x.length > 0 ? x : null)),
        allowEmpty: true,
        skipTrim: true,
    },
    rc: {
        type: "string[]",
        // deser: (xs) => xs.map((x) => (x.length > 0 ? x : null)),
        allowEmpty: true,
        skipTrim: true,
    },
    l0: {
        type: "number",
    },
    l1: {
        type: "number",
    },
    v0: {
        type: "number",
    },
    a0: {
        type: "number",
    },
    d0: {
        type: "number",
    },
    c0: {
        type: "number",
    },
} as const satisfies UrlParamN.Schema

// region namespace
export namespace MonsterPageN {
    export const COLS = COLS_
    export const SCHEMA = PARAM_SCHEMA

    export type Row = {
        id: string
        mid: number
        name: string
        hp: number
        level: number
        appearances: number
        globalCount: number
        damage: {
            taken: number
            takenHits: number
            given: number
        }
        filterIds: Set<number>

        trainer: string | null
        race: string | null
        pl: number | null
    }

    export const ctx = newContext(() => {
        const logSource = LOG_SOURCE.useContext()
        const mobQuery = useAsync(
            async () => await logSource.fetchGlobalMonsterSummary(),
            {},
        )
        const monlabQuery = useAsync(
            async () => await logSource.fetchMonlab(),
            {},
        )

        const [params, setParams, rawParams] = UrlParamN.useUrlParams({
            schema: PARAM_SCHEMA,
        })

        const [mode, setMode] = useState(
            params.m === "t" ? "trainers" : "monsters",
        )

        const monsterRows: Array<MonsterPageN.Row> = useMemo(() => {
            if (!mobQuery.data) {
                return []
            }

            const d = mobQuery.data.find((x) => x.days === null)!
            const m = d.monsters

            const rows: Array<MonsterPageN.Row> = []
            let totalAppearances = 0
            for (let idx = 0; idx < m.mid.length; idx++) {
                totalAppearances += m.appearances[idx]

                const mid = parseInt(m.mid[idx])
                const ml = monlabQuery.data?.[mid]

                rows.push({
                    id: String(mid),
                    mid,
                    name: m.name[idx],
                    appearances: m.appearances[idx],
                    globalCount: 0,
                    hp: m.hp[idx],
                    level: m.level[idx],
                    damage: {
                        given: sum(
                            Object.values(m.damage.given).map(
                                (v) => v.total[idx],
                            ),
                        ),
                        taken: sum(
                            Object.values(m.damage.taken).map(
                                (v) => v.total[idx],
                            ),
                        ),
                        takenHits: sum(
                            Object.values(m.damage.taken).map(
                                (v) => v.count[idx],
                            ),
                        ),
                    },
                    filterIds: new Set([mid]),
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

        const trainerRows: Array<MonsterPageN.Row> = useMemo(() => {
            const trainerMap = new Map<string, MonsterPageN.Row>()
            for (const r of monsterRows) {
                if (r.trainer === null) {
                    continue
                }

                let t: MonsterPageN.Row
                if (!trainerMap.has(r.trainer)) {
                    t = {
                        ...r,
                        id: r.trainer,
                        filterIds: new Set(),
                        mid: -1,
                        hp: -1,
                        level: -1,
                        name: "",
                        appearances: 0,
                        damage: {
                            taken: 0,
                            takenHits: 0,
                            given: 0,
                        },
                    }
                    trainerMap.set(r.trainer, t)
                } else {
                    t = trainerMap.get(r.trainer)!
                }

                t.filterIds.add(r.mid)
                t.appearances += r.appearances
                t.damage.taken += r.damage.taken
                t.damage.takenHits += r.damage.takenHits
                t.damage.given += r.damage.given
            }

            return [...trainerMap.values()]
        }, [monsterRows])

        const allRows = useMemo(
            () => (mode === "monsters" ? monsterRows : trainerRows),
            [mode, monsterRows, trainerRows],
        )

        const [namePool, nameGrams] = useMemo(() => {
            const names = monsterRows.map((x) => x.name)
            const namePool = alphabetical(
                names.flatMap((x) => (x.length > 0 ? [x] : [])),
            )
            const nameGrams = new NgramSearch({
                items: names.map((x, idx) => ({
                    id: monsterRows[idx].mid,
                    text: x,
                })),
                cacheSize: 2,
            })
            return [namePool, nameGrams]
        }, [monsterRows])

        const [trainerPool, trainerGrams] = useMemo(() => {
            const trainers = monsterRows.map((x) => x.trainer)
            const trainerPool = alphabetical(
                trainers.flatMap((x) =>
                    x !== null && x.length > 0 ? [x] : [],
                ),
            )
            const nameGrams = new NgramSearch({
                items: trainers.flatMap((x, idx) =>
                    x !== null ? [{ id: monsterRows[idx].mid, text: x }] : [],
                ),
                cacheSize: 2,
            })
            return [trainerPool, nameGrams]
        }, [monsterRows])

        const midToIdx = useMemo(() => {
            const midToIdx = new Map<number, number>()
            for (const [idx, x] of enumerate(allRows)) {
                for (const mid of x.filterIds) {
                    midToIdx.set(mid, idx)
                }
            }
            return midToIdx
        }, [allRows])

        const filtered = useMemo(() => {
            let xs = range(allRows.length)

            const nm = params.nm
                .map((x) => x.trim().toLowerCase())
                .filter((x) => x.length > 0)
            if (nm.length > 0) {
                xs = dedupe(
                    nm.flatMap((patt) => nameGrams.find(patt)),
                    (x) => x.id,
                )[0].map((x) => midToIdx.get(x.id)!)
            }

            const tr = params.tr
                .map((x) => x.trim().toLowerCase())
                .filter((x) => x.length > 0)
            if (tr.length > 0) {
                xs = dedupe(
                    tr.flatMap((patt) => trainerGrams.find(patt)),
                    (x) => x.id,
                )[0].map((x) => midToIdx.get(x.id)!)
            }

            const rc = params.rc
                .map((x) => x.trim().toLowerCase())
                .filter((x) => x.length > 0)
            if (rc.length > 0) {
                xs = xs.filter((x) =>
                    rc.some(
                        (patt) =>
                            patt.trim().length > 0 &&
                            (allRows[x].race ?? "")
                                .toLowerCase()
                                .includes(patt.toLowerCase()),
                    ),
                )
            }
            if (Number.isInteger(params.l0)) {
                xs = xs.filter((x) => (allRows[x].pl ?? 0) >= params.l0!)
            }
            if (Number.isInteger(params.l1)) {
                xs = xs.filter((x) => (allRows[x].pl ?? 0) <= params.l1!)
            }
            if (Number.isInteger(params.v0)) {
                xs = xs.filter((x) => allRows[x].appearances >= params.v0!)
            }
            if (Number.isInteger(params.a0)) {
                xs = xs.filter(
                    (x) => allRows[x].damage.given * 1000 >= params.a0!,
                )
            }
            if (Number.isInteger(params.d0)) {
                xs = xs.filter((x) => allRows[x].damage.taken >= params.d0!)
            }
            if (Number.isInteger(params.c0)) {
                xs = xs.filter((x) => allRows[x].filterIds.size >= params.c0!)
            }

            return xs
        }, [
            allRows,
            params.nm,
            params.tr,
            params.rc,
            params.l0,
            params.l1,
            params.v0,
            params.a0,
            params.d0,
        ])

        const sorted = useMemo(() => {
            const cid = params.s?.id ?? COLS_.frequency.id
            const reverse = params.d !== null ? params.d : true
            let xs = filtered

            xs = sortBy(xs, [
                {
                    fn: (x) => {
                        const r = allRows[x]
                        switch (cid) {
                            case "mid":
                                return r.mid
                            case "name":
                                return r.name
                            case "frequency":
                                return r.appearances
                            case "dtaken":
                                return r.damage.taken / r.damage.takenHits
                            case "dgiven":
                                return r.damage.given / r.appearances
                            case "trainer":
                                return r.trainer ?? ""
                            case "pl":
                                return r.pl ?? 0
                            case "race":
                                return r.race ?? ""
                            case "mobcount":
                                return r.filterIds.size
                        }
                    },
                    reverse,
                },
            ])

            return xs
        }, [filtered, params.s, params.d])

        const pageSize = params.n ?? 25
        const pageCount = Math.ceil(sorted.length / pageSize) || 1
        const pageIndex = clamp(params.p, 0, pageCount - 1)
        const data = useMemo(() => {
            const st = pageIndex * pageSize
            return sorted.slice(st, st + pageSize).map((idx) => allRows[idx])
        }, [sorted, pageSize, pageIndex])

        const options = useMemo(() => {
            return {
                namePool,
                nameGrams,
                trainerPool,
                trainerGrams,
                race: alphabetical(
                    Array.from(
                        new Set(
                            allRows.flatMap((x) => (x.race ? [x.race] : [])),
                        ),
                    ),
                ),
                maxLevel: Math.max(...allRows.map((x) => x.pl ?? 0)),
                maxAppearances: Math.max(
                    ...allRows.map((x) => x.appearances ?? 0),
                ),
                maxAttack: Math.max(...allRows.map((x) => x.damage.given)),
                maxDefense: Math.max(...allRows.map((x) => x.damage.taken)),
            }
        }, [allRows])

        return [
            {
                data,
                pageIndex,
                pageSize,
                pageCount,
                params,
                setParams,
                rawParams,
                sortCol: params.s,
                options,
                mode,
                setMode,
            },
            () => {},
        ]
    })
}
