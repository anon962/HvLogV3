import { cn, mergeProps, range, sort } from "myutils"
import { useRef, useState } from "react"
import { CommonProps } from "../utils/miscUtils"
import { Checkbox } from "./shadcn/checkbox"

export function CheckboxGroup({
    header,
    checked,
    onCheckedChange,
    direction,
    hideAll,
    options,
    headerProps,
    listProps,
    containerProps,
    labelProps,
    inputProps,
    ...rootProps
}: {
    header?: string
    checked: boolean[]
    onCheckedChange: (ev: {
        checked: boolean[]
        hasShift: boolean
        triggerValue: boolean
        triggerIdx: number | null
        changeIdx: Set<number>
    }) => void
    direction?: "h" | "v"
    hideAll?: boolean
    options: Array<{
        label: string
        title?: string
        className?: string
    }>
    listProps?: CommonProps
    headerProps?: CommonProps
    containerProps?: CommonProps
    labelProps?: CommonProps
    inputProps?: CommonProps
} & CommonProps) {
    const allChecked = checked.every((x) => x)
    const [lastActiveIdx, setLastActiveIdx] = useState<number | null>(null)

    return (
        <div
            {...mergeProps(
                {
                    className: cn("checkbox-group-root"),
                },
                rootProps,
            )}
        >
            {header ? <h2 {...headerProps}>{header}</h2> : null}

            <div
                {...mergeProps(
                    {
                        className: cn(
                            "checkbox-group-list",
                            direction === "h" ? "h" : "v",
                        ),
                    },
                    listProps,
                )}
            >
                {!hideAll && (
                    <LabeledCheckbox
                        label=""
                        checked={allChecked}
                        onCheckedChange={(update) => {
                            onCheckedChange({
                                checked: checked.map(() => update),
                                hasShift: false,
                                triggerValue: update,
                                triggerIdx: null,
                                changeIdx: new Set(range(checked.length)),
                            })
                            setLastActiveIdx(null)
                        }}
                        labelProps={labelProps ?? {}}
                        inputProps={inputProps ?? {}}
                        {...mergeProps(
                            {
                                className: "all",
                            },
                            containerProps,
                        )}
                    />
                )}

                {...options.map((opt, idx) => (
                    <LabeledCheckbox
                        label={opt.label}
                        title={opt.title}
                        checked={checked[idx]}
                        onCheckedChange={(update, hasShift) => {
                            let changeIdx = new Set<number>([idx])
                            if (lastActiveIdx !== null && hasShift) {
                                const [mn, mx] = sort(
                                    [lastActiveIdx, idx],
                                    (x) => x,
                                )
                                changeIdx = new Set(range(mn, mx + 1))
                            }
                            onCheckedChange({
                                checked: checked.map((curr, idx2) =>
                                    changeIdx.has(idx2) ? update : curr,
                                ),
                                hasShift,
                                triggerValue: update,
                                triggerIdx: idx,
                                changeIdx,
                            })
                            setLastActiveIdx(idx)
                        }}
                        labelProps={mergeProps(labelProps ?? {}, {
                            className: opt?.className ?? "",
                        })}
                        inputProps={inputProps ?? {}}
                        {...containerProps}
                    />
                ))}
            </div>
        </div>
    )
}

export function LabeledCheckbox({
    label,
    checked,
    onCheckedChange,
    labelProps,
    inputProps,
    ...rootProps
}: {
    label: string
    onCheckedChange: (checked: boolean, hasShift: boolean) => void
    labelProps?: CommonProps
    inputProps?: CommonProps
} & Omit<React.ComponentProps<typeof Checkbox>, "onCheckedChange">) {
    const hasShift = useRef(false)

    return (
        <div
            {...mergeProps(
                {
                    className: "input-label-container",
                },
                rootProps,
            )}
            onClickCapture={(ev) => {
                hasShift.current = ev.shiftKey

                const targetTag = (ev.target as HTMLElement).tagName
                if (targetTag === "LABEL" || targetTag === "DIV") {
                    onCheckedChange?.(!checked, hasShift.current)
                }
            }}
        >
            <Checkbox
                checked={checked}
                onCheckedChange={(checked) =>
                    onCheckedChange?.(!!checked, hasShift.current)
                }
                {...inputProps}
            />
            <label {...labelProps}>{label}</label>
        </div>
    )
}
