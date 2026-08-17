import { DbN } from "@/lib/db/dbN"
import { LOG_SOURCE } from "@/lib/db/logSource"
import { DetailsSummary } from "@/lib/stats/summary"
import {
    alphabeticalBy,
    ISODate,
    mapEntries,
    newContext,
    objectValues,
    range,
    resolveSequential,
    sleep,
    sort,
    useAsync2,
} from "myutils"
import { useMemo, useState } from "react"
import { CheckIcon } from "../icons/tailwind"
import { ListTable, ListTableN } from "../listTable"
import { LogListN } from "./logList/logListN"
import { UrlParamN } from "./router"

export function EquipPage(props: {}) {
    return (
        <EQUIP_PAGE.Provider>
            <EquipPageInner />
        </EQUIP_PAGE.Provider>
    )
}

function EquipPageInner(props: {}) {
    const ctx = EQUIP_PAGE.useContext()
    return (
        <ListTable
            data={ctx.page}
            cols={[
                N.COLS_.name,
                N.COLS_.date,
                N.COLS_.battleType,
                N.COLS_.bonus,
            ]}
            sortCriteria={
                ctx.params.s.v
                    ? {
                          cid: ctx.params.s.v.id,
                          order: ctx.params.d.v ? "desc" : "asc",
                      }
                    : null
            }
            setSortCriteria={() => {}}
            getId={(r) => r.id}
            sortCols={
                new Set([
                    N.COLS_.name.id,
                    N.COLS_.date.id,
                    N.COLS_.battleType.id,
                    N.COLS_.bonus.id,
                ])
            }
            count={ctx.count}
            pageSize={ctx.pageSize}
            setPageSize={{
                options: [25, 100, 1000, 999999],
                handler: () => {},
            }}
            pageIndex={ctx.pageIndex}
            isLoading={ctx.isLoading}
        />
    )
}

// #region EQUIP_PAGE
const EQUIP_PAGE = newContext(() => {
    const [params, setParams] = UrlParamN.useUrlParams({
        schema: N.PARAM_SCHEMA,
    })

    const src = LOG_SOURCE.useContext()
    const [data, setData] = useState<Array<N.Row>>([])
    const [seen, setSeen] = useState(new Set<DbN.LogId>())
    const [isLoading, setIsLoading] = useState(true)
    useAsync2(async () => {
        while (true) {
            const ids = new Set(await src.fetchLogIds())
            const rem = ids.difference(seen)
            if (!rem) {
                await sleep(30_000)
                continue
            }

            const slice = [...rem].slice(0, seen.size > 0 ? 250 : 100)

            const xs = (
                await resolveSequential(
                    slice.map((id) => async () => {
                        console.log("here", id)
                        const [meta, details] = await Promise.all([
                            src.fetchMeta(id),
                            src.fetchDetails(id),
                        ])
                        return { meta, details }
                    }),
                )
            ).flatMap(({ meta, details }, idx) =>
                Object.values(details.drops)
                    .filter((x) => x.isEquip)
                    .map((x) => ({
                        id: String(data.length + idx),
                        name: x.name,
                        battleType: details.meta.battleType?.id ?? "???",
                        date: meta.startedAt,
                        isBonus: x.isBonus,
                    })),
            )

            setSeen(seen.union(new Set(rem)))
            setData([...data, ...xs])
            setIsLoading(slice.length < rem.size)
            return
        }
    }, seen)

    const page: N.Row[] = useMemo(() => {
        let idxs = range(data.length)

        if (params.bt.v) {
            const bts = new Set(params.bt.v)
            idxs = idxs.filter((idx) => bts.has(data[idx].battleType))
        }
        if (params.d0.v) {
            const d0 = params.d0.v.toISOString()
            idxs = idxs.filter((idx) => data[idx].date >= d0)
        }
        if (params.d1.v) {
            const d1 = params.d1.v.toISOString()
            idxs = idxs.filter((idx) => data[idx].date >= d1)
        }
        if (params.bs.v !== null) {
            const bs = !!params.bs.v
            idxs = idxs.filter((idx) => data[idx].isBonus === bs)
        }
        if (params.nm.v) {
            const clauses: string[][] = params.nm.v.map((text) =>
                text
                    .split(" ")
                    .map((word) => word.trim())
                    .filter((word) => word.length > 0)
                    .map((word) => word.toLocaleLowerCase()),
            )

            idxs = idxs.filter((idx) =>
                clauses.some((cl) =>
                    cl.every((word) => data[idx].name.includes(word)),
                ),
            )
        }

        const sortId = params.s.v?.id ?? "date"
        const sortDesc = params.d.v ?? true
        switch (sortId) {
            case "date":
                idxs = alphabeticalBy(idxs, (idx) => data[idx].date, sortDesc)
                break
            case "name":
                idxs = alphabeticalBy(idxs, (idx) => data[idx].name, sortDesc)
                break
            case "battleType":
                idxs = alphabeticalBy(
                    idxs,
                    (idx) => data[idx].battleType,
                    sortDesc,
                )
                break
            case "bonus":
                idxs = sort(idxs, (idx) => +data[idx].isBonus, sortDesc)
                break
        }

        const st = params.p.v * params.n.v
        const page = idxs.slice(st, st + params.n.v)
        return page.map((idx) => data[idx])
    }, [data, ...objectValues(mapEntries(params, (k, v) => ({ [k]: v.raw })))])

    return {
        value: {
            page,
            pageSize: params.n.v,
            pageIndex: params.p.v,
            pageCount: Math.ceil(data.length / params.n.v),
            count: data.length,
            params,
            setParams,
            sortCol: params.s,
            isLoading,
        },
        setValue: () => {},
    }
})
// #endregion

// #region namespace
namespace N {
    export interface Row {
        id: string
        name: string
        battleType: string
        date: ISODate
        isBonus: boolean
    }

    export const COLS_ = {
        name: {
            id: "name",
            header: {
                content: "Name",
            },
            cell: (r) => ({
                content: r.name,
            }),
        },
        battleType: {
            id: "battleType",
            header: {
                content: "Battle Type",
            },
            cell: (r) => ({
                content: r.battleType,
            }),
        },
        date: {
            id: "date",
            header: {
                content: "Date",
            },
            cell: (r) => {
                const d = new Date(r.date)
                const p = (x: any, n = 2) => String(x).padStart(n, "0")
                return {
                    content: `${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()}`,
                }
            },
        },
        bonus: {
            id: "bonus",
            header: {
                content: "Clear Bonus?",
            },
            cell: (r) => ({
                content: r.isBonus ? <CheckIcon /> : " ",
            }),
        },
    } as const satisfies Record<string, ListTableN.Column<Row>>

    export const PARAM_SCHEMA = {
        // Pagination options
        p: {
            type: "number",
            deser: (x) => (x !== null && x >= 1 ? x - 1 : 0),
        },
        n: {
            type: "number",
            init: () => 1000,
        },
        s: {
            type: "string",
            deser: (x) =>
                Object.values(COLS_).find((v) => v.id === x?.toLowerCase()) ??
                null,
        },
        d: {
            type: "boolean",
        },
        // Filter options
        nm: {
            type: "string[]",
            allowEmpty: true,
            skipTrim: true,
        },
        bt: {
            type: "bitmask",
            deser: (xs) => {
                let battleTypes = xs
                    .map((idx) => LogListN.BATTLE_TYPES[idx])
                    .filter((x) => !!x)

                if (battleTypes.length === 0) {
                    return null
                }

                return battleTypes.flatMap((bt) => [...bt.ids])
            },
        },
        d0: {
            type: "date",
        },
        d1: {
            type: "date",
        },
        bs: {
            type: "boolean",
        },
    } as const satisfies UrlParamN.Schema
}
// #endregion
