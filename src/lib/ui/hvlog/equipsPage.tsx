import { DEFAULT_PREFETCH_DELAY, EQUIP_TIERS } from "@/lib/constants"
import { LogDb } from "@/lib/db/db"
import { DbN } from "@/lib/db/dbN"
import { LOG_SOURCE } from "@/lib/db/logSource"
import { USERSCRIPT_CONFIG } from "@/lib/db/userscriptConfig"
import { humanizeBattleType, MetaSummary } from "@/lib/stats/metaStats"
import { decompressZstd, transposeForCss } from "@/lib/utils/miscUtils"
import { SlidersHorizontal } from "lucide-react"
import {
    alphabeticalBy,
    clamp,
    cn,
    css,
    isEqual,
    ISODate,
    mapEntries,
    newContext,
    objectEntries,
    objectValues,
    range,
    sleep,
    sort,
    useDebouncedWrite,
} from "myutils"
import { Fragment, useEffect, useMemo, useRef, useState } from "react"
import { CheckboxGroup } from "../checkboxGroup"
import { CheckIcon } from "../icons/tailwind"
import { ListTable, ListTableN } from "../listTable"
import { Input } from "../shadcn/input"
import { LogListN } from "./logList/logListN"
import { UrlParamN } from "./router"

export function EquipPage(props: {}) {
    return (
        <EQUIP_PAGE.Provider arg={null}>
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

    const { config } = USERSCRIPT_CONFIG.useContext()
    const logSource = LOG_SOURCE.useContext()

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
                    options: [25, 200, 500, 1000, 12345, 999999],
                    handler: (sz) => ctx.setParams({ n: sz }),
                }}
                pageIndex={ctx.pageIndex - 1}
                pageUrl={(pageIdx) => ({
                    ...mapEntries(ctx.params, (k, v) => ({ [k]: v.raw })),
                    p: String(pageIdx + 1),
                })}
                isLoading={ctx.isLoading}
                filter={{
                    content: <Filter />,
                    trigger: <SlidersHorizontal className="size-full" />,
                    active: ctx.hasFilters,
                }}
                onHover={useMemo(
                    () => ({
                        delay: config.prefetchDelay || DEFAULT_PREFETCH_DELAY,
                        fn: (r: EquipPageN.Row) => {
                            if (config.prefetchDelay < 0) {
                                return
                            }

                            logSource.prefetchDetails(r.id)
                        },
                    }),
                    [config],
                )}
            />
        </div>
    )
}

// #region filter
function Filter() {
    const ctx = EQUIP_PAGE.useContext()

    const [d0, setD0] = useDebouncedWrite({
        value: ctx.params.d0.v,
        onUpdate: (x) => {
            ctx.setParams({ d0: x })
        },
    })
    const [d1, setD1] = useDebouncedWrite({
        value: ctx.params.d1.v,
        onUpdate: (x) => {
            ctx.setParams({ d1: x })
        },
    })

    return (
        <form className="rounded-md border p-4 text-xs flex flex-col gap-2">
            <CheckboxGroup
                header="Battle Type"
                options={EquipPageN.BTS.map(({ label }) => ({
                    label,
                }))}
                checked={EquipPageN.BTS.map(({ ids }) =>
                    ctx.params.bt.v.some((id) => ids.has(id)),
                )}
                onCheckedChange={({ checked }) => {
                    ctx.setParams({
                        bt: checked.map((x) => +x as 0 | 1),
                    })
                }}
                listProps={{
                    className: "block! columns-4",
                }}
            />

            <div className="flex gap-8">
                <CheckboxGroup
                    header="Equip Tier"
                    options={EquipPageN.TIER_OPTIONS.map((label) => ({
                        label,
                    }))}
                    checked={EquipPageN.TIER_OPTIONS.map(
                        (label) =>
                            !!ctx.params.et.raw &&
                            ctx.params.et.v.some((x) => label === x),
                    )}
                    onCheckedChange={({ checked }) => {
                        ctx.setParams({
                            et: checked.map((x) => +x as 0 | 1),
                        })
                    }}
                    listProps={{
                        className: "block! columns-3",
                    }}
                />
                <CheckboxGroup
                    header="Clear Bonus?"
                    direction="v"
                    hideAll={true}
                    options={["Yes", "No"].map((label) => ({ label }))}
                    checked={[
                        ctx.params.bs.v === "yes" || ctx.params.bs.v === "both",
                        ctx.params.bs.v === "no" || ctx.params.bs.v === "both",
                    ]}
                    onCheckedChange={({ checked }) => {
                        ctx.setParams({
                            bs: checked.map((x) => +x as 0 | 1),
                        })
                    }}
                    className="max-w-[20em]"
                />
            </div>

            <div className="flex gap-4">
                <div>
                    <h2 className="pb-1">From</h2>
                    <Input
                        className="text-[length:inherit]! p-[0.5em] h-min"
                        type="date"
                        value={d0?.toISOString().split("T")[0] ?? ""}
                        onInput={(ev) => {
                            setD0(ev.target.valueAsDate)
                        }}
                    />
                </div>
                <div>
                    <h2 className="pb-1">To</h2>
                    <Input
                        className="text-[length:inherit]! p-[0.5em] h-min"
                        type="date"
                        value={d1?.toISOString().split("T")[0] ?? ""}
                        onInput={(ev) => {
                            setD1(ev.target.valueAsDate)
                        }}
                    />
                </div>
            </div>
        </form>
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
    useEffect(() => {
        let done = false
        async function poll() {
            const db = await new LogDb().connect()
            const dummy: any = {}

            let equips: EquipPageN.IdbStorage
            while (!done) {
                const equipTally = await db.get("kv", "equipTally")

                // not generated yet
                if (!equipTally || equipTally.equips.byteLength === 0) {
                    setIsLoading(true)
                    await sleep(5_000)
                    continue
                }

                const decompressed = await decompressZstd({
                    x: equipTally.equips,
                })
                const text = await new Blob([decompressed]).text()
                equips = JSON.parse(text)

                if (data.length === equips.id.length) {
                    if (equipTally.pending) {
                        if (data.length < 25) {
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
            }
        }

        poll()
        return () => {
            done = true
        }
    }, [])

    const filterSortIdxs = useMemo(() => {
        let idxs = range(data.length)
        if (params.et.v.length > 0) {
            idxs = idxs.filter((idx) =>
                params.et.v.some((tier) =>
                    data[idx].name.startsWith(tier + " "),
                ),
            )
        }
        if (params.bt.v.length > 0) {
            const bts = new Set(params.bt.v)
            idxs = idxs.filter((idx) => bts.has(data[idx].battleTypeId ?? ""))
        }
        if (params.d0.v) {
            const d0 = params.d0.v.toISOString()
            idxs = idxs.filter((idx) => data[idx].date >= d0)
        }
        if (params.d1.v) {
            const d1 = params.d1.v.toISOString()
            idxs = idxs.filter((idx) => data[idx].date <= d1)
        }
        if (params.bs.v === "yes" || params.bs.v === "no") {
            const bs = params.bs.v === "yes"
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

        return idxs
    }, [
        dataVersion,
        ...objectValues(mapEntries(params, (k, v) => ({ [k]: v.raw }))),
    ])

    const pageSize = params.n.v
    const pageCount = Math.ceil(filterSortIdxs.length / pageSize)
    const pageIndex = clamp(params.p.v, 1, pageCount)

    const st = (pageIndex - 1) * pageSize
    const page = filterSortIdxs.slice(st, st + pageSize).map((idx) => data[idx])

    const paginationParams = useMemo(
        () => new Set(["p", "n", "s", "d", "nm"]),
        [],
    )
    const hasFilters = useMemo(() => {
        for (const [k, p] of objectEntries(params)) {
            if (paginationParams.has(k)) {
                continue
            }

            if (!isEqual(p.v, p.init)) {
                return true
            }
        }
        return false
    }, [params])

    return {
        page,
        pageSize,
        pageIndex,
        pageCount,
        count: filterSortIdxs.length,
        params,
        setParams,
        sortCol: params.s,
        isLoading,
        hasFilters,
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

    export const TIER_OPTIONS = transposeForCss(EQUIP_TIERS.slice(1), 3)
    export const BTS = transposeForCss(LogListN.BATTLE_TYPES, 4)

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
                    title: d.toISOString(),
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
            init: () => 0,
        },
        n: {
            type: "number",
            init: () => 25,
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
                let battleTypes = xs.map((idx) => BTS[idx]).filter((x) => !!x)
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
            type: "bitmask",
            deser: (xs) => {
                const hasYes = xs.includes(0)
                const hasNo = xs.includes(1)
                if (hasYes && hasNo) {
                    return "both" as const
                } else if (!hasYes && !hasNo) {
                    return "neither" as const
                } else if (hasYes) {
                    return "yes" as const
                } else {
                    return "no" as const
                }
            },
        },
        et: {
            type: "bitmask",
            deser: (idxs) =>
                idxs.map((idx) => TIER_OPTIONS[idx]).filter((x) => !!x),
            init: () => ["Peerless", "Legendary"],
        },
    } as const satisfies UrlParamN.Schema
}
// #endregion

// #region css
const CSS = css`
    .equip-page {
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

        tr > :first-child {
            padding-left: 1em;
        }
        tr > :last-child {
            padding-right: 1em;
        }
        thead > tr > * {
            padding-top: 1em;
        }
        tbody > tr:last-child > * {
            /* padding-bottom: 1em; */
        }
        table {
            border-radius: 0.5em;
            overflow: hidden;
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

        .filter-container {
        }
    }
`
// #endregion
