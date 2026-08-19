import { LogDb } from "@/lib/db/db"
import { DbN } from "@/lib/db/dbN"
import { decompressZstd } from "@/lib/utils/miscUtils"
import {
    alphabeticalBy,
    cn,
    css,
    ISODate,
    mapEntries,
    newContext,
    objectValues,
    range,
    sleep,
    sort,
    useAsync2,
    useDebouncedWrite,
} from "myutils"
import {
    Fragment,
    useDeferredValue,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react"
import { CheckIcon } from "../icons/tailwind"
import { ListTable, ListTableN } from "../listTable"
import { LogListN } from "./logList/logListN"
import { UrlParamN } from "./router"
import { EQUIP_TIERS } from "@/lib/constants"
import { humanizeBattleType, MetaSummary } from "@/lib/stats/metaStats"
import { Input } from "../shadcn/input"

export function EquipPage(props: {}) {
    return (
        <EQUIP_PAGE.Provider>
            <style>{CSS}</style>
            <EquipPageInner />
        </EQUIP_PAGE.Provider>
    )
}

function EquipPageInner(props: {}) {
    const ctx = EQUIP_PAGE.useContext()

    const [nm, setNm] = useDebouncedWrite({
        value: ctx.params.nm.raw ?? "",
        onUpdate: (nm) => {
            ctx.setParams({
                nm: nm?.split(","),
            })
        },
    })

    return (
        <div className="equip-page flex flex-col items-center">
            <div className="p-4 pb-0 max-w-[40em] w-full">
                <Input
                    value={nm}
                    onInput={(ev) => {
                        setNm(ev.target.value)
                    }}
                    type="text"
                    className=""
                    placeholder="peerl oak des, leg sav slau"
                />
            </div>
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
                rowUrl={(r) => `/logs/${r.id}`}
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
        </div>
    )
}

// #region filter
function Filter() {
    const ctx = EQUIP_PAGE.useContext()

    return (
        <form className="rounded-md border p-4 text-xs flex flex-col gap-2"></form>
    )
}
// #endregion

// #region EquipName
const PEERLESS = [
    { color: "#f00", glow: "#ff4d4d" },
    { color: "#f90", glow: "#ffb84d" },
    { color: "#fc0", glow: "#ffe066" },
    { color: "#0c0", glow: "#4dff4d" },
    { color: "#09f", glow: "#4db8ff" },
    //{color: "#00c", glow: ""},
    { color: "#003dcc", glow: "#47afc9" },
    { color: "#c0f", glow: "#e066ff" },
    { color: "#f00", glow: "#ff4d4d" },
]
const RARES = new Set([
    "Charged",
    "Radiant",
    "Mystic",
    "Savage",
    "Slaughter",
    "Shadowdancer",
])
function EquipName(props: { value: string }) {
    const words = props.value
        .split(" ")
        .map((word, idx) => {
            if (word === "Peerless") {
                return (
                    <div key={idx} className="inline peerless">
                        {[...word].map((char, idx) => (
                            <span key={idx}>{char}</span>
                        ))}
                    </div>
                )
            } else {
                return (
                    <span
                        key={idx}
                        className={cn({
                            rare: RARES.has(word),
                        })}
                    >
                        {word}
                    </span>
                )
            }
        })
        .flatMap((x, idx) => [x, <Fragment key={idx + "_space"}> </Fragment>])

    return <div className="name">{...words}</div>
}
// #endregion

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
            const clauses: RegExp[][] = params.nm.v.map((text) =>
                text
                    .split(" ")
                    .map((word) => word.trim())
                    .filter((word) => word.length > 0)
                    .map((word) => new RegExp(word, "i")),
            )

            idxs = idxs.filter((idx) =>
                clauses.some((cl) =>
                    cl.every((word) => word.exec(data[idx].name)),
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
                content: <EquipName value={r.name} />,
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

// #region css
const CSS = css`
    .equip-page {
        font-size: 0.85em;

        h2 {
            font-size: 1em;
            font-weight: 500;
        }

        td > * {
            padding-top: calc(0.25em * 1);
            padding-bottom: calc(0.25em * 1);
        }

        tbody tr {
            border: 0;
        }
        thead tr {
            border-bottom: 0.1em solid rgba(50, 50, 50, 1);
        }

        tr:nth-child(2n + 1) {
            background-color: color-mix(
                in oklab,
                var(--color-muted) 25%,
                transparent
            ) !important;
        }
        tr:nth-child(2n + 2) {
            background-color: color-mix(
                in oklab,
                var(--color-muted) 50%,
                transparent
            ) !important;
        }
        tr:hover:not(.selected) {
            background-color: color-mix(
                in oklab,
                var(--color-muted) 100%,
                transparent
            ) !important;
        }

        .input-container {
            display: flex;
            flex-flow: column;
            gap: 0.5em;

            label {
                font-weight: 600;
            }

            input[type="number"] {
                height: max-content;
                padding: 0.4em 0.5em;
                line-height: 0;
            }
        }

        .peerless {
            :nth-child(1) {
                color: ${PEERLESS[0].color};
                --glow: ${PEERLESS[0].glow};
            }
            :nth-child(2) {
                color: ${PEERLESS[1].color};
                --glow: ${PEERLESS[1].glow};
            }
            :nth-child(3) {
                color: ${PEERLESS[2].color};
                --glow: ${PEERLESS[2].glow};
            }
            :nth-child(4) {
                color: ${PEERLESS[3].color};
                --glow: ${PEERLESS[3].glow};
            }
            :nth-child(5) {
                color: ${PEERLESS[4].color};
                --glow: ${PEERLESS[4].glow};
            }
            :nth-child(6) {
                color: ${PEERLESS[5].color};
                --glow: ${PEERLESS[5].glow};
            }
            :nth-child(7) {
                color: ${PEERLESS[6].color};
                --glow: ${PEERLESS[6].glow};
            }
            :nth-child(8) {
                color: ${PEERLESS[7].color};
                --glow: ${PEERLESS[7].glow};
            }

            * {
                /* --glow: color-mix(in oklch, #333, transparent 25%); */
                --glow-faded: color-mix(in oklch, var(--glow), transparent 50%);
                text-shadow:
                    0 0 1px var(--glow-faded),
                    0 0 2px var(--glow-faded),
                    0 0 4px var(--glow-faded),
                    0 0 8px var(--glow-faded);
            }
        }
        .rare {
            color: color-mix(in oklch, var(--primary), var(--foreground) 25%);
        }
        tr:hover .rare {
            color: color-mix(in oklch, var(--primary), var(--foreground) 5%);
        }
    }
`
// #endregion
