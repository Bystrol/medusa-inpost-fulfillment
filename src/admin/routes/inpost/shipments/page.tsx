import { defineRouteConfig } from "@medusajs/admin-sdk"
import { MagnifyingGlass, TruckFast, XMark } from "@medusajs/icons"
import {
  Button,
  Container,
  Drawer,
  Heading,
  Input,
  Select,
  Table,
  Text,
  Textarea,
  toast,
} from "@medusajs/ui"
import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { ShipmentActions } from "../../../components/shipment-actions"
import { ShipmentStatusBadge } from "../../../components/shipment-status-badge"
import { useUrlQueryState } from "../../../hooks/use-url-query-state"
import { listInPostShipments } from "../../../lib/inpost-api"
import {
  formatDateTime,
  getShipmentDestination,
  getShipmentReceiver,
  getRemoteShipmentStatus,
  getShipmentServiceLabel,
  stringifyRawResponse,
} from "../../../lib/shipment-format"
import {
  buildInPostShipmentListParamsFromUrlQuery,
  getInPostShipmentListPageIndex,
  INPOST_SHIPMENT_LIST_URL_QUERY_DEFAULTS,
  INPOST_SHIPMENT_STATUS_OPTIONS,
  InPostAdminShipment,
  InPostShipmentListUrlQuery,
} from "../../../../lib/admin-shipments"
import { InPostService } from "../../../../lib/types"

const PAGE_SIZE = 20

const InPostShipmentsPage = () => {
  const {
    values: filters,
    setValue: setFilter,
    reset: resetFilters,
  } = useUrlQueryState<InPostShipmentListUrlQuery>(
    INPOST_SHIPMENT_LIST_URL_QUERY_DEFAULTS
  )
  const [shipments, setShipments] = useState<InPostAdminShipment[]>([])
  const [count, setCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [rawShipment, setRawShipment] = useState<InPostAdminShipment | null>(
    null
  )
  const pageIndex = getInPostShipmentListPageIndex(filters)

  const setFilterAndResetPage = <TKey extends keyof InPostShipmentListUrlQuery>(
    key: TKey,
    value: InPostShipmentListUrlQuery[TKey]
  ) => {
    setFilter(key, value, { reset: ["page"] })
  }

  const setPageIndex = (nextPageIndex: number) => {
    setFilter("page", String(nextPageIndex + 1))
  }

  const loadShipments = async () => {
    setIsLoading(true)

    try {
      const response = await listInPostShipments(
        buildInPostShipmentListParamsFromUrlQuery(filters, PAGE_SIZE)
      )

      setShipments(response.shipments)
      setCount(response.count)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadShipments()
  }, [
    filters.q,
    filters.status,
    filters.service_type,
    filters.errors,
    filters.state,
    filters.date_from,
    filters.date_to,
    pageIndex,
  ])

  const pageCount = Math.ceil(count / PAGE_SIZE)

  return (
    <>
      <Container className="divide-y p-0">
        <div className="flex items-center justify-between px-6 py-4">
          <div>
            <Heading>InPost shipments</Heading>
            <Text className="text-ui-fg-subtle" size="small">
              {count} records stored locally
            </Text>
          </div>
          <Button
            size="small"
            variant="secondary"
            isLoading={isLoading}
            onClick={() => void loadShipments()}
          >
            Refresh
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-3 px-6 py-4 md:grid-cols-[1fr_180px_180px_160px]">
          <div className="relative">
            <MagnifyingGlass className="text-ui-fg-muted absolute left-2 top-2.5" />
            <Input
              className="pl-8"
              placeholder="Search order, tracking, shipment, dispatch"
              value={filters.q}
              onChange={(event) =>
                setFilterAndResetPage("q", event.target.value)
              }
            />
          </div>
          <Select
            value={filters.status}
            onValueChange={(value) => setFilterAndResetPage("status", value)}
          >
            <Select.Trigger>
              <Select.Value placeholder="Status" />
            </Select.Trigger>
            <Select.Content>
              <Select.Item value="all">All statuses</Select.Item>
              {INPOST_SHIPMENT_STATUS_OPTIONS.map((status) => (
                <Select.Item key={status} value={status}>
                  {status}
                </Select.Item>
              ))}
            </Select.Content>
          </Select>
          <Select
            value={filters.service_type}
            onValueChange={(value) =>
              setFilterAndResetPage("service_type", value)
            }
          >
            <Select.Trigger>
              <Select.Value placeholder="Service" />
            </Select.Trigger>
            <Select.Content>
              <Select.Item value="all">All services</Select.Item>
              <Select.Item value={InPostService.inpost_locker_standard}>
                Paczkomat
              </Select.Item>
              <Select.Item value={InPostService.inpost_courier_standard}>
                Courier
              </Select.Item>
            </Select.Content>
          </Select>
          <Select
            value={filters.errors}
            onValueChange={(value) => setFilterAndResetPage("errors", value)}
          >
            <Select.Trigger>
              <Select.Value placeholder="Errors" />
            </Select.Trigger>
            <Select.Content>
              <Select.Item value="all">All records</Select.Item>
              <Select.Item value="errors">With errors</Select.Item>
              <Select.Item value="without-errors">Without errors</Select.Item>
            </Select.Content>
          </Select>
        </div>

        <div className="grid grid-cols-1 gap-3 px-6 py-4 md:grid-cols-[180px_180px_180px_auto]">
          <Input
            type="date"
            value={filters.date_from}
            onChange={(event) =>
              setFilterAndResetPage("date_from", event.target.value)
            }
          />
          <Input
            type="date"
            value={filters.date_to}
            onChange={(event) =>
              setFilterAndResetPage("date_to", event.target.value)
            }
          />
          <Select
            value={filters.state}
            onValueChange={(value) => setFilterAndResetPage("state", value)}
          >
            <Select.Trigger>
              <Select.Value placeholder="State" />
            </Select.Trigger>
            <Select.Content>
              <Select.Item value="all">All states</Select.Item>
              <Select.Item value="active">Active</Select.Item>
              <Select.Item value="canceled">Canceled</Select.Item>
            </Select.Content>
          </Select>
          <Button
            size="small"
            variant="transparent"
            onClick={() => resetFilters()}
          >
            <XMark />
            Clear filters
          </Button>
        </div>

        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>Created</Table.HeaderCell>
              <Table.HeaderCell>Order</Table.HeaderCell>
              <Table.HeaderCell>Receiver</Table.HeaderCell>
              <Table.HeaderCell>Service</Table.HeaderCell>
              <Table.HeaderCell>Local status</Table.HeaderCell>
              <Table.HeaderCell>InPost status</Table.HeaderCell>
              <Table.HeaderCell>Tracking</Table.HeaderCell>
              <Table.HeaderCell>Destination</Table.HeaderCell>
              <Table.HeaderCell>Dispatch</Table.HeaderCell>
              <Table.HeaderCell>Synced</Table.HeaderCell>
              <Table.HeaderCell />
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {isLoading ? (
              <Table.Row>
                <td className="h-12 py-0 pl-6 pr-6" colSpan={11}>
                  <Text className="text-ui-fg-subtle">Loading shipments...</Text>
                </td>
              </Table.Row>
            ) : shipments.length ? (
              shipments.map((shipment) => (
                <Table.Row key={shipment.id}>
                  <Table.Cell>{formatDateTime(shipment.created_at)}</Table.Cell>
                  <Table.Cell>
                    {shipment.order_id ? (
                      <Link
                        className="text-ui-fg-interactive hover:text-ui-fg-interactive-hover"
                        to={`/orders/${shipment.order_id}`}
                      >
                        {shipment.order_id}
                      </Link>
                    ) : (
                      "-"
                    )}
                  </Table.Cell>
                  <Table.Cell>{getShipmentReceiver(shipment)}</Table.Cell>
                  <Table.Cell>
                    {getShipmentServiceLabel(shipment.service_type)}
                  </Table.Cell>
                  <Table.Cell>
                    <ShipmentStatusBadge status={shipment.status} />
                  </Table.Cell>
                  <Table.Cell>
                    <ShipmentStatusBadge
                      status={getRemoteShipmentStatus(shipment)}
                    />
                  </Table.Cell>
                  <Table.Cell>{shipment.tracking_number || "-"}</Table.Cell>
                  <Table.Cell>{getShipmentDestination(shipment)}</Table.Cell>
                  <Table.Cell>{shipment.dispatch_order_id || "-"}</Table.Cell>
                  <Table.Cell>
                    {formatDateTime(shipment.last_synced_at)}
                    {shipment.last_error ? (
                      <Text className="text-ui-fg-error" size="xsmall">
                        {shipment.last_error}
                      </Text>
                    ) : null}
                  </Table.Cell>
                  <Table.Cell>
                    <ShipmentActions
                      shipment={shipment}
                      onRefresh={() => void loadShipments()}
                      onViewRaw={setRawShipment}
                    />
                  </Table.Cell>
                </Table.Row>
              ))
            ) : (
              <Table.Row>
                <td className="h-12 py-0 pl-6 pr-6" colSpan={11}>
                  <Text className="text-ui-fg-subtle">
                    No InPost shipments match the current filters.
                  </Text>
                </td>
              </Table.Row>
            )}
          </Table.Body>
        </Table>
        <Table.Pagination
          count={count}
          pageSize={PAGE_SIZE}
          pageIndex={pageIndex}
          pageCount={pageCount}
          canPreviousPage={pageIndex > 0}
          canNextPage={pageIndex + 1 < pageCount}
          previousPage={() => setPageIndex(Math.max(pageIndex - 1, 0))}
          nextPage={() =>
            setPageIndex(pageIndex + 1 < pageCount ? pageIndex + 1 : pageIndex)
          }
        />
      </Container>

      <Drawer open={Boolean(rawShipment)} onOpenChange={() => setRawShipment(null)}>
        <Drawer.Content>
          <Drawer.Header>
            <Drawer.Title>Raw ShipX response</Drawer.Title>
            <Drawer.Description>
              Shipment {rawShipment?.shipment_id || ""}
            </Drawer.Description>
          </Drawer.Header>
          <Drawer.Body>
            <Textarea
              className="min-h-[480px] font-mono"
              readOnly
              value={rawShipment ? stringifyRawResponse(rawShipment) : ""}
            />
          </Drawer.Body>
        </Drawer.Content>
      </Drawer>
    </>
  )
}

export const config = defineRouteConfig({
  label: "InPost",
  icon: TruckFast,
})

export default InPostShipmentsPage
