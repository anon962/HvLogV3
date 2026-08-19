import { cn } from "myutils"
import * as React from "react"

type InputProps = Omit<
    React.ComponentProps<"input">,
    "onChange" | "onInput"
> & {
    onChange?: (event: Event & { target: HTMLInputElement }) => void
    onInput?: (event: InputEvent & { target: HTMLInputElement }) => void
}

function Input({ className, type, onChange, onInput, ...props }: InputProps) {
    const ref = React.useRef<HTMLInputElement>(null)

    React.useEffect(() => {
        if (!ref.current) {
            return
        }

        ref.current.onchange = (ev) => {
            onChange?.(ev as any)
        }
        ref.current.oninput = (ev) => {
            onInput?.(ev as any)
        }
    }, [onChange, onInput])

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
            {...props}
        />
    )
}

export { Input }
