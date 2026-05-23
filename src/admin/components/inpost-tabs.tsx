import { Tabs } from "@medusajs/ui"
import { useLocation, useNavigate } from "react-router-dom"

type InPostTab = "shipments" | "returns"

function getActiveTab(pathname: string): InPostTab {
  return pathname.includes("/inpost/returns") ? "returns" : "shipments"
}

export function InPostTabs() {
  const location = useLocation()
  const navigate = useNavigate()

  return (
    <div className="px-6 py-3">
      <Tabs
        value={getActiveTab(location.pathname)}
        onValueChange={(value) => {
          navigate(value === "returns" ? "/inpost/returns" : "/inpost/shipments")
        }}
      >
        <Tabs.List>
          <Tabs.Trigger value="shipments">Shipments</Tabs.Trigger>
          <Tabs.Trigger value="returns">Returns</Tabs.Trigger>
        </Tabs.List>
      </Tabs>
    </div>
  )
}
