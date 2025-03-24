import { LogWithAnalysis } from "./main"

export function DropStats(props: { log: LogWithAnalysis }) {
    return (
        <div className="h-full overflow-auto">
            <pre>
                {JSON.stringify(props.log.analysis.drops, null, 2)}
            </pre>
        </div>
    )
}
