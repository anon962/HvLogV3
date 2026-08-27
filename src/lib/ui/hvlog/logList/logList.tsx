import { FIGHTING_STYLE_NAMES } from "@/lib/stats/combatStats"
import { SlidersHorizontal } from "lucide-react"
import { DEFAULT_PREFETCH_DELAY, IS_REMOTE } from "../../../constants"
import { CheckboxGroup } from "../../checkboxGroup"
import { ListTable } from "../../listTable"
import { Input } from "../../shadcn/input"
import { LogListN } from "./logListN"
import { MonthYearPicker } from "../../monthYearPicker"
import { USERSCRIPT_CONFIG } from "@/lib/db/userscriptConfig"
import { useMemo } from "react"
import { LogSourceN } from "@/lib/db/logSourceN"
import { Css, css } from "myutils"

export function LogList() {
    return (
        <LogListN.ctx.Provider arg={null}>
            <Css css={CSS} />
            <div className="log-list w-full flex flex-col items-center pt-4">
                <Table />
            </div>
        </LogListN.ctx.Provider>
    )
}

export function Table() {
    const {
        params,
        setParams,
        fetcher: { request, data, isPending },
        logSource,
    } = LogListN.ctx.useContext()

    const { config } = USERSCRIPT_CONFIG.useContext()

    const cols = useMemo(
        () =>
            IS_REMOTE
                ? [
                      LogListN.COLS.battleType,
                      LogListN.COLS.turns,
                      LogListN.COLS.style,
                      LogListN.COLS.user,
                      LogListN.COLS.date,
                      LogListN.COLS.status,
                  ]
                : [
                      LogListN.COLS.battleType,
                      LogListN.COLS.style,
                      LogListN.COLS.turns,
                      LogListN.COLS.profit,
                      LogListN.COLS.date,
                      LogListN.COLS.duration,
                      LogListN.COLS.status,
                      LogListN.COLS.actions,
                  ],
        [],
    )

    const sortCols = useMemo(() => new Set(LogListN.SORT_IDS), [])

    return (
        <ListTable
            data={data?.results ?? []}
            cols={cols}
            count={data?.resultCount ?? 1}
            getId={(d) => d.id}
            sortCols={sortCols}
            pageIndex={request.pageIdx}
            setPageSize={{
                options: [15, 50, 100, 1000],
                handler: (pageSize: number) => {
                    setParams({
                        p: 1,
                        n: pageSize,
                    })
                },
            }}
            pageSize={data?.pageSize ?? 1}
            sortCriteria={request.sortCriteria}
            setSortCriteria={(crit) => {
                setParams(
                    crit === null
                        ? {
                              s: null,
                              desc: null,
                          }
                        : {
                              s: crit.cid,
                              desc: crit.order === "desc",
                          },
                )
            }}
            rowUrl={(d) => `/logs/${d.id}`}
            isLoading={isPending || data?.stale}
            className="text-[0.85em]"
            pageUrl={(pageIdx) => ({
                p: String(pageIdx + 1),
                n: String(request.pageSize),
                ...(request.sortCriteria
                    ? {
                          s: String(request.sortCriteria.cid),
                          desc:
                              request.sortCriteria.order === "desc" ? "1" : "0",
                      }
                    : {}),
            })}
            onHover={useMemo(
                () => ({
                    delay: config.prefetchDelay || DEFAULT_PREFETCH_DELAY,
                    fn: (r: LogSourceN.SearchResult) => {
                        if (config.prefetchDelay < 0) {
                            return
                        }

                        if (IS_REMOTE) {
                            logSource.fetchPrices("persistent")
                        }
                        logSource.prefetchDetails(r.id)
                    },
                }),
                [config],
            )}
            filter={{
                trigger: <SlidersHorizontal className="size-full" />,
                content: <Filter />,
                active:
                    params.bt.v.length > 0 ||
                    params.ct.v.length > 0 ||
                    params.sp.v.length > 0 ||
                    params.ss.v.length > 0 ||
                    params.e.v.length > 0 ||
                    params.i.v === "yes" ||
                    params.i.v === "no" ||
                    !!params.ds.v ||
                    !!params.de.v ||
                    !!params.rmn.v ||
                    !!params.rmx.v ||
                    false,
            }}
        />
    )
}

function Filter() {
    const { params, setParams } = LogListN.ctx.useContext()

    const bt = new Set(params.bt.v)
    const ct = new Set(params.ct.v)

    return (
        <form className="rounded-md border flex p-4 text-xs">
            <div className="flex flex-col gap-4">
                <CheckboxGroup
                    header="Battle Type"
                    options={LogListN.BATTLE_TYPES.map(({ label }) => ({
                        label,
                    }))}
                    checked={LogListN.BATTLE_TYPES.map(
                        ({ ids }) => ids.intersection(bt).size > 0,
                    )}
                    onCheckedChange={({ checked }) => {
                        setParams({
                            bt: checked.map((x) => +x as 0 | 1),
                        })
                    }}
                    listProps={{
                        className: "block! columns-2",
                    }}
                />

                <CheckboxGroup
                    header="Completion Type"
                    direction="h"
                    options={LogListN.COMPLETION_TYPES.map(({ label }) => ({
                        label,
                    }))}
                    checked={LogListN.COMPLETION_TYPES.map(({ id }) =>
                        ct.has(id),
                    )}
                    onCheckedChange={({ checked }) => {
                        setParams({
                            ct: checked.map((x) => +x as 0 | 1),
                        })
                    }}
                    hideAll={true}
                />

                <CheckboxGroup
                    header="Errors"
                    options={LogListN.ERRORS.map(({ label }) => ({
                        label,
                    }))}
                    checked={LogListN.ERRORS.map(({ label }) =>
                        params.e.v.some((x) => x.label === label),
                    )}
                    onCheckedChange={({ checked }) => {
                        setParams({
                            e: checked.map((x) => +x as 0 | 1),
                        })
                    }}
                    hideAll={true}
                    listProps={{
                        className: "block! columns-2",
                    }}
                />
            </div>
            <div className="border-r mx-4"></div>
            <div className="flex flex-col gap-4">
                <CheckboxGroup
                    header="Imperil?"
                    direction="h"
                    hideAll={true}
                    options={["Yes", "No"].map((label) => ({ label }))}
                    checked={[
                        params["i"].v === "yes" || params["i"].v === "both",
                        params["i"].v === "no" || params["i"].v === "both",
                    ]}
                    onCheckedChange={({ checked }) => {
                        setParams({
                            i: checked.map((x) => +x as 0 | 1),
                        })
                    }}
                    className="max-w-[20em]"
                />

                <CheckboxGroup
                    header="Primary Style"
                    direction="h"
                    options={LogListN.STYLES.map(({ id }) => ({
                        label: FIGHTING_STYLE_NAMES[id].short,
                    }))}
                    checked={LogListN.STYLES.map(({ id }) =>
                        params.sp.v.includes(id),
                    )}
                    onCheckedChange={({ checked }) => {
                        setParams({
                            sp: checked.map((x) => +x as 0 | 1),
                        })
                    }}
                    className="max-w-[20em]"
                    listProps={{
                        className: "grid! grid-cols-4",
                    }}
                    containerProps={{
                        className: "[&:nth-child(4n)]:pr-0!",
                    }}
                />

                <CheckboxGroup
                    header="Secondary Style"
                    direction="h"
                    options={LogListN.STYLES.map(({ id }) => ({
                        label: FIGHTING_STYLE_NAMES[id].short,
                    }))}
                    checked={LogListN.STYLES.map(({ id }) =>
                        params.ss.v.includes(id),
                    )}
                    onCheckedChange={({ checked }) => {
                        setParams({
                            ss: checked.map((x) => +x as 0 | 1),
                        })
                    }}
                    className="max-w-[20em]"
                    listProps={{
                        className: "grid! grid-cols-4",
                    }}
                    containerProps={{
                        className: "[&:nth-child(4n)]:pr-0!",
                    }}
                />

                <div className="flex gap-4">
                    <div>
                        <h2>Min Rounds</h2>
                        <Input
                            type="number"
                            className="h-[2em] w-[10ch] p-2 text-[length:inherit]"
                            min="0"
                            defaultValue={params.rmn.v || ""}
                            onChange={(ev) => {
                                const value = parseInt(ev.target.value)
                                setParams({
                                    rmn:
                                        isNaN(value) || value <= 0
                                            ? null
                                            : value,
                                })
                            }}
                        />
                    </div>
                    <div>
                        <h2>Max Rounds</h2>
                        <Input
                            type="number"
                            className="h-[2em] w-[10ch] py-0 text-inherit"
                            min="0"
                            defaultValue={params.rmx.v || ""}
                            onChange={(ev) => {
                                const value = parseInt(ev.target.value)
                                setParams({
                                    rmx:
                                        isNaN(value) || value <= 0
                                            ? null
                                            : value,
                                })
                            }}
                        />
                    </div>
                </div>

                <div className="flex gap-4">
                    <MonthYearPicker
                        label="From"
                        value={params.ds.v}
                        onPick={(date) => {
                            setParams({ ds: date })
                        }}
                        defaultMonth="first"
                    />
                    <MonthYearPicker
                        label="To"
                        value={params.de.v}
                        onPick={(date) => {
                            setParams({ de: date })
                        }}
                        defaultMonth="last"
                    />
                </div>
            </div>
        </form>
    )
}

const CSS = css`
    .log-list {
        h2 {
            font-size: 1.1em;
            font-weight: 500;
            padding-bottom: 0.25em;
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
                var(--color-muted) 35%,
                transparent
            ) !important;
        }
        tr:nth-child(2n + 2) {
            background-color: color-mix(
                in oklab,
                var(--color-muted) 65%,
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

        .col-actions {
            height: 1px;

            button {
                width: 2.125em;
                height: 100%;
                border-radius: 2em;

                &:hover {
                    background-color: color-mix(
                        in oklab,
                        var(--foreground),
                        transparent 90%
                    );
                }
            }

            & > * {
                height: 100%;
                padding: 0.25em !important;
            }
        }
    }
`
