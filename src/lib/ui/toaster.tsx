import { cn, Css, css, IdPool, newContext } from "myutils"
import { ReactNode, useMemo, useState } from "react"

export function Toaster(props: { children: ReactNode }) {
    return (
        <TOASTER.Provider arg={null}>
            <Css css={CSS} />
            <Inner>{props.children}</Inner>
        </TOASTER.Provider>
    )
}

function Inner(props: { children: ReactNode }) {
    const ctx = TOASTER.useContext()

    return (
        <>
            {props.children}
            {ctx.toasterEl}
        </>
    )
}

export interface ToastOpts {
    duration?: number
    error?: boolean
}

export const TOASTER = newContext(() => {
    const [toasts, setToasts] = useState(
        new Array<{
            id: number
            content: string | ReactNode
            opts: ToastOpts | undefined
        }>(),
    )
    const idPool = useMemo(() => new IdPool(), [])

    const toasterEl = useMemo(() => {
        const els = toasts.map((x, idx) => {
            const yPos = toasts.length - 1 - idx
            const width = 1 - yPos * 0.05

            return (
                <button
                    onClick={() => deleteToast(x.id)}
                    className={cn(`toast id${x.id}`, {
                        error: !!x.opts?.error,
                    })}
                    key={x.id}
                    style={{
                        zIndex: idx + 10,
                        scale: `${width.toFixed(3)} 1`,
                        // opacity: yPos === 0 ? 1 : 0.75,
                        filter: yPos === 0 ? "" : "brightness(0.65)",
                        ...{
                            "--y0": `${idx * 1 + 2}em`,
                            "--y1": `${idx * 1}em`,
                            "--y2": `${idx * 1 - 2}em`,
                        },
                    }}
                >
                    {x.content}
                </button>
            )
        })
        return (
            <div className="toaster">
                <div className="toast-list">{els}</div>
            </div>
        )
    }, [toasts])

    const deleteToast = (id: number) => {
        document.querySelector(`.toast.id${id}`)?.classList.add("delete")
        setTimeout(
            () => setToasts((curr) => curr.filter((x) => x.id !== id)),
            200,
        )
    }

    return {
        toast: (content: string | ReactNode, opts?: ToastOpts) => {
            const id = idPool.acquire()
            setToasts((curr) => [
                {
                    id,
                    content:
                        typeof content === "string" ? (
                            <b>{content}</b>
                        ) : (
                            content
                        ),
                    opts,
                },
                ...curr,
            ])

            setTimeout(() => {
                deleteToast(id)
            }, opts?.duration ?? 2000)
        },
        toasterEl,
    }
})

const CSS = css`
    .toaster {
        position: fixed;
        top: 1%;
        left: 0;
        right: 0;
        z-index: 10;

        display: flex;
        justify-content: center;

        .toast-list {
            display: grid;
            grid-template-columns: max-content;
            justify-content: center;
        }

        .toast {
            grid-row: 1;
            grid-column: 1;
            height: min-content;
            min-width: 10em;

            text-align: left;
            padding: 0.5em 1em;
            border-radius: 0.5em;
            border-width: 1.5px;
            border-color: color-mix(
                in oklab,
                var(--foreground),
                transparent 59%
            );
            cursor: pointer;

            background-color: var(--secondary);
            &.error {
                background-color: var(--color-red-600);
            }

            transition:
                opacity 0.15s ease-in,
                translate 0.1s ease-out;

            translate: 0 var(--y1);
            @starting-style {
                translate: 0 var(--y0);
            }
            &.delete {
                translate: 0 var(--y2);
            }

            opacity: 1;
            @starting-style {
                opacity: 0;
            }
            &.delete {
                opacity: 0;
            }
        }
    }
`
