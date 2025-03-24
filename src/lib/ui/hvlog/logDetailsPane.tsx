import { Card, CardContent } from "../shadcn/card"
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "../shadcn/tabs"
import { LogEventList } from "./logEventList"
import { LogWithAnalysis } from "./main"

export function LogDetailsPane(props: {
    selectedLog?: LogWithAnalysis
}) {
    return (
        <div
            className="details-pane-root w-full h-full"
            style={{
                containerType: "inline-size",
            }}
        >
            <Tabs
                defaultValue="stats"
                className="details-pane h-full w-full"
            >
                <TabsList className="grid grid-cols-2 w-full mb-2">
                    <TabsTrigger
                        value="stats"
                        className="font-bold py-1"
                    >
                        Stats
                    </TabsTrigger>
                    <TabsTrigger
                        value="events"
                        className="font-bold py-1"
                    >
                        Log
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="stats" className="h-full min-h-0">
                    <Card className="min-h-full py-0">
                        <CardContent className="h-full p-8">
                            Stats
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent
                    value="events"
                    className="h-full min-h-0"
                >
                    <Card className="min-h-0 h-full py-0">
                        <CardContent className="p-0 min-h-0">
                            {props.selectedLog ? (
                                <LogEventList
                                    log={props.selectedLog}
                                />
                            ) : (
                                ""
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    )
}
