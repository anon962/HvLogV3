import { DbN, LogEntries } from "@/lib/db/dbN"
import { IndexMap } from "@/lib/stats/indexMap"
import { DetailsSummary } from "@/lib/stats/summary"
import React from "react"
import { IS_REMOTE } from "../../constants"
import { Card, CardContent } from "../shadcn/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../shadcn/tabs"
import { CombatInfo } from "./combat/combatInfo"
import { DropInfo } from "./drop/dropInfo"
import { LogEventList } from "./logEventList"
import { L } from "myutils"

export const LogDetailsPane = React.memo(
    (props: {
        entries: LogEntries | null
        prices: DbN.Prices
        details: DetailsSummary | null
        indexMap: IndexMap
    }) => {
        return (
            <div
                className="details-pane-root w-full h-full"
                style={{
                    containerType: "inline-size",
                }}
            >
                <Tabs
                    defaultValue={IS_REMOTE ? "combat" : "stats"}
                    className="details-pane h-full w-full"
                >
                    <TabsList className="w-full mb-2 flex">
                        <TabsTrigger value="stats" className="font-bold py-1">
                            Drops
                        </TabsTrigger>

                        <TabsTrigger value="combat" className="font-bold py-1">
                            Combat
                        </TabsTrigger>

                        <TabsTrigger value="events" className="font-bold py-1">
                            Log
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="stats" className="h-full min-h-0">
                        <Card className="min-h-full py-0 h-full overflow-auto">
                            <CardContent className="h-full p-8">
                                {props.details ? (
                                    <DropInfo
                                        prices={props.prices}
                                        stats={props.details}
                                        indexMap={props.indexMap}
                                    />
                                ) : (
                                    ""
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="combat" className="h-full min-h-0">
                        <Card className="min-h-0 h-full py-0 overflow-auto">
                            <CardContent className="p-0">
                                {props.details ? (
                                    <CombatInfo
                                        details={props.details}
                                        indexMap={props.indexMap}
                                    />
                                ) : (
                                    ""
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent
                        value="events"
                        className="h-full min-h-0 overflow-auto"
                    >
                        <Card className="min-h-0 h-full py-0">
                            <CardContent className="p-0 min-h-0">
                                {props.entries && props.indexMap ? (
                                    <LogEventList
                                        entries={props.entries}
                                        indexMap={props.indexMap}
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
    },
)
