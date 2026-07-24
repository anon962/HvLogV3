import { FIGHTING_STYLE_NAMES } from "@/lib/stats/combatStats"
import { CheckboxGroup } from "../../checkboxGroup"
import { ListTable } from "../../listTable"
import { LogListN } from "./logListN"

export function LogList() {
    return (
        <LogListN.ctx.Provider>
            <div className="flex flex-col items-center pt-4">
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

                <div></div>
            </div>
            <div className="border-r mx-4"></div>
            <div></div>
        </form>
    )
}
