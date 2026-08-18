import { LogDb } from "@/lib/db/db"
import { DbN } from "@/lib/db/dbN"
import { decompressZstd } from "@/lib/utils/miscUtils"
import {
    alphabeticalBy,
    ISODate,
    mapEntries,
    newContext,
    objectValues,
    range,
    sleep,
    sort,
    useAsync2,
} from "myutils"
import { useMemo, useRef, useState } from "react"
import { CheckIcon } from "../icons/tailwind"
import { ListTable, ListTableN } from "../listTable"
import { LogListN } from "./logList/logListN"
import { UrlParamN } from "./router"
import { EQUIP_TIERS } from "@/lib/constants"
import { humanizeBattleType, MetaSummary } from "@/lib/stats/metaStats"

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
            className="text-[length:0.75em]"
            data={ctx.page}
            cols={[
                EquipPageN.COLS_.name,
                EquipPageN.COLS_.date,
                EquipPageN.COLS_.battleType,
                EquipPageN.COLS_.bonus,
            ]}
            sortCriteria={
                ctx.params.s.v
                    ? {
                          cid: ctx.params.s.v.id,
                          order: ctx.params.d.v ? "desc" : "asc",
                      }
                    : null
            }
            setSortCriteria={(s) => {
                if (s) {
                    ctx.setParams({
                        s: s.cid,
                        d: s.order === "desc",
                    })
                } else {
                    ctx.setParams({
                        s: null,
                        d: null,
                    })
                }
            }}
            getId={(r) => r.id + r.idx}
            sortCols={
                new Set([
                    EquipPageN.COLS_.name.id,
                    EquipPageN.COLS_.date.id,
                    EquipPageN.COLS_.battleType.id,
                    EquipPageN.COLS_.bonus.id,
                ])
            }
            count={ctx.count}
            pageSize={ctx.pageSize}
            setPageSize={{
                options: [25, 100, 1000, 12345, 999999],
                handler: (sz) => ctx.setParams({ n: sz }),
            }}
            pageIndex={ctx.pageIndex}
            setPageIndex={(idx) => ctx.setParams({ p: idx })}
            isLoading={ctx.isLoading}
        />
    )
}

// #region EQUIP_PAGE
const EQUIP_PAGE = newContext(() => {
    const [params, setParams] = UrlParamN.useUrlParams({
        schema: EquipPageN.PARAM_SCHEMA,
    })

    const data = useRef([] as Array<EquipPageN.Row>).current
    const [dataVersion, setDataVersion] = useState(0)
    const [isLoading, setIsLoading] = useState(true)
    useAsync2(async () => {
        const dbP = await new LogDb({ world: "persistent" }).connect()
        const dummy: any = {}

        let equips: EquipPageN.IdbStorage
        while (true) {
            const equipTally = await dbP.get("kv", "equipTally")
            if (!equipTally || equipTally.equips.byteLength === 0) {
                setIsLoading(true)
                await sleep(5_000)
                continue
            }

            const decompressed = await decompressZstd({ x: equipTally.equips })
            const text = await new Blob([decompressed]).text()
            equips = JSON.parse(text)

            if (data.length === equips.id.length) {
                if (equipTally.pending) {
                    if (data.length < 50) {
                        await sleep(10_000)
                    } else {
                        await sleep(30_000)
                    }
                } else {
                    setIsLoading(false)
                    await sleep(30_000)
                }
                continue
            }

            for (let idx = data.length; idx < equips.id.length; idx += 1) {
                const i = idx
                data.push(
                    new Proxy({} as EquipPageN.Row, {
                        get(target, key) {
                            if (key in equips) {
                                return (equips as any)[key][i]
                            } else {
                                return dummy[key]
                            }
                        },
                    }),
                )
            }

            setIsLoading(equipTally.pending)
            setDataVersion((v) => v + 1)

            return
        }
    }, [])

    const [page, count]: [EquipPageN.Row[], number] = useMemo(() => {
        let idxs = range(data.length)
        if (params.et.v.length > 0) {
            idxs = idxs.filter((idx) =>
                params.et.v.some((tier) =>
                    data[idx].name.startsWith(tier + " "),
                ),
            )
        }
        if (params.bt.v) {
            const bts = new Set(params.bt.v)
            idxs = idxs.filter((idx) => bts.has(data[idx].battleTypeId ?? ""))
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
        if (params.nm.v.length > 0) {
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
            case "type":
                idxs = alphabeticalBy(
                    idxs,
                    (idx) =>
                        data[idx].battleTypeId ?? (sortDesc ? "aaa" : "zzz"),
                    sortDesc,
                )
                break
            case "bonus":
                idxs = sort(idxs, (idx) => +data[idx].isBonus, sortDesc)
                break
        }

        const st = params.p.v * params.n.v
        const page = idxs.slice(st, st + params.n.v)
        return [page.map((idx) => data[idx]), idxs.length] as const
    }, [
        dataVersion,
        ...objectValues(mapEntries(params, (k, v) => ({ [k]: v.raw }))),
    ])

    return {
        value: {
            page,
            pageSize: params.n.v,
            pageIndex: params.p.v,
            pageCount: Math.ceil(count / params.n.v),
            count,
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
export namespace EquipPageN {
    type Bt = Exclude<MetaSummary["battleType"], null>
    export interface Row {
        id: DbN.LogId
        idx: number
        name: string
        battleTypeId: Bt["id"] | null
        battleTypeCategory: Bt["category"] | null
        battleTypeCategoryValue: Bt["categoryValue"] | null
        roundMax: number | null
        date: ISODate
        isBonus: boolean
        world: DbN.HvWorld
    }
    export type IdbStorage = {
        [K in keyof Row]: Array<Row[K]>
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
            id: "type",
            header: {
                content: "Battle Type",
            },
            cell: (r) => ({
                content:
                    r.battleTypeId && r.battleTypeCategory && r.roundMax
                        ? humanizeBattleType(
                              {
                                  id: r.battleTypeId,
                                  category: r.battleTypeCategory,
                                  categoryValue: r.battleTypeCategoryValue!,
                              },
                              r.roundMax,
                          )
                        : "???",
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
                content: (
                    <>
                        Clear
                        <br />
                        Bonus?
                    </>
                ),
            },
            cell: (r) => ({
                content: r.isBonus ? <CheckIcon /> : " ",
                className: "flex justify-center",
            }),
            align: "text-center",
        },
    } as const satisfies Record<string, ListTableN.Column<Row>>

    export const PARAM_SCHEMA = {
        // Pagination options
        p: {
            type: "number",
            deser: (x) => (x !== null && x >= 1 ? x - 1 : 0),
            init: () => 0,
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
        et: {
            type: "bitmask",
            deser: (idxs) =>
                idxs.map((idx) => EQUIP_TIERS[idx]).filter((x) => !!x),
            init: () => [1, 2],
        },
    } as const satisfies UrlParamN.Schema
}
// #endregion
