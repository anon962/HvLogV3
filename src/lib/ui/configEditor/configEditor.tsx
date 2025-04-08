import { App } from "@/lib/app/app"
import "@/lib/ui/global.css"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/lib/ui/shadcn/table"
import {
    FC,
    FormEvent,
    ReactNode,
    useEffect,
    useRef,
    useState,
} from "react"
import { toast } from "sonner"
import { DEFAULT_CONFIG } from "../constants"
import { XIcon } from "../icons/tailwind"
import { Button } from "../shadcn/button"
import { Input } from "../shadcn/input"
import { Toaster } from "../shadcn/sonner"
import { Sidebar } from "../sidebar"
import {
    SettingsFormProvider,
    useSettingsForm,
} from "./settingsFormContext"

export const ConfigEditor: FC<{ app: App }> = ({ app }) => {
    return (
        <SettingsFormProvider app={app}>
            <Sidebar>
                <ConfigEditorInner />
            </Sidebar>
        </SettingsFormProvider>
    )
}

function ConfigEditorInner() {
    const { settings, clearSettings, submit } = useSettingsForm()

    const formRef = useRef<HTMLFormElement>(null)

    let [isValid, setIsValid] = useState(true)
    useEffect(() => {
        if (!formRef.current) {
            return
        }

        formRef.current.oninput = () => {
            const update = !!formRef.current?.checkValidity()

            setIsValid(update)
        }
    }, [formRef.current])

    function onSubmit(ev?: FormEvent) {
        ev?.preventDefault()

        if (!isValid) {
            return
        }

        submit()

        toast("Saved!", {
            position: "top-center",
            duration: 2000,
        })
    }

    useEffect(() => {
        if (!formRef.current) {
            return
        }

        let hasCtrl = false
        let hasS = false

        const onKeyDown = (ev: KeyboardEvent) => {
            switch (ev.key) {
                case "Control":
                    hasCtrl = true
                    break
                case "s":
                    hasS = true
                    break
            }

            if (hasCtrl && hasS) {
                ev.stopImmediatePropagation()
                ev.preventDefault()
                onSubmit()
            }
        }

        const onKeyUp = (ev: KeyboardEvent) => {
            switch (ev.key) {
                case "Control":
                    hasCtrl = false
                    break
                case "s":
                    hasS = false
                    break
            }
        }

        window.addEventListener("keydown", onKeyDown)
        window.addEventListener("keyup", onKeyUp)

        return () => {
            window.removeEventListener("keydown", onKeyDown)
            window.removeEventListener("keyup", onKeyUp)
        }
    }, [onSubmit])

    return (
        <form
            ref={formRef}
            onSubmit={(ev) => onSubmit(ev)}
            className="config-editor size-full max-w-[80rem] mx-auto p-16"
        >
            <Toaster />

            <div className="border rounded-md flex flex-col h-full">
                {/* Inputs */}
                <div className="grow size-full flex flex-col py-8 overflow-auto">
                    <h1 className="text-xl px-8 font-semibold">
                        Settings
                    </h1>

                    <hr className="divider"></hr>
                    <div className="px-8">
                        <EquipFilter />
                    </div>

                    <hr className="divider"></hr>
                    <div className="px-8">
                        <Prices />
                    </div>
                </div>

                <hr className="divider my-0!"></hr>

                {/* Footer buttons */}
                <div className="actions flex gap-4 p-8 justify-end">
                    <Button
                        onClick={() => clearSettings()}
                        className="px-8 py-3 cursor-pointer h-auto text-base font-semibold"
                        size="lg"
                        variant="secondary"
                        type="button"
                    >
                        Clear
                    </Button>

                    <Button
                        className="px-8 py-3 cursor-pointer h-auto text-base font-semibold text-foreground bg-pink-600 hover:bg-pink-600/90 flex flex-col leading-none gap-0.5"
                        size="lg"
                        disabled={!isValid}
                    >
                        <span>Save</span>

                        <span className="text-xs text-foreground/90">
                            ctrl+s
                        </span>
                    </Button>
                </div>
            </div>
        </form>
    )
}

function EquipFilter() {
    const { settings, setSettings } = useSettingsForm()

    const rows = settings.equipFilters.map((patt, idx) => {
        return (
            <div className="flex gap-2 items-center">
                <Input
                    onInput={(ev) => onInput(ev, idx)}
                    key={idx}
                    value={patt}
                    placeholder="legendary.*boots.*slaughter"
                    type="text"
                />

                <Button
                    onClick={() => onClose(idx)}
                    variant="ghost"
                    className="rounded-full cursor-pointer size-8 p-2!"
                    type="button"
                    style={{
                        visibility:
                            idx === settings.equipFilters.length - 1
                                ? "hidden"
                                : "initial",
                    }}
                >
                    <XIcon className="size-full" />
                </Button>
            </div>
        )
    })

    function onInput(ev: Event, idx: number) {
        const el = ev.target as HTMLInputElement

        try {
            new RegExp(el.value)
            el.setCustomValidity("")
        } catch (e) {
            el.setCustomValidity("Invalid regular expression")
        }

        settings.equipFilters![idx] = el.value
        setSettings({
            ...settings,
            equipFilters: [...settings.equipFilters!],
        })
    }

    function onClose(idx: number) {
        const prev = settings.equipFilters.slice(0, idx)
        const next = settings.equipFilters.slice(idx + 1)
        setSettings({
            ...settings,
            equipFilters: [...prev, ...next],
        })
    }

    useEffect(() => {
        const filters = settings.equipFilters

        const lst = filters[filters.length - 1]
        if (lst?.trim() !== "") {
            setSettings({
                ...settings,
                equipFilters: [...settings.equipFilters, ""],
            })
        }
    }, [settings.equipFilters])

    return (
        <>
            <SectionHeader
                label="Equip Filters"
                description={
                    <span>
                        Equip drops to highlight. Entries should be a{" "}
                        <Button variant="link" className="p-0 h-auto">
                            <a
                                href="https://regexr.com/8dofe"
                                rel="noreferrer"
                                className="underline text-blue-300"
                                target="_blank"
                            >
                                regular expression
                            </a>
                        </Button>
                        . Defaults to{" "}
                        <pre className="inline">
                            (?:magnificent|legendary|peerless)
                        </pre>
                    </span>
                }
            />

            <div className="flex flex-col gap-2 max-w-[30rem]">
                {...rows}
            </div>
        </>
    )
}

function Prices() {
    const { settings, setSettings } = useSettingsForm()

    function onInput(ev: Event, key: string) {
        const value = parseFloat(
            (ev.target as HTMLInputElement)?.value
        )

        setSettings({
            ...settings,
            prices: {
                ...settings.prices,
                [key]: isNaN(value) ? undefined : value,
            },
        })
    }

    const rows = Object.entries(DEFAULT_CONFIG.prices).map(
        ([label, default_]) => {
            const curr = settings.prices[label]

            return (
                <TableRow key={label}>
                    <TableCell className="pr-4 text-right">
                        {label}
                    </TableCell>
                    <TableCell>
                        <Input
                            onInput={(ev) => onInput(ev, label)}
                            className="px-2"
                            type="number"
                            placeholder={default_.toString()}
                            defaultValue={curr}
                        />
                    </TableCell>
                </TableRow>
            )
        }
    )

    return (
        <>
            <SectionHeader
                label="Prices"
                description="Used to calculate value of drops"
            />

            <Table className="w-auto">
                <TableHeader>
                    <TableRow>
                        <TableHead className="">Item</TableHead>
                        <TableHead className="">
                            Market Price
                        </TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>{...rows}</TableBody>
            </Table>
        </>
    )
}

function SectionHeader(p: {
    label: string
    description: ReactNode
    className?: string
}) {
    return (
        <div
            className={`flex flex-row gap-2 items-stretch leading-6 pb-4 ${p.className}`}
        >
            <h2 className="text-lg font-semibold leading-6!">
                {p.label}
            </h2>

            <span className="w-0 min-h-4 border-r-2 border-muted-foreground opacity-50"></span>

            <span className="text-muted-foreground text-sm flex items-end">
                {p.description}
            </span>
        </div>
    )
}
