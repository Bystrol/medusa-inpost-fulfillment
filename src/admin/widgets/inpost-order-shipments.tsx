import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { ArrowPath } from "@medusajs/icons"
import { DetailWidgetProps } from "@medusajs/types"
import { Container, Heading, IconButton, Table, Text, toast } from "@medusajs/ui"
import { useCallback, useEffect, useMemo, useState } from "react"
import { ShipmentActions } from "../components/shipment-actions"
import { ShipmentStatusBadge } from "../components/shipment-status-badge"
import { listInPostShipments } from "../lib/inpost-api"
import {
  formatDateTime,
  getShipmentServiceLabel,
} from "../lib/shipment-format"
import { InPostAdminShipment } from "../../lib/admin-shipments"

type OrderWidgetData = {
  id: string
  fulfillments?: Array<{
    id: string
    provider_id?: string | null
    data?: Record<string, unknown> | null
    updated_at?: string | Date | null
  }>
}

const EMPTY_SHIPMENTS_POLL_INTERVAL_MS = 3000
const EMPTY_SHIPMENTS_POLL_ATTEMPTS = 20

function isInPostFulfillment(
  fulfillment: NonNullable<OrderWidgetData["fulfillments"]>[number]
): boolean {
  return (
    Boolean(fulfillment.provider_id?.includes("inpost")) ||
    Boolean(fulfillment.data?.shipment_id)
  )
}

const InPostOrderShipmentsWidget = ({
  data,
}: DetailWidgetProps<OrderWidgetData>) => {
  const [shipments, setShipments] = useState<InPostAdminShipment[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const inPostFulfillmentFingerprint = useMemo(() => {
    return (data.fulfillments || [])
      .filter(isInPostFulfillment)
      .map((fulfillment) =>
        [
          fulfillment.id,
          fulfillment.provider_id || "",
          fulfillment.updated_at ? String(fulfillment.updated_at) : "",
          fulfillment.data?.shipment_id
            ? String(fulfillment.data.shipment_id)
            : "",
        ].join(":")
      )
      .join("|")
  }, [data.fulfillments])

  const hasInPostFulfillment = Boolean(inPostFulfillmentFingerprint)

  const loadShipments = useCallback(
    async (options: { showLoading?: boolean; showErrors?: boolean } = {}) => {
      const { showLoading = true, showErrors = true } = options

      if (showLoading) {
        setIsLoading(true)
      }

      try {
        const response = await listInPostShipments({
          order_id: data.id,
          limit: 20,
        })
        setShipments(response.shipments)
      } catch (error) {
        if (showErrors) {
          toast.error(error instanceof Error ? error.message : String(error))
        }
      } finally {
        if (showLoading) {
          setIsLoading(false)
        }
      }
    },
    [data.id]
  )

  useEffect(() => {
    void loadShipments()
  }, [data.id, inPostFulfillmentFingerprint, loadShipments])

  useEffect(() => {
    if (!hasInPostFulfillment || shipments.length) {
      return
    }

    let attempts = 0
    const interval = window.setInterval(() => {
      attempts += 1

      if (attempts > EMPTY_SHIPMENTS_POLL_ATTEMPTS) {
        window.clearInterval(interval)
        return
      }

      if (document.visibilityState === "visible") {
        void loadShipments({ showLoading: false, showErrors: false })
      }
    }, EMPTY_SHIPMENTS_POLL_INTERVAL_MS)

    return () => window.clearInterval(interval)
  }, [hasInPostFulfillment, loadShipments, shipments.length])

  const handleShipmentRefresh = (shipment: InPostAdminShipment) => {
    setShipments((current) =>
      current.map((item) => (item.id === shipment.id ? shipment : item))
    )
  }

  if (!shipments.length && !hasInPostFulfillment) {
    return null
  }

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <div>
          <Heading level="h2">InPost shipments</Heading>
          <Text className="text-ui-fg-subtle" size="small">
            {shipments.length
              ? `${shipments.length} records for this order`
              : "Waiting for the local shipment record"}
          </Text>
        </div>
        <IconButton
          size="small"
          variant="transparent"
          isLoading={isLoading}
          onClick={() => void loadShipments()}
        >
          <ArrowPath />
        </IconButton>
      </div>

      <Table>
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell>Shipment</Table.HeaderCell>
            <Table.HeaderCell>Service</Table.HeaderCell>
            <Table.HeaderCell>Status</Table.HeaderCell>
            <Table.HeaderCell>Synced</Table.HeaderCell>
            <Table.HeaderCell />
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {isLoading ? (
            <Table.Row>
              <td className="h-12 py-0 pl-6 pr-6" colSpan={5}>
                <Text className="text-ui-fg-subtle">Loading shipments...</Text>
              </td>
            </Table.Row>
          ) : shipments.length ? (
            shipments.map((shipment) => (
              <Table.Row key={shipment.id}>
                <Table.Cell>
                  <div>
                    <Text size="small" weight="plus">
                      {shipment.shipment_id}
                    </Text>
                    <Text className="text-ui-fg-subtle" size="xsmall">
                      {shipment.tracking_number || "No tracking number"}
                    </Text>
                  </div>
                </Table.Cell>
                <Table.Cell>
                  {getShipmentServiceLabel(shipment.service_type)}
                </Table.Cell>
                <Table.Cell>
                  <ShipmentStatusBadge status={shipment.status} />
                </Table.Cell>
                <Table.Cell>{formatDateTime(shipment.last_synced_at)}</Table.Cell>
                <Table.Cell>
                  <ShipmentActions
                    shipment={shipment}
                    onRefresh={handleShipmentRefresh}
                  />
                </Table.Cell>
              </Table.Row>
            ))
          ) : (
            <Table.Row>
              <td className="h-12 py-0 pl-6 pr-6" colSpan={5}>
                <Text className="text-ui-fg-subtle">
                  The InPost fulfillment was created. Waiting for the local
                  shipment record to be saved.
                </Text>
              </td>
            </Table.Row>
          )}
        </Table.Body>
      </Table>
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "order.details.side.after",
})

export default InPostOrderShipmentsWidget
