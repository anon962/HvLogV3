import "@/lib/ui/global.css"
import { RootComponent } from "@/lib/utils/userscriptUtils"
import { DbContextProvider } from "../dbContext"
import { Sidebar } from "../sidebar"

export const EquipLog: RootComponent = ({
    app,
    persistentDb,
    isekaiDb,
}) => {
    return (
        <DbContextProvider
            persistentDb={persistentDb}
            isekaiDb={isekaiDb}
        >
            <Sidebar>lmao</Sidebar>
        </DbContextProvider>
    )
}
