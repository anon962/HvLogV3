import {
    DEFAULT_USERSCRIPT_CONFIG,
    USERSCRIPT_CONFIG,
    UserscriptConfig,
    validateConfigUser,
} from "@/lib/db/userscriptConfig"
import { CommonProps } from "@/lib/utils/miscUtils"
import { Check } from "lucide-react"
import {
    alphabetical,
    cn,
    Css,
    css,
    isEqual,
    mergeProps,
    useDebouncedWrite,
} from "myutils"
import {
    Dispatch,
    ReactNode,
    SetStateAction,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react"
import { Loader } from "../loader"
import { Button } from "../shadcn/button"
import { Input } from "../shadcn/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "../shadcn/select"

export function ConfigPage(props: {}) {
    const { config, setConfig } = USERSCRIPT_CONFIG.useContext()

    const [pending, setPending] = useState<UserscriptConfig>(
        JSON.parse(JSON.stringify(config)),
    )

    const [loading, setLoading] = useState(false)

    const [version, setVersion] = useState(0)
    const toastEl = useRef<HTMLDivElement>(null)
    const toastElTimer = useRef<any>(0)

    useEffect(() => {
        if (!isEqual(config, pending)) {
            setVersion(version + 1)
            setPending(JSON.parse(JSON.stringify(config)))
        }
    }, [config])

    const hasChanges = useMemo(
        () => !isEqual(config, pending),
        [config, pending],
    )

    return (
        <div className="flex justify-center h-[95vh]">
            <form className="config">
                <Css css={CSS} />

                <div className="config-inner">
                    <Setting
                        title="Prefetch Delay"
                        description={
                            <div>
                                Time to wait in seconds before hovering a link
                                <br />
                                triggers a page preload, which can be CPU-heavy.
                                <br />
                                Set a negative value to disable, or 0 for
                                default (0.3s).
                            </div>
                        }
                    >
                        <MyNumberInput
                            version={version}
                            value={pending.prefetchDelay}
                            step={0.1}
                            onInput={(v) =>
                                setPending({ ...pending, prefetchDelay: v })
                            }
                            width={12}
                            scale={1000}
                        />
                    </Setting>

                    <Setting
                        title="Show Log Delete"
                        description={
                            <div>
                                Whether to show a delete button for individual
                                logs.
                                <br /> For bulk-deletion, instead use the Manage
                                Logs dialog <br /> from the userscript extension
                                menu.
                            </div>
                        }
                    >
                        <MySelect
                            value={pending.showDelete}
                            options={useMemo(
                                () =>
                                    [
                                        {
                                            value: "default",
                                            label: "default (no)",
                                        },
                                        {
                                            value: "warn",
                                            label: "yes",
                                        },
                                        {
                                            value: "yes",
                                            label: "yes (no warning)",
                                        },
                                        {
                                            value: "no",
                                            label: "no",
                                        },
                                    ] as const,
                                [],
                            )}
                            onSelect={(v) =>
                                setPending({
                                    ...pending,
                                    showDelete: v,
                                })
                            }
                            triggerProps={{
                                className: "w-[26ch]!",
                            }}
                        />
                    </Setting>

                    <Setting
                        title="Equip Filter"
                        description={
                            <div>
                                Minimum equip tier for Notable Equips section of
                                drop log.
                            </div>
                        }
                    >
                        <MySelect
                            value={pending.detailsEquipFilter}
                            options={useMemo(
                                () =>
                                    [
                                        {
                                            value: "default",
                                            label: "default (Legendary)",
                                        },
                                        {
                                            value: "peerless",
                                            label: "Peerless",
                                        },
                                        {
                                            value: "legendary",
                                            label: "Legendary",
                                        },
                                        {
                                            value: "magnificent",
                                            label: "Magnificent",
                                        },
                                    ] as const,
                                [],
                            )}
                            onSelect={(v) =>
                                setPending({
                                    ...pending,
                                    detailsEquipFilter: v,
                                })
                            }
                            triggerProps={{
                                className: "w-[26ch]!",
                            }}
                        />
                    </Setting>

                    <Setting
                        title="Target Tab"
                        description={
                            <div>
                                Whether HvLog opens in current tab or new tab.
                            </div>
                        }
                    >
                        <MySelect
                            value={pending.samePageLoad}
                            options={useMemo(
                                () =>
                                    [
                                        {
                                            value: "default",
                                            label: "default (new tab)",
                                        },
                                        {
                                            value: "never",
                                            label: "New Tab",
                                        },
                                        {
                                            value: "always",
                                            label: "Current Tab",
                                        },
                                    ] as const,
                                [],
                            )}
                            onSelect={(v) =>
                                setPending({
                                    ...pending,
                                    samePageLoad: v,
                                })
                            }
                            triggerProps={{
                                className: "w-[26ch]!",
                            }}
                        />
                    </Setting>

                    <Setting
                        title="Price Data Source"
                        description={
                            <div>
                                Source of prices used for calculating drop
                                value.
                                <br />
                                Updated daily unless disabled.
                                <br />
                                (The{" "}
                                <a href="https://hvdata.gisadan.dev/api/fapspreader.json">
                                    HvData
                                </a>{" "}
                                option proxies{" "}
                                <a href="https://market.fapspreader.com/">
                                    FapSpreader
                                </a>
                                .)
                            </div>
                        }
                    >
                        <MySelect
                            value={pending.priceSource}
                            options={useMemo(
                                () =>
                                    [
                                        {
                                            value: "default",
                                            label: "default (HvData)",
                                        },
                                        {
                                            value: "hvdata",
                                            label: "HvData",
                                        },
                                        {
                                            value: "none",
                                            label: "disabled",
                                        },
                                    ] as const,
                                [],
                            )}
                            onSelect={(v) =>
                                setPending({
                                    ...pending,
                                    priceSource: v,
                                })
                            }
                        />
                    </Setting>

                    <UploadSection pending={pending} setPending={setPending} />

                    <PriceSection
                        pending={pending}
                        setPending={setPending}
                        version={version}
                    />
                </div>

                <div className="spacer"></div>

                <div className="actions">
                    <div ref={toastEl} className="toast hide">
                        <Check fontWeight={600} /> Saved!
                    </div>

                    <div className="buttons">
                        <ActionButton
                            label="Defaults"
                            onClick={() => {
                                let clearUser = false
                                if (pending.hvdataUser?.id) {
                                    clearUser = confirm(
                                        `All settings set to default. Delete the HvData user too? (id=${pending.hvdataUser.id}, key=${pending.hvdataUser.key}, name=${pending.hvdataUser.name})`,
                                    )
                                }

                                const update = DEFAULT_USERSCRIPT_CONFIG()
                                if (!clearUser) {
                                    update.hvdataUser = JSON.parse(
                                        JSON.stringify(pending.hvdataUser),
                                    )
                                }

                                setPending(update)
                                setVersion(version + 1)
                            }}
                            loading={loading}
                            variant="outline"
                        />
                        <ActionButton
                            label="Reset"
                            onClick={() => {
                                setPending(JSON.parse(JSON.stringify(config)))
                                setVersion(version + 1)
                            }}
                            loading={loading}
                            variant="outline"
                        />
                        <ActionButton
                            label="Save"
                            onClick={async () => {
                                let update = pending

                                if (
                                    update.hvdataUploadMode === "auto_all" &&
                                    update.hvdataUploadMode !==
                                        config.hvdataUploadMode
                                ) {
                                    if (
                                        !confirm(
                                            "All existing and future logs to HvData. Are you sure?",
                                        )
                                    ) {
                                        return
                                    }
                                }

                                setLoading(() => true)
                                update = await validateConfigUser(update)

                                setConfig(JSON.parse(JSON.stringify(update)))
                                setVersion(version + 1)
                                setLoading(() => false)

                                toastEl.current?.classList.remove("hide")
                                clearTimeout(toastElTimer.current)
                                toastElTimer.current = setTimeout(() => {
                                    toastEl.current?.classList.add("hide")
                                }, 2500)
                            }}
                            loading={loading}
                            variant="secondary"
                            disabled={!hasChanges}
                        />
                    </div>
                </div>
            </form>
        </div>
    )
}

function UploadSection(props: {
    pending: UserscriptConfig
    setPending: Dispatch<SetStateAction<UserscriptConfig>>
}) {
    const isActive =
        props.pending.hvdataUploadMode !== "default" &&
        props.pending.hvdataUploadMode !== "disabled"

    const [idEdit, setIdEdit] = useState(false)
    const [keyEdit, setKeyEdit] = useState(false)

    const [namePref, setNamePref] = useDebouncedWrite({
        value: props.pending.hvdataNamePref,
        onUpdate: (x) =>
            props.setPending((curr) => ({
                ...curr,
                hvdataNamePref: x,
            })),
    })

    const setUser = (x: Partial<UserscriptConfig["hvdataUser"]>) => {
        const user = {
            name: "",
            id: "",
            key: "",
            ...(props.pending.hvdataUser ?? {}),
            ...x,
        }
        props.setPending({
            ...props.pending,
            hvdataUser: user,
        })
    }

    return (
        <>
            <Setting
                title="Log Uploads"
                description={
                    <div>
                        Whether to upload logs to{" "}
                        <a href="https://hvdata.gisadan.dev/logs">HvData</a>.
                        Uploaded logs can be shared by link.{" "}
                        <b>Uploads are public and cannot be deleted!</b>
                    </div>
                }
                labelProps={{ className: "mb-2!" }}
            >
                <MySelect
                    value={props.pending.hvdataUploadMode}
                    options={useMemo(
                        () =>
                            [
                                {
                                    value: "default",
                                    label: "default (disabled)",
                                },
                                {
                                    value: "disabled",
                                    label: "disabled",
                                },
                                {
                                    value: "manual",
                                    label: "Manual",
                                },
                                {
                                    value: "auto_new",
                                    label: "Automatic (new logs)",
                                },
                                {
                                    value: "auto_all",
                                    label: "Automatic (all logs)",
                                },
                            ] as const,
                        [],
                    )}
                    onSelect={(v) =>
                        props.setPending({
                            ...props.pending,
                            hvdataUploadMode: v,
                            hvdataUploadStart:
                                v === "auto_all"
                                    ? new Date().toISOString()
                                    : null,
                        })
                    }
                    triggerProps={{
                        className: "w-[26ch]! mb-2!",
                    }}
                />
            </Setting>

            {
                <div
                    className="uploads-secondary"
                    style={{ display: isActive ? "contents" : "none" }}
                >
                    <div>
                        <p>Delay uploads until Dawn?</p>
                        <p className="text-muted-foreground text-[length:0.7rem]">
                            Uploads will not be visible until the next Dawn.
                            <br />
                            Start date of battle will also be set to Dawn.
                        </p>
                    </div>
                    <MySelect
                        value={props.pending.hvdataDelayDawn}
                        options={useMemo(
                            () =>
                                [
                                    {
                                        value: "default",
                                        label: "default (no)",
                                    },
                                    {
                                        value: "yes",
                                        label: "yes",
                                    },
                                    {
                                        value: "no",
                                        label: "no",
                                    },
                                ] as const,
                            [],
                        )}
                        onSelect={(v) =>
                            props.setPending({
                                ...props.pending,
                                hvdataDelayDawn: v,
                            })
                        }
                    />

                    <div>
                        Anonymous?
                        <p className="text-muted-foreground text-[length:0.7rem]">
                            Uploads will have the HvData user name and user id
                            hidden.
                            <br /> (Both listed below.)
                        </p>
                    </div>
                    <MySelect
                        value={props.pending.hvdataAnon}
                        options={useMemo(
                            () =>
                                [
                                    {
                                        value: "default",
                                        label: "default (no)",
                                    },
                                    {
                                        value: "yes",
                                        label: "yes",
                                    },
                                    {
                                        value: "no",
                                        label: "no",
                                    },
                                ] as const,
                            [],
                        )}
                        onSelect={(v) =>
                            props.setPending({
                                ...props.pending,
                                hvdataAnon: v,
                            })
                        }
                    />

                    <div>
                        <p>Display Name (optional)</p>
                        <p className="text-muted-foreground text-[length:0.7rem]">
                            Whatever name you want the uploads associated with.
                            <br /> Does not have to be your real user name /
                            unique.
                        </p>
                    </div>
                    <Input
                        value={namePref ?? ""}
                        type="string"
                        placeholder={props.pending.hvdataUser?.name ?? ""}
                        onInput={(ev) => {
                            const v = ev.target.value.trim()
                            if (v.length > 0) {
                                setNamePref(v)
                            } else {
                                setNamePref(null)
                            }
                        }}
                    />

                    <div className="flex flex-col">
                        <p>User Id</p>
                        <p className="text-muted-foreground text-[length:0.7rem]">
                            Do NOT edit this unless you are sure
                            <br /> the id + key is valid
                        </p>
                    </div>
                    <div className="flex gap-2 items-center">
                        <Input
                            value={props.pending.hvdataUser?.id ?? ""}
                            type="string"
                            disabled={!idEdit}
                            onChange={(ev) => {
                                const v = ev.target.value.trim()
                                setUser({
                                    id: v,
                                })
                            }}
                        />
                        <Input
                            type="checkbox"
                            checked={idEdit}
                            onChange={(ev) => setIdEdit(!ev.target.checked)}
                        />
                    </div>

                    <div className="flex flex-col">
                        <p>User Key</p>
                        <p className="text-muted-foreground text-[length:0.7rem]">
                            Do NOT edit this unless you are sure
                            <br /> the id + key is valid
                        </p>
                    </div>
                    <div className="flex gap-2 items-center">
                        <Input
                            value={props.pending.hvdataUser?.key ?? ""}
                            type="string"
                            disabled={!keyEdit}
                            onChange={(ev) => {
                                const v = ev.target.value.trim()
                                setUser({
                                    key: v,
                                })
                            }}
                        />
                        <Input
                            type="checkbox"
                            checked={keyEdit}
                            onChange={(ev) => setKeyEdit(!ev.target.checked)}
                        />
                    </div>
                </div>
            }
        </>
    )
}

function PriceSection(props: {
    pending: UserscriptConfig
    setPending: Dispatch<SetStateAction<UserscriptConfig>>
    version: number
}) {
    const keys = useMemo(() => {
        const persistent = new Set(Object.keys(props.pending.prices.persistent))
        const isekai = new Set(Object.keys(props.pending.prices.isekai))
        const all = alphabetical([...persistent.union(isekai)])
        return { all, persistent, isekai }
    }, [props.pending.prices])

    return (
        <div className="prices col-span-2">
            <h2 className="self-start pb-2 pt-8!">Price Overrides</h2>
            <div className="self-end grid gap-x-4 gap-y-2 items-center text-sm">
                <h3>Persistent</h3>
                <h3>Isekai</h3>
                <h3></h3>

                {keys.all.map((k) => {
                    return (
                        <PriceInput
                            key={k}
                            version={props.version}
                            pending={props.pending}
                            setPending={props.setPending}
                            priceKey={k}
                            persistent={
                                keys.persistent.has(k)
                                    ? props.pending.prices.persistent[k]
                                    : null
                            }
                            isekai={
                                keys.isekai.has(k)
                                    ? props.pending.prices.isekai[k]
                                    : null
                            }
                        />
                    )
                })}
            </div>
        </div>
    )
}

function PriceInput(props: {
    version: number
    pending: UserscriptConfig
    setPending: Dispatch<SetStateAction<UserscriptConfig>>
    priceKey: string
    persistent: number | null
    isekai: number | null
}) {
    const [p, setP] = useDebouncedWrite({
        value: props.pending.pricesOverrides.persistent[props.priceKey] ?? null,
        onUpdate: (v) => {
            const update = {
                ...props.pending,
                pricesOverrides: {
                    ...props.pending.pricesOverrides,
                    persistent: {
                        ...props.pending.pricesOverrides["persistent"],
                        [props.priceKey]: v,
                    },
                },
            }
            if (v === null) {
                delete update.pricesOverrides["persistent"][props.priceKey]
            }
            props.setPending(update)
        },
    })
    const [i, setI] = useDebouncedWrite({
        value: props.pending.pricesOverrides.isekai[props.priceKey] ?? null,
        onUpdate: (v) => {
            const update = {
                ...props.pending,
                pricesOverrides: {
                    ...props.pending.pricesOverrides,
                    isekai: {
                        ...props.pending.pricesOverrides["isekai"],
                        [props.priceKey]: v,
                    },
                },
            }
            if (v === null) {
                delete update.pricesOverrides["isekai"][props.priceKey]
            }
            props.setPending(update)
        },
    })

    useEffect(() => {
        setP(props.pending.pricesOverrides.persistent[props.priceKey] ?? null)
        setI(props.pending.pricesOverrides.isekai[props.priceKey] ?? null)
    }, [props.version])

    return (
        <>
            <Input
                type="number"
                value={p ?? ""}
                disabled={props.persistent === null}
                placeholder={
                    props.persistent !== null ? String(props.persistent) : ""
                }
                min={0}
                onInput={(ev) => {
                    const update = parseFloat(ev.target.value)
                    if (isNaN(update)) {
                        setP(null)
                    } else {
                        setP(update)
                    }
                }}
            />
            <Input
                type="number"
                value={i ?? ""}
                disabled={props.isekai === null}
                placeholder={props.isekai !== null ? String(props.isekai) : ""}
                min={0}
                onInput={(ev) => {
                    const update = parseFloat(ev.target.value)
                    if (isNaN(update)) {
                        setI(null)
                    } else {
                        setI(update)
                    }
                }}
            />
            <div className="text-xs">{props.priceKey}</div>
        </>
    )
}

function ActionButton(
    props: {
        label: string
        loading: boolean
        disabled?: boolean
        onClick: () => void
        variant: "outline" | "secondary"
    } & CommonProps,
) {
    return (
        <Button
            type="button"
            className={cn("relative w-24 font-bold", props.className)}
            disabled={props.disabled || props.loading}
            onClick={props.onClick}
            variant={props.variant}
        >
            <span className={cn(props.loading ? "invisible" : "")}>
                {props.label}
            </span>
            <span className="absolute">
                <Loader show={props.loading} className="text-sky-400" />
            </span>
        </Button>
    )
}

function MySelect<T extends Array<{ value: string; label: string }>>(props: {
    value: string
    options: T
    triggerProps?: CommonProps
    onSelect: (v: T[number]["value"]) => void
}) {
    return (
        <div>
            <Select
                value={props.value}
                onValueChange={(x) => props.onSelect(x)}
            >
                <SelectTrigger
                    {...mergeProps(
                        { className: "w-[20ch]" },
                        props.triggerProps,
                    )}
                    size="sm"
                >
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    {props.options.map((x) => (
                        <SelectItem
                            key={x.value}
                            value={x.value}
                            className="text-[0.7rem]!"
                            style={{
                                color: "color-mix(in oklch, var(--color-blue-200), var(--foreground) 0%)",
                            }}
                        >
                            {x.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    )
}

function MyNumberInput(props: {
    version: number
    value: number
    onInput: (x: number) => void
    scale?: number
    min?: number
    max?: number
    step: number
    width: number
    nanValue?: number
}) {
    const scale = useMemo(() => props.scale ?? 1, [props.scale])
    const [raw, setRaw] = useState(String(props.value / scale))

    useEffect(() => {
        setRaw(String(props.value / (props.scale ?? 1)))
    }, [props.version])

    return (
        <Input
            type="number"
            value={raw}
            min={props.min}
            max={props.max}
            step={props.step}
            style={{
                maxWidth: `${props.width}ch`,
            }}
            onInput={(ev) => {
                const v = parseFloat(ev.target.value)
                props.onInput(isNaN(v) ? (props.nanValue ?? 0) : v * scale)
                setRaw(ev.target.value)
            }}
        />
    )
}

function Setting(props: {
    title: string
    description?: string | ReactNode | null
    children: ReactNode
    labelProps?: CommonProps
}) {
    return (
        <div className="setting contents">
            <div
                {...mergeProps(
                    {
                        className: "flex flex-col gap-1",
                    },
                    props.labelProps,
                )}
            >
                <h2>{props.title}</h2>
                {props.description ? (
                    <>
                        <div className="description">{props.description}</div>
                    </>
                ) : null}
            </div>
            {props.children}
        </div>
    )
}

const CSS = css`
    .config {
        font-family: monospace;
        height: 100%;
        margin: 2em;
        margin-bottom: 0;
        display: flex;
        flex-flow: column;
        background-color: var(--card);
        border-radius: 0.625rem;

        border-width: 2px;
        border-style: none;
        border-color: color-mix(
            in oklab,
            var(--color-border),
            var(--color-secondary) 10%
        );

        .config-inner {
            display: grid;
            grid-template-columns: 1fr max-content;
            gap: 0em 2em;
            align-items: center;
            overflow: auto;

            padding: 2em;
            border-width: inherit;
            border-color: inherit;
            border-style: solid;
            border-top-right-radius: 0.625rem;
            border-top-left-radius: 0.625rem;
            border-bottom: 0;
        }

        .setting > * {
            margin-bottom: 1.5em;
        }

        .spacer {
            flex-grow: 1;
            border-width: inherit;
            border-color: inherit;
            border-style: solid;
            border-top: 0;
            border-bottom: 0;
        }

        .actions {
            align-items: center;
            display: flex;
            justify-content: space-between;
            gap: 4em;

            padding: 1.5em;
            border-width: inherit;
            border-color: inherit;
            border-style: solid;
            border-bottom-right-radius: 0.625rem;
            border-bottom-left-radius: 0.625rem;
        }

        .actions .buttons {
            display: flex;
            justify-content: end;
            gap: 1em;
        }

        .uploads-secondary {
            display: contents;

            & > :nth-child(2n + 1) {
                text-align: right;
            }

            & > * {
                margin-bottom: 1em;
            }

            input[type="checkbox"] {
                height: 1.5em;
                width: 1.5em;
                cursor: pointer;
            }
        }

        .prices {
            h3 {
                color: var(--muted-foreground);
            }

            .grid {
                grid-template-columns: max-content max-content 1fr;
            }

            input {
                height: 2em;
                padding: 1em;
                width: 16ch;
            }
        }

        .toast {
            display: flex;
            align-items: center;
            gap: 0.25em;
            font-size: 1.4em;
            font-weight: bold;
            color: var(--primary);

            &.hide {
                transition: opacity 0.5s linear;
                opacity: 0;
            }
        }

        h2 {
            font-size: 1rem;
            color: color-mix(
                in oklch,
                var(--color-blue-200),
                var(--foreground) 0%
            );
            /* color: var(--primary); */
        }

        .description {
            color: var(--muted-foreground);
            font-size: 0.7rem;
            max-width: 70ch;
        }

        button[role="combobox"] {
            height: 3em;
            padding: 1em;
            width: 24ch;
            font-size: 0.75rem;
            gap: 0.25em;
            padding-right: 0.75em;

            & > svg {
            }
        }

        input {
            font-size: 0.75rem;
        }

        button[role="combobox"],
        input {
            color: color-mix(
                in oklch,
                var(--color-blue-200),
                var(--foreground) 0%
            );
        }
    }
`
