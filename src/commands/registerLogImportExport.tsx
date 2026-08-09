import { mountReact } from "@/lib/utils/userscriptUtils"

export function registerLogExport() {
    mountReact(Dialog, {}, {})
    window.GM_registerMenuCommand(
        "Log Import / Export",
        () => mountReact(Dialog, {}, {}),
        {
            id: "export_logs",
        },
    )
}

function Dialog() {
    return (
        <>
            <style>
                {`
                :host {
                    height: 100vh;
                    width: 100vw;
                }
                `}
            </style>
        </>
    )
}
