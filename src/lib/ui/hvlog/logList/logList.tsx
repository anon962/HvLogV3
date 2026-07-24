import { range, sort } from "myutils"
import { useState } from "react"
import { CheckboxGroup } from "../../checkboxGroup"
import { ListTable } from "../../listTable"
import { LogListN } from "./logListN"

export function LogList() {
    return (
        <LogListN.ctx.Provider>
            <div className="flex flex-col items-center pt-4">
                {/* <Filter /> */}
                <Table />
            </div>
        </LogListN.ctx.Provider>
    )
}

export function Table() {
    // const [urlParams, setUrlParams] = useUrlParams({
    //     schema: {
    //         p: {
    //             type: "number",
    //             tfm: (x) => (x !== null && x >= 1 ? x - 1 : 0),
    //         },
    //         n: {
    //             type: "number",
    //         },
    //         s: {
    //             type: "string",
    //             tfm: (x) => (x && LogListN.SORT_IDS.has(x as any) ? x : null),
    //         },
    //         desc: {
    //             type: "boolean",
    //         },
    //         id_user: {
    //             type: "string",
    //         },
    //         key_user: {
    //             type: "string",
    //         },
    //     },
    // })
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
    const [lastActiveIdx, setLastActive] = useState<number | null>(null)

    return (
        <form className="rounded-md border flex p-4 text-sm">
            <div className="flex flex-col">
                <CheckboxGroup
                    options={LogListN.BATTLE_TYPES.map((label) => ({
                        label,
                    }))}
                    checked={LogListN.BATTLE_TYPES.map((label) =>
                        params.bt.has(label),
                    )}
                    onCheckedChange={(checked, hasShift, value, idx) => {
                        let overrides
                        if (idx !== null) {
                            overrides = new Set<number>([idx])
                            if (lastActiveIdx !== null && hasShift) {
                                const [mn, mx] = sort(
                                    [lastActiveIdx, idx],
                                    (x) => x,
                                )
                                overrides = new Set(range(mn, mx + 1))
                            }
                            setLastActive(idx)
                        } else {
                            overrides = new Set(
                                range(LogListN.BATTLE_TYPES.length),
                            )
                            setLastActive(null)
                        }

                        setParams({
                            bt: LogListN.BATTLE_TYPES.map(
                                (x2, idx2) =>
                                    +(overrides.has(idx2)
                                        ? value
                                        : params.bt.has(x2)) as 0 | 1,
                            ),
                        })
                    }}
                />
            </div>
            <div className="border mx-2"></div>
            <div></div>
            <div className="border mx-2"></div>
            <div></div>
        </form>
    )
}
