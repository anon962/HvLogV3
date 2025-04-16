import { indexes } from "@/lib/utils/miscUtils"
import { ContextProviderProps } from "@/lib/utils/typeUtils"
import { readUrl } from "@/lib/utils/userscriptUtils"
import { mapEntries } from "radash"
import React, {
    createContext,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react"
import { useLocalJsonState } from "../hooks"
import { useLogContext } from "../logContext"
import { useStatsMaybe } from "../logStatsContext"
import { ARENA_ALIASES, S_COLS } from "./cols"
import { DEFAULT_SUMMARY_VIEWS } from "./views"

export const ctx = createContext<ReturnType<typeof initContext>>(
    null as any
)

export function useSummaryTableContext() {
    return useContext(ctx)
}

export const SummaryTableContextProvider = React.memo(
    ({ children }: ContextProviderProps & {}) => {
        const value = initContext()

        return <ctx.Provider value={value}>{children}</ctx.Provider>
    }
)

// @todo: better way of applying id override from url

function initContext() {
    const { params, isIsekai } = readUrl()
    const idOverride = params.get("id")

    const { logIds } = useLogContext()
    const ids = [...logIds.values()].map(({ id }) => id)

    // Filters
    const [activeViewId, setActiveViewId] = useLocalJsonState(
        DEFAULT_SUMMARY_VIEWS[0].id,
        "hvlog_summary_view",
        idOverride ? DEFAULT_SUMMARY_VIEWS[0].id : undefined
    )

    const { view, viewFilterMap, allViews } = useMemo(() => {
        let allViews = DEFAULT_SUMMARY_VIEWS
        if (!isIsekai) {
            allViews = allViews.filter((v) => v.id !== "tower")
        }

        const view =
            allViews.find((v) => v.id === activeViewId) ?? allViews[0]

        const viewFilterMap = new Map(
            view.filters.map((f) => [f.type, f])
        )

        return { view, viewFilterMap, allViews }
    }, [activeViewId])

    // Apply filters
    const { stats } = useStatsMaybe(ids, { summary: true })
    const idsFiltered = useMemo(() => {
        if (!view.filters.length) {
            return ids
        }

        return stats.flatMap((s) => {
            const { summary } = s ?? {}
            if (!summary) {
                return []
            }

            const id = summary.id

            let filter
            switch (summary.battleType?.name) {
                case "Arena":
                    const isRob =
                        !!ARENA_ALIASES[
                            summary.battleType.id
                        ]?.startsWith("RoB")
                    filter = viewFilterMap.get(
                        isRob ? "rob" : "arena"
                    )
                    return filter ? [id] : []
                case "Grindfest":
                    filter = viewFilterMap.get("gf")
                    return filter ? [id] : []
                case "Item World":
                    filter = viewFilterMap.get("iw")
                    return filter ? [id] : []
                case "Tower":
                    filter = viewFilterMap.get("tower")
                    return filter ? [id] : []
                case "random encounter":
                    filter = viewFilterMap.get("arena")
                    return filter ? [id] : []
            }

            return []
        })
    }, [stats, view, logIds])

    // Sort criteria
    const [sortCriteria, setSortCriteria] = useState({
        id: view.defaultSort.id,
        order: view.defaultSort.order as "asc" | "desc" | null,
    })

    // Logs mapped to sort data
    const colData = mapEntries(S_COLS, (cid, col) => {
        const isEnabled = !!view.colIds.find((id) => id === cid)
        const d = col.preprocess(isEnabled ? idsFiltered : [])
        return [cid, d]
    })

    // Apply sort criteria
    const { idsSorted, dataSorted } = useMemo(() => {
        let sortedIndexes = indexes(idsFiltered)

        // Defaults to date (or first column) if user deactivated all sorting
        const col = S_COLS[sortCriteria.id]
        const crit =
            sortCriteria.order !== null
                ? sortCriteria
                : view.defaultSort

        if (col?.sort) {
            const sortData = colData[crit.id]
            sortedIndexes = col?.sort(sortData)

            if (crit.order === "desc") {
                sortedIndexes.reverse()
            }
        }

        return {
            idsSorted: sortedIndexes.map((idx) => idsFiltered[idx]),
            dataSorted: sortedIndexes.map((idx) =>
                view.colIds.map((cid) => colData[cid][idx])
            ),
        }
    }, [sortCriteria, colData, idsFiltered, view])

    // Pagination
    const pageSize = 200
    const [pageIndex, setPageIndex] = useState(0)

    // Apply pagination
    const { idsPaginated, dataPaginated } = useMemo(() => {
        const start = pageIndex * pageSize
        const end = (pageIndex + 1) * pageSize

        return {
            idsPaginated: idsSorted.slice(start, end),
            dataPaginated: dataSorted.slice(start, end),
        }
    }, [idsSorted, pageIndex])

    // Selected row
    const [selectedLogId, setSelectedLogId] = useLocalJsonState(
        "",
        "hvlog_selected_log",
        idOverride ?? undefined
    )

    // Jump to url-provided id
    const didOverride = useRef(false)
    useEffect(() => {
        if (didOverride.current) {
            return
        }

        const idx = idsSorted.findIndex((id) => id === idOverride)
        if (idx > -1) {
            const pageIdx = Math.floor(idx / pageSize)
            setPageIndex(pageIdx)
            console.debug(
                `Jumping to ${idOverride} on page ${pageIdx + 1}`
            )
            didOverride.current = true
        }
    }, [idsSorted])

    return {
        ids,
        idsFiltered,
        idsPaginated,
        dataPaginated,

        pageSize,
        allViews,
        activeView: view,

        pageIndex,
        setPageIndex,
        activeViewId,
        setActiveViewId,
        sortCriteria,
        setSortCriteria,
        selectedLogId,
        setSelectedLogId,
    }
}
