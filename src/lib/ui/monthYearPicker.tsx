import { CommonProps } from "@/lib/utils/miscUtils"
import { cn, mergeProps, range } from "myutils"
import { useCallback, useMemo, useState } from "react"
import * as Select from "./shadcn/select"

export function MonthYearPicker(props: {
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
            <h2 className="pb-1">{props.label}</h2>
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
