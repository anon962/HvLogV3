import { cn } from "myutils"
import * as React from "react"

type InputProps = Omit<
    React.ComponentProps<"input">,
    "onChange" | "onInput"
> & {
    onChange?: (event: Event & { target: HTMLInputElement }) => void
    onInput?: (event: InputEvent & { target: HTMLInputElement }) => void
}

function Input({ className, type, ...props }: InputProps) {
    const ref = React.useRef<HTMLInputElement>(null)

    React.useEffect(() => {
        if (!ref.current) {
            return
        }

        // @ts-ignore
        ref.current.onchange = props.onChange ?? (() => {})
        ref.current.oninput = props.onInput ?? (() => {})
    }, [ref.current, props.onChange, props.onInput])

    const actualProps = {
        ...props,
        onChange: undefined,
        onInput: undefined,
    }

    return (
        <input
            ref={ref}
            type={type}
            data-slot="input"
            className={cn(
                "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input flex h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
                "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
                "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
                className,
            )}
            {...actualProps}
            onChange={() => {}}
            onInput={() => {}}
        />
    )
}

export { Input }
