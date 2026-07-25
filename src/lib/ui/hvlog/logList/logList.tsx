import { FIGHTING_STYLE_NAMES } from "@/lib/stats/combatStats"
import { CheckboxGroup } from "../../checkboxGroup"
import { ListTable } from "../../listTable"
import { LogListN } from "./logListN"
import { useCallback, useMemo, useState } from "react"
import * as Select from "../../shadcn/select"
import { cn, range } from "myutils"
import { CommonProps, mergeProps } from "@/lib/utils/miscUtils"

export function LogList() {
    return (
        <LogListN.ctx.Provider>
            <div className="log-list flex flex-col items-center pt-4">
                <Filter />
                <Table />
            </div>
        </LogListN.ctx.Provider>
    )
}

export function Table() {
    const {
        params,
        setParams,
        pageSizeStorage,
        setPageSizeStorage,
        fetcher: { request, data, isPending },
    } = LogListN.ctx.useContext()

    return (
        <ListTable
            data={data?.results ?? []}
            cols={[
                LogListN.COLS.battleType,
                LogListN.COLS.turns,
                LogListN.COLS.style,
                LogListN.COLS.user,
                LogListN.COLS.date,
                LogListN.COLS.status,
            ]}
            count={data?.resultCount ?? 1}
            getId={(d) => d.id}
            sortCols={new Set(LogListN.SORT_IDS)}
            pageIndex={request.pageIdx}
            setPageIndex={(idx) => {}}
            setPageSize={{
                options: [15, 50, 100, 1000],
                handler: (pageSize: number) => {
                    setPageSizeStorage(pageSize)
                    setParams({
                        p: 1,
                        n: pageSize,
                    })
                },
            }}
            pageSize={data?.pageSize ?? 1}
            selectedId=""
            setSelectedId={() => {}}
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
            isLoading={isPending}
            className={{ root: "text-sm" }}
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
        />
    )
}

function Filter() {
    const { params, setParams } = LogListN.ctx.useContext()

    return (
        <form className="rounded-md border flex p-4 text-xs">
            <div className="flex flex-col">
                <CheckboxGroup
                    header="Battle Type"
                    options={LogListN.BATTLE_TYPES.map(({ label }) => ({
                        label,
                    }))}
                    checked={LogListN.BATTLE_TYPES.map(({ label }) =>
                        params.bt.has(label),
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
            </div>
            <div className="border-r mx-4"></div>
            <div className="flex flex-col gap-4">
                <CheckboxGroup
                    header="Imperil?"
                    direction="h"
                    hideAll={true}
                    options={["Yes", "No"].map((label) => ({ label }))}
                    checked={[
                        params["i"] === "yes" || params["i"] === "both",
                        params["i"] === "no" || params["i"] === "both",
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
                    checked={LogListN.STYLES.map(({ id }) => params.sp.has(id))}
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
                    checked={LogListN.STYLES.map(({ id }) => params.ss.has(id))}
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
                    <MonthYearPicker
                        label="From"
                        value={params.ds}
                        onPick={(date) => {
                            setParams({ ds: date })
                        }}
                        defaultMonth="first"
                    />
                    <MonthYearPicker
                        label="To"
                        value={params.de}
                        onPick={(date) => {
                            setParams({ de: date })
                        }}
                        defaultMonth="last"
                    />
                </div>
            </div>
            <div className="border-r mx-4"></div>
            <div></div>
        </form>
    )
}

function MonthYearPicker(props: {
    label: string
    value: Date | null
    onPick: (date: Date | null) => void
    defaultMonth: "first" | "last"
}) {
    const [tempMonth, setTempMonth] = useState(null as number | null)

    const year = props.value?.getUTCFullYear() ?? null
    const month = props.value?.getUTCMonth() ?? tempMonth

    const monthOptions = useMemo(
        () =>
            range(12).map((idx) => ({
                value: idx,
                label: String(idx + 1).padStart(2, "0"),
            })),
        [],
    )

    const set = useCallback(
        (mm: number | null, yyyy: number | null, changeType: "mm" | "yyyy") => {
            if (yyyy !== null && mm === null) {
                if (changeType === "yyyy") {
                    mm = props.defaultMonth === "first" ? 0 : 11
                    props.onPick(new Date(Date.UTC(yyyy, mm, 1)))
                    setTempMonth(null)
                } else {
                    props.onPick(null)
                    setTempMonth(null)
                }
            } else if (yyyy === null && mm !== null) {
                if (changeType === "yyyy") {
                    props.onPick(null)
                    setTempMonth(null)
                } else {
                    props.onPick(null)
                    setTempMonth(mm)
                }
            } else if (yyyy === null && mm === null) {
                props.onPick(null)
                setTempMonth(null)
            } else {
                props.onPick(new Date(Date.UTC(yyyy!, mm!, 1)))
                setTempMonth(null)
            }
        },
        [props.onPick],
    )

    return (
        <div>
            <h2 className="text-[1.1em] font-medium pb-[0.25em]">
                {props.label}
            </h2>
            <div className="flex gap-1">
                <MySelect
                    label={monthOptions[month!]?.label ?? null}
                    onValueChange={(mm) => {
                        set(mm, year, "mm")
                    }}
                    nullLabel="MM"
                    items={monthOptions}
                    triggerProps={{
                        className: "w-[10ch]",
                    }}
                />
                <MySelect
                    label={year !== null ? String(year) : null}
                    onValueChange={(yyyy) => {
                        set(month, yyyy, "yyyy")
                    }}
                    nullLabel="YYYY"
                    items={range(2025, new Date().getFullYear() + 2).map(
                        (idx) => ({
                            value: idx,
                            label: String(idx),
                        }),
                    )}
                    triggerProps={{
                        className: "w-[12ch]",
                    }}
                />
            </div>
        </div>
    )
}

function MySelect<T>(props: {
    label: string | null
    onValueChange: (value: T | null) => void
    nullLabel: string
    items: Array<{
        value: T
        label: string
    }>
    triggerProps: CommonProps
}) {
    return (
        <Select.Select
            value={props.label === null ? "null" : String(props.label)}
            onValueChange={(label) => {
                const item = props.items.find((x) => x.label === label)
                if (item) {
                    props.onValueChange(item.value)
                } else {
                    props.onValueChange(null)
                }
            }}
            {...mergeProps({}, props.triggerProps)}
        >
            <Select.SelectTrigger
                className={cn(
                    "text-xs cursor-pointer p-[0.5em] h-[2.5em]! [&_svg]:size-3 gap-1",
                    props.label === null ? "text-gray-500" : "",
                )}
            >
                <Select.SelectValue />
            </Select.SelectTrigger>

            <Select.SelectContent>
                <Select.SelectItem
                    key="null"
                    value="null"
                    className="cursor-pointer text-xs text-gray-500"
                >
                    {props.nullLabel}
                </Select.SelectItem>
                {props.items.map((x) => (
                    <Select.SelectItem
                        key={x.label}
                        value={x.label}
                        className="cursor-pointer text-xs"
                    >
                        {x.label}
                    </Select.SelectItem>
                ))}
            </Select.SelectContent>
        </Select.Select>
    )
}
