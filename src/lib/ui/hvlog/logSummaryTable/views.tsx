import { S_COLS } from "./cols"

export interface SummaryView {
    id: string
    label: string
    colIds: string[]
    defaultSort: {
        id: keyof typeof S_COLS
        order: "asc" | "desc"
    }
    filters: Array<{
        type: "re" | "arena" | "rob" | "iw" | "tower" | "gf"
    }>
}

export const DEFAULT_SUMMARY_VIEWS: SummaryView[] = [
    {
        id: "default",
        label: "Default",
        colIds: [
            "type",
            "turns",
            "duration",
            "profit",
            "date",
            "status",
        ],
        defaultSort: {
            id: "date",
            order: "desc",
        },
        filters: [],
    },
    {
        id: "arena_rob",
        label: "Arena + RoB",
        colIds: [
            "type",
            "turns",
            "duration",
            "profit",
            "date",
            "status",
        ],
        defaultSort: {
            id: "date",
            order: "desc",
        },
        filters: [{ type: "arena" }, { type: "rob" }],
    },
    {
        id: "arena",
        label: "Arena",
        colIds: [
            "type",
            "turns",
            "duration",
            "profit",
            "date",
            "status",
        ],
        defaultSort: {
            id: "date",
            order: "desc",
        },
        filters: [{ type: "arena" }],
    },
    {
        id: "rob",
        label: "RoB",
        colIds: [
            "type",
            "turns",
            "duration",
            "profit",
            "date",
            "status",
        ],
        defaultSort: {
            id: "date",
            order: "desc",
        },
        filters: [{ type: "rob" }],
    },
    {
        id: "iw",
        label: "Item World",
        colIds: [
            "type",
            "turns",
            "duration",
            "profit",
            "enchants",
            "date",
            "status",
        ],
        defaultSort: {
            id: "date",
            order: "desc",
        },
        filters: [{ type: "iw" }],
    },
    {
        id: "tower",
        label: "Tower",
        colIds: [
            "type",
            "turns",
            "duration",
            "profit",
            "date",
            "status",
        ],
        defaultSort: {
            id: "date",
            order: "desc",
        },
        filters: [{ type: "tower" }],
    },
    {
        id: "re",
        label: "Random Encounter",
        colIds: [
            "type",
            "turns",
            "duration",
            "profit",
            "date",
            "status",
        ],
        defaultSort: {
            id: "date",
            order: "desc",
        },
        filters: [{ type: "re" }],
    },
    {
        id: "gf",
        label: "Grindfest",
        colIds: [
            "type",
            "turns",
            "duration",
            "profit",
            "date",
            "status",
        ],
        defaultSort: {
            id: "date",
            order: "desc",
        },
        filters: [{ type: "gf" }],
    },
]
