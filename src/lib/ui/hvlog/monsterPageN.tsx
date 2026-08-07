import { formatNumber, newContext, useAsync } from "@/lib/utils/miscUtils"
import { lucide } from "../constants"
import { ListTable } from "../listTable"
import { LOG_SOURCE } from "./logSource"
import { UrlParamN } from "./router"
import { useMemo, useState } from "react"
import { alphabetical, clamp, range, sortBy, sum } from "myutils"

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
            content: formatNumber(100 * x.damage.taken) + "%",
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
} as const satisfies UrlParamN.Schema

// region namespace
export namespace MonsterPageN {
    export const COLS = COLS_
    export const SCHEMA = PARAM_SCHEMA

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

        const allRows: Array<MonsterPageN.Row> = useMemo(() => {
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

        const filtered = useMemo(() => {
            let xs = range(allRows.length)

            const nm = params.nm
                .map((x) => x.trim().toLowerCase())
                .filter((x) => x.length > 0)
            if (nm.length > 0) {
                xs = xs.filter((x) =>
                    nm.some(
                        (patt) =>
                            patt.trim().length > 0 &&
                            allRows[x].name
                                .toLowerCase()
                                .includes(patt.toLowerCase()),
                    ),
                )
            }
            const tr = params.tr
                .map((x) => x.trim().toLowerCase())
                .filter((x) => x.length > 0)
            if (tr.length > 0) {
                xs = xs.filter((x) =>
                    tr.some(
                        (patt) =>
                            patt.trim().length > 0 &&
                            (allRows[x].trainer ?? "")
                                .toLowerCase()
                                .includes(patt.toLowerCase()),
                    ),
                )
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
                xs = xs.filter((x) => allRows[x].pl ?? 0 >= params.l0!)
            }
            if (Number.isInteger(params.l1)) {
                xs = xs.filter((x) => allRows[x].pl ?? 0 <= params.l1!)
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
                        switch (cid) {
                            case "mid":
                                return allRows[x].mid
                            case "name":
                                return allRows[x].name
                            case "frequency":
                                return allRows[x].appearances
                            case "dtaken":
                                return allRows[x].damage.taken
                            case "dgiven":
                                return allRows[x].damage.given
                            case "trainer":
                                return allRows[x].trainer ?? ""
                            case "pl":
                                return allRows[x].pl ?? 0
                            case "race":
                                return allRows[x].race ?? ""
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
                name: alphabetical(
                    Array.from(
                        new Set(
                            allRows.flatMap((x) =>
                                x.name.length > 0 ? [x.name] : [],
                            ),
                        ),
                    ),
                ),
                trainer: alphabetical(
                    Array.from(
                        new Set(
                            allRows.flatMap((x) =>
                                x.trainer ? [x.trainer] : [],
                            ),
                        ),
                    ),
                ),
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
            },
            () => {},
        ]
    })
}
