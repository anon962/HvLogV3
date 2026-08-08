import {
    Autocomplete,
    AutocompleteContent,
    AutocompleteInput,
    AutocompleteItem,
    AutocompleteList,
} from "@/components/reui/autocomplete"
import { lucide } from "@/lib/ui/constants"
import { CommonProps } from "@/lib/utils/miscUtils"
import { useMemo } from "react"
import { ListTable } from "../listTable"
import { Input } from "../shadcn/input"
import { MonsterPageN } from "./monsterPageN"
import { cn, mapEntries, NgramSearch } from "myutils"
import * as Tabs from "../shadcn/tabs"

export function MonsterPage(props: {}) {
    return (
        <MonsterPageN.ctx.Provider>
            <Inner />
        </MonsterPageN.ctx.Provider>
    )
}

function Inner() {
    const { mode, setMode, params, setParams } = MonsterPageN.ctx.useContext()
    return (
        <Tabs.Tabs
            className="px-16 py-8 gap-0"
            defaultValue={mode}
            onValueChange={(x) => {
                setMode(x)
                setParams({
                    ...mapEntries(params, (k) => ({ [k]: null })),
                    m: x[0],
                })
            }}
        >
            <Tabs.TabsList className="grid grid-cols-2 w-full max-w-[50em] mx-auto">
                <Tabs.TabsTrigger value="monsters" className="font-bold py-1">
                    Monsters
                </Tabs.TabsTrigger>

                <Tabs.TabsTrigger value="trainers" className="font-bold py-1">
                    Trainers
                </Tabs.TabsTrigger>
            </Tabs.TabsList>

            <Tabs.TabsContent value="monsters" className="h-full min-h-0">
                <Table />
            </Tabs.TabsContent>

            <Tabs.TabsContent value="trainers" className="h-full min-h-0">
                <Table />
            </Tabs.TabsContent>
        </Tabs.Tabs>
    )
}

// region: table
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
        mode,
    } = MonsterPageN.ctx.useContext()

    const cols = [
        mode === "monsters" && MonsterPageN.COLS.name,
        MonsterPageN.COLS.trainer,
        mode === "trainers" && MonsterPageN.COLS.mobcount,
        MonsterPageN.COLS.pl,
        mode === "monsters" && MonsterPageN.COLS.race,
        MonsterPageN.COLS.frequency,
        MonsterPageN.COLS.dgiven,
        MonsterPageN.COLS.dtaken,
        // MonsterPageN.COLS.mid,
    ].flatMap((x) => (!!x ? [x] : []))

    return (
        <div className="flex flex-col justify-center">
            <ListTable
                data={data}
                cols={cols}
                count={pageCount * pageSize}
                getId={(d) => d.id}
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
                sortCols={new Set(cols.map((c) => c.id))}
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
                    active: Object.entries(params).some(
                        ([k, v]) =>
                            !"pnsdm".includes(k) &&
                            (Array.isArray(v) ? v.length > 0 : v !== null),
                    ),
                }}
            />
        </div>
    )
}

// region: filter
function Filter() {
    const { options, mode } = MonsterPageN.ctx.useContext()

    return (
        <form className="rounded-md border p-4 text-xs flex flex-col gap-2">
            {mode === "monsters" && (
                <div className="input-container">
                    <label>Name</label>
                    <MultiSelect
                        param="nm"
                        options={options.namePool}
                        ngramSearch={options.nameGrams}
                        placeholder="konata, yggdrasil"
                    />
                </div>
            )}

            <div className="input-container">
                <label>Trainer</label>
                <MultiSelect
                    param="tr"
                    options={options.trainerPool}
                    ngramSearch={options.trainerGrams}
                    placeholder="tenboro, snowflake"
                />
            </div>

            <div className="input-container">
                <label>Race</label>
                <MultiSelect
                    param="rc"
                    options={options.race}
                    placeholder="giant, undead"
                />
            </div>

            <div
                className={cn(
                    "grid gap-4",
                    mode === "monsters" ? "grid-cols-5" : "grid-cols-4",
                )}
            >
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

                {mode === "trainers" && (
                    <NumberInput param="c0" label="Monsters" max={200} />
                )}

                {mode === "monsters" && (
                    <NumberInput param="l0" label="Level Min" max={2250} />
                )}
                {mode === "monsters" && (
                    <NumberInput
                        param="l1"
                        label="Level Max"
                        max={2250}
                        placeholder="2250"
                    />
                )}
            </div>
        </form>
    )
}

// region: utils
function MultiSelect(
    props: {
        param: "nm" | "tr" | "rc"
        options: string[]
        placeholder?: string
        ngramSearch?: NgramSearch<unknown>
    } & CommonProps,
) {
    const { params, setParams } = MonsterPageN.ctx.useContext()
    const patts = params[props.param] ?? ""
    const sources = patts.map((p) => p ?? "")
    const currValue =
        sources.length > 0 ? sources[sources.length - 1].toLowerCase() : ""

    const filtered = useMemo(() => {
        if (!props.ngramSearch) {
            return props.options.filter((x) =>
                x.toLowerCase().includes(currValue),
            )
        } else {
            return props.ngramSearch.find(currValue).map((x) => x.text)
        }
    }, [props.options, props.ngramSearch, currValue])

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
    param: "l0" | "l1" | "v0" | "a0" | "d0" | "c0"
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
