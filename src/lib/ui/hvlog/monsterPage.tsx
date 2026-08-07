import { ListTable } from "../listTable"
import { MonsterPageN } from "./monsterPageN"

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
            />
        </div>
    )
}
