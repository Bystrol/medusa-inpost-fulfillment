import { ArrowDownTray, MagnifyingGlass, XMark } from "@medusajs/icons"
import {
  Button,
  Container,
  Heading,
  IconButton,
  Select,
  Table,
  Text,
  Tooltip,
  toast,
} from "@medusajs/ui"
import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { DebouncedInput } from "../../../components/debounced-input"
import { InPostTabs } from "../../../components/inpost-tabs"
import { ReturnStatusBadge } from "../../../components/return-status-badge"
import { useUrlQueryState } from "../../../hooks/use-url-query-state"
import {
  downloadInPostReturnLabel,
  listInPostReturns,
} from "../../../lib/inpost-api"
import {
  getReturnMethodLabel,
  getReturnTicketDisplay,
} from "../../../lib/return-format"
import { formatDateTime } from "../../../lib/shipment-format"
import {
  buildInPostReturnListParamsFromUrlQuery,
  getInPostReturnListPageIndex,
  INPOST_RETURN_LIST_URL_QUERY_DEFAULTS,
  InPostAdminReturn,
  InPostReturnListUrlQuery,
} from "../../../../lib/admin-returns"
import {
  INPOST_RETURN_METHODS,
  INPOST_RETURN_STATUSES,
} from "../../../../lib/returns"

const PAGE_SIZE = 20

const InPostReturnsPage = () => {
  const {
    values: filters,
    setValue: setFilter,
    reset: resetFilters,
  } = useUrlQueryState<InPostReturnListUrlQuery>(
    INPOST_RETURN_LIST_URL_QUERY_DEFAULTS
  )
  const [returns, setReturns] = useState<InPostAdminReturn<string>[]>([])
  const [count, setCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const pageIndex = getInPostReturnListPageIndex(filters)

  const setFilterAndResetPage = <TKey extends keyof InPostReturnListUrlQuery>(
    key: TKey,
    value: InPostReturnListUrlQuery[TKey]
  ) => {
    setFilter(key, value, { reset: ["page"] })
  }

  const setPageIndex = (nextPageIndex: number) => {
    setFilter("page", String(nextPageIndex + 1))
  }

  const loadReturns = async () => {
    setIsLoading(true)

    try {
      const response = await listInPostReturns(
        buildInPostReturnListParamsFromUrlQuery(filters, PAGE_SIZE)
      )

      setReturns(response.returns)
      setCount(response.count)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
    } finally {
      setIsLoading(false)
    }
  }

  const handleDownloadLabel = async (returnRequest: InPostAdminReturn) => {
    try {
      await downloadInPostReturnLabel(returnRequest)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
    }
  }

  useEffect(() => {
    void loadReturns()
  }, [
    filters.q,
    filters.order_id,
    filters.customer_email,
    filters.status,
    filters.return_method,
    filters.errors,
    filters.date_from,
    filters.date_to,
    pageIndex,
  ])

  const pageCount = Math.ceil(count / PAGE_SIZE)

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <div>
          <Heading>InPost returns</Heading>
          <Text className="text-ui-fg-subtle" size="small">
            {count} records stored locally
          </Text>
        </div>
        <Button
          size="small"
          variant="secondary"
          isLoading={isLoading}
          onClick={() => void loadReturns()}
        >
          Refresh
        </Button>
      </div>

      <InPostTabs />

      <div className="grid grid-cols-1 gap-3 px-6 py-4 md:grid-cols-[1fr_180px_180px_160px]">
        <div className="relative">
          <MagnifyingGlass className="text-ui-fg-muted absolute left-2 top-2.5" />
          <DebouncedInput
            className="pl-8"
            placeholder="Search order, email, code, tracking"
            value={filters.q}
            onDebouncedChange={(value) => setFilterAndResetPage("q", value)}
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
            {INPOST_RETURN_STATUSES.map((status) => (
              <Select.Item key={status} value={status}>
                {status}
              </Select.Item>
            ))}
          </Select.Content>
        </Select>
        <Select
          value={filters.return_method}
          onValueChange={(value) =>
            setFilterAndResetPage("return_method", value)
          }
        >
          <Select.Trigger>
            <Select.Value placeholder="Method" />
          </Select.Trigger>
          <Select.Content>
            <Select.Item value="all">All methods</Select.Item>
            {INPOST_RETURN_METHODS.map((method) => (
              <Select.Item key={method} value={method}>
                {getReturnMethodLabel(method)}
              </Select.Item>
            ))}
          </Select.Content>
        </Select>
        <Select
          value={filters.errors}
          onValueChange={(value) =>
            setFilterAndResetPage(
              "errors",
              value as InPostReturnListUrlQuery["errors"]
            )
          }
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

      <div className="grid grid-cols-1 gap-3 px-6 py-4 md:grid-cols-[1fr_1fr_180px_180px_auto]">
        <DebouncedInput
          placeholder="Order ID"
          value={filters.order_id}
          onDebouncedChange={(value) =>
            setFilterAndResetPage("order_id", value)
          }
        />
        <DebouncedInput
          placeholder="Customer email"
          value={filters.customer_email}
          onDebouncedChange={(value) =>
            setFilterAndResetPage("customer_email", value)
          }
        />
        <DebouncedInput
          type="date"
          value={filters.date_from}
          onDebouncedChange={(value) =>
            setFilterAndResetPage("date_from", value)
          }
        />
        <DebouncedInput
          type="date"
          value={filters.date_to}
          onDebouncedChange={(value) =>
            setFilterAndResetPage("date_to", value)
          }
        />
        <Button size="small" variant="transparent" onClick={() => resetFilters()}>
          <XMark />
          Clear filters
        </Button>
      </div>

      <Table>
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell>Created</Table.HeaderCell>
            <Table.HeaderCell>Order</Table.HeaderCell>
            <Table.HeaderCell>Customer</Table.HeaderCell>
            <Table.HeaderCell>Status</Table.HeaderCell>
            <Table.HeaderCell>Method</Table.HeaderCell>
            <Table.HeaderCell>Code / tracking</Table.HeaderCell>
            <Table.HeaderCell>Items</Table.HeaderCell>
            <Table.HeaderCell>Expires</Table.HeaderCell>
            <Table.HeaderCell>Synced</Table.HeaderCell>
            <Table.HeaderCell />
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {isLoading ? (
            <Table.Row>
              <td className="h-12 py-0 pl-6 pr-6" colSpan={10}>
                <Text className="text-ui-fg-subtle">Loading returns...</Text>
              </td>
            </Table.Row>
          ) : returns.length ? (
            returns.map((returnRequest) => (
              <Table.Row key={returnRequest.id}>
                <Table.Cell>{formatDateTime(returnRequest.created_at)}</Table.Cell>
                <Table.Cell>
                  <Link
                    className="text-ui-fg-interactive hover:text-ui-fg-interactive-hover"
                    to={`/orders/${returnRequest.order_id}`}
                  >
                    {returnRequest.order_id}
                  </Link>
                </Table.Cell>
                <Table.Cell>{returnRequest.customer_email}</Table.Cell>
                <Table.Cell>
                  <ReturnStatusBadge status={returnRequest.status} />
                  {returnRequest.last_error ? (
                    <Text className="text-ui-fg-error mt-1" size="xsmall">
                      {returnRequest.last_error}
                    </Text>
                  ) : null}
                </Table.Cell>
                <Table.Cell>
                  {getReturnMethodLabel(returnRequest.return_method)}
                </Table.Cell>
                <Table.Cell>{getReturnTicketDisplay(returnRequest)}</Table.Cell>
                <Table.Cell>{returnRequest.items_count}</Table.Cell>
                <Table.Cell>
                  {formatDateTime(returnRequest.return_expires_at)}
                </Table.Cell>
                <Table.Cell>
                  {formatDateTime(returnRequest.last_synced_at)}
                </Table.Cell>
                <Table.Cell>
                  <Tooltip
                    content={
                      returnRequest.label_url
                        ? "Download return label"
                        : "This return uses a return code instead of a label"
                    }
                  >
                    <IconButton
                      size="small"
                      variant="transparent"
                      disabled={!returnRequest.label_url}
                      onClick={() => void handleDownloadLabel(returnRequest)}
                    >
                      <ArrowDownTray />
                    </IconButton>
                  </Tooltip>
                </Table.Cell>
              </Table.Row>
            ))
          ) : (
            <Table.Row>
              <td className="h-12 py-0 pl-6 pr-6" colSpan={10}>
                <Text className="text-ui-fg-subtle">
                  No InPost returns match the current filters.
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
  )
}

export default InPostReturnsPage
