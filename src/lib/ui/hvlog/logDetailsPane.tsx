import { CompleteLog } from "@/lib/logDb/logDb"
import React from "react"
import { Card, CardContent } from "../shadcn/card"
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "../shadcn/tabs"
import { CombatInfo } from "./combat/combatInfo"
import { DropInfo } from "./drop/dropInfo"
import { LogEventList } from "./logEventList"

export const LogDetailsPane = React.memo(
    ({ log }: { log?: CompleteLog }) => {
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
                    <TabsList className="grid grid-cols-3 w-full mb-2">
                        <TabsTrigger
                            value="stats"
                            className="font-bold py-1"
                        >
                            Drops
                        </TabsTrigger>

                        <TabsTrigger
                            value="combat"
                            className="font-bold py-1"
                        >
                            Combat
                        </TabsTrigger>

                        <TabsTrigger
                            value="events"
                            className="font-bold py-1"
                        >
                            Log
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent
                        value="stats"
                        className="h-full min-h-0"
                    >
                        <Card className="min-h-full py-0 h-full">
                            <CardContent className="h-full p-8">
                                {log ? <DropInfo log={log} /> : ""}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent
                        value="combat"
                        className="h-full min-h-0"
                    >
                        <Card className="min-h-0 h-full py-0 overflow-auto">
                            <CardContent className="p-0">
                                {log ? <CombatInfo log={log} /> : ""}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent
                        value="events"
                        className="h-full min-h-0"
                    >
                        <Card className="min-h-0 h-full py-0">
                            <CardContent className="p-0 min-h-0">
                                {log ? (
                                    <LogEventList log={log} />
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
)
