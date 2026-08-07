import { useMemo, useState } from "react"
import { ListTable } from "../listTable"
import { MonsterPageN } from "./monsterPageN"
import {
    Autocomplete,
    AutocompleteContent,
    AutocompleteEmpty,
    AutocompleteInput,
    AutocompleteItem,
    AutocompleteList,
} from "@/components/reui/autocomplete"
import { lucide } from "@/lib/ui/constants"
import { LabeledCheckbox } from "../checkboxGroup"
import { CommonProps } from "@/lib/utils/miscUtils"
import { Input } from "../shadcn/input"
import { X } from "lucide-react"

export function MonsterPage(props: {}) {
    return (
        <MonsterPageN.ctx.Provider>
            <Table />
        </MonsterPageN.ctx.Provider>
    )
}

function Table() {
    const {
        data,
        pageIndex,
        pageSize,
        pageCount,
        params,
        setParams,
        rawParams,
        sortCol,
    } = MonsterPageN.ctx.useContext()

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
                    MonsterPageN.COLS.dgiven,
                    MonsterPageN.COLS.dtaken,
                    // MonsterPageN.COLS.mid,
                ]}
                count={pageCount * pageSize}
                getId={(d) => String(d.mid)}
                pageIndex={pageIndex}
                pageUrl={(pageIdx) => ({
                    ...rawParams,
                    p: String(pageIdx + 1),
                })}
                setPageSize={{
                    options: [25, 100, 1000, 99999],
                    handler: (size: number) => {
                        setParams({ n: size })
                    },
                }}
                pageSize={pageSize}
                sortCols={
                    new Set([
                        MonsterPageN.COLS.name.id,
                        MonsterPageN.COLS.trainer.id,
                        MonsterPageN.COLS.pl.id,
                        MonsterPageN.COLS.race.id,
                        MonsterPageN.COLS.frequency.id,
                        MonsterPageN.COLS.dgiven.id,
                        MonsterPageN.COLS.dtaken.id,
                        // MonsterPageN.COLS.mid.id,
                    ])
                }
                sortCriteria={
                    sortCol
                        ? {
                              cid: sortCol.id,
                              order: params.d ? "desc" : "asc",
                          }
                        : null
                }
                setSortCriteria={(sort) => {
                    setParams(
                        sort
                            ? { s: sort.cid, d: sort.order === "desc" }
                            : { s: null, d: null },
                    )
                }}
                className="monster-list"
                tableProps={{ className: "overflow-hidden" }}
                filter={{
                    trigger: <lucide.SlidersHorizontal className="size-full" />,
                    content: <Filter />,
                    active:
                        // params.bt.size > 0 ||
                        // params.ct.size > 0 ||
                        // params.sp.size > 0 ||
                        // params.ss.size > 0 ||
                        // params.e.size > 0 ||
                        // params.i === "yes" ||
                        // params.i === "no" ||
                        // !!params.ds ||
                        // !!params.de ||
                        // !!params.rmn ||
                        // !!params.rmx ||
                        false,
                }}
            />
        </div>
    )
}

function Filter() {
    const { params, setParams, options } = MonsterPageN.ctx.useContext()

    return (
        <form className="rounded-md border p-4 text-xs flex flex-col gap-2">
            <div className="input-container">
                <label>Name</label>
                <MultiSelect
                    param="nm"
                    options={Array.from(options.name)}
                    placeholder="konata, yggdrasil"
                />
            </div>

            <div className="input-container">
                <label>Trainer</label>
                <MultiSelect
                    param="tr"
                    options={Array.from(options.trainer)}
                    placeholder="tenboro, snowflake"
                />
            </div>

            <div className="input-container">
                <label>Race</label>
                <MultiSelect
                    param="rc"
                    options={Array.from(options.race)}
                    placeholder="giant, undead"
                />
            </div>

            <div className="grid grid-cols-5 gap-4">
                <NumberInput
                    param="v0"
                    label="Appearances"
                    max={Math.ceil(options.maxAppearances / 100) * 100}
                />
                <NumberInput
                    param="a0"
                    label="Damage Given"
                    max={Math.ceil(options.maxAttack / 10) * 10}
                />
                <NumberInput
                    param="d0"
                    label="Damage Taken"
                    max={Math.ceil(options.maxDefense / 10) * 10}
                />
                <NumberInput param="l0" label="Level Min" max={2250} />
                <NumberInput
                    param="l1"
                    label="Level Max"
                    max={2250}
                    placeholder="2250"
                />
            </div>
        </form>
    )
}

function MultiSelect(
    props: {
        param: "nm" | "tr" | "rc"
        options: string[]
        placeholder?: string
    } & CommonProps,
) {
    const { params, setParams } = MonsterPageN.ctx.useContext()
    const patts = params[props.param] ?? ""
    const sources = patts.map((p) => p ?? "")
    const currValue =
        sources.length > 0 ? sources[sources.length - 1].toLowerCase() : ""

    const filtered = useMemo(
        () => props.options.filter((x) => x.toLowerCase().includes(currValue)),
        [props.options, currValue],
    )

    return (
        <Autocomplete
            items={filtered.slice(0, 30)}
            value={sources.join(",")}
            onValueChange={(value, eventDetails) => {
                let parts
                if (eventDetails.reason === "item-press") {
                    parts = [...sources.slice(0, sources.length - 1), value, ""]
                } else {
                    parts = value.split(",")
                }
                setParams({
                    [props.param]:
                        parts.length > 0 && parts.some((x) => x.length > 0)
                            ? parts
                            : null,
                })
            }}
            filter={null}
        >
            <AutocompleteInput
                placeholder={props.placeholder}
                containerProps={{
                    className: props.className,
                }}
            />
            <AutocompleteContent>
                <AutocompleteList>
                    {(item: string) => (
                        <AutocompleteItem key={item} value={item}>
                            {item}
                        </AutocompleteItem>
                    )}
                </AutocompleteList>
            </AutocompleteContent>
        </Autocomplete>
    )
}

function NumberInput(props: {
    param: "l0" | "l1" | "v0" | "a0" | "d0"
    label: string
    min?: number
    max?: number
    placeholder?: string
}) {
    const { params, setParams } = MonsterPageN.ctx.useContext()

    return (
        <div className="input-container">
            <label>{props.label}</label>
            <Input
                type="number"
                min={props.min ?? 0}
                max={props.max}
                value={params[props.param] ?? ""}
                placeholder={props.placeholder ?? "0"}
                onInput={(ev) => {
                    const x = parseInt(ev.target.value)
                    setParams(
                        {
                            [props.param]: isNaN(x) ? null : x,
                        },
                        {
                            history: "replace",
                        },
                    )
                }}
            />
        </div>
    )
}
