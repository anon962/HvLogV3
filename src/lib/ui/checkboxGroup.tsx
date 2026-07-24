import { CommonProps, mergeProps } from "../utils/miscUtils"
import { Checkbox } from "./shadcn/checkbox"
import { useRef } from "react"

export function CheckboxGroup({
    checked,
    onCheckedChange,
    options,
    containerProps,
    labelProps,
    inputProps,
    ...rootProps
}: {
    checked: boolean[]
    onCheckedChange: (
        checked: boolean[],
        hasShift: boolean,
        changeValue: boolean,
        changeIdx: number | null,
    ) => void
    options: Array<{
        label: string
    }>
    containerProps?: CommonProps
    labelProps?: CommonProps
    inputProps?: CommonProps
} & CommonProps) {
    const allChecked = checked.every((x) => x)

    return (
        <div {...mergeProps({ className: "checkbox-group" }, rootProps)}>
            <LabeledCheckbox
                label=""
                checked={allChecked}
                onCheckedChange={(value) => {
                    onCheckedChange(
                        checked.map(() => value),
                        false,
                        value,
                        null,
                    )
                }}
                labelProps={labelProps ?? {}}
                inputProps={inputProps ?? {}}
                {...containerProps}
            />

            {...options.map((opt, idx) => (
                <LabeledCheckbox
                    label={opt.label}
                    checked={checked[idx]}
                    onCheckedChange={(value, hasShift) =>
                        onCheckedChange(
                            checked.map((c, idx2) =>
                                idx2 === idx ? value : c,
                            ),
                            hasShift,
                            value,
                            idx,
                        )
                    }
                    labelProps={labelProps ?? {}}
                    inputProps={inputProps ?? {}}
                    {...containerProps}
                />
            ))}
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
            <label {...mergeProps({ className: "select-none" }, labelProps)}>
                {label}
            </label>
        </div>
    )
}
