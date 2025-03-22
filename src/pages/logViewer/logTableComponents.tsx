import { CompleteLog } from "@/lib/logDb"
import { ColumnDef } from "@tanstack/react-table"

export const LogTableColumns: Array<ColumnDef<CompleteLog>> = [
    {
        accessorFn: (log) => log.meta.start,
        header: "Date",
    },
]
