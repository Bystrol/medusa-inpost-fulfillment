import {
  InPostAdminReturn,
  InPostAdminReturnResponse,
  InPostReturnListParams,
  ListInPostAdminReturnsResponse,
} from "../../lib/admin-returns"
import {
  InPostAdminShipment,
  InPostAdminShipmentResponse,
  InPostShipmentListParams,
  ListInPostAdminShipmentsResponse,
} from "../../lib/admin-shipments"
import { InPostLabelFormat } from "../../lib/types"

async function parseError(response: Response): Promise<string> {
  const contentType = response.headers.get("content-type") || ""

  if (contentType.includes("application/json")) {
    const body = (await response.json()) as { message?: string; error?: string }
    return body.message || body.error || response.statusText
  }

  return response.text()
}

async function adminFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    credentials: "include",
    ...init,
    headers: {
      ...init?.headers,
    },
  })

  if (!response.ok) {
    throw new Error(await parseError(response))
  }

  return response.json() as Promise<T>
}

export function getTrackingUrl(trackingNumber: string): string {
  return `https://inpost.pl/sledzenie-przesylek?number=${encodeURIComponent(
    trackingNumber
  )}`
}

export async function listInPostShipments(
  params: InPostShipmentListParams = {}
): Promise<ListInPostAdminShipmentsResponse> {
  const searchParams = new URLSearchParams()

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      searchParams.set(key, String(value))
    }
  })

  const query = searchParams.toString()
  return adminFetch<ListInPostAdminShipmentsResponse>(
    `/admin/inpost/shipments${query ? `?${query}` : ""}`
  )
}

export async function listInPostReturns(
  params: InPostReturnListParams = {}
): Promise<ListInPostAdminReturnsResponse<string>> {
  const searchParams = new URLSearchParams()

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      searchParams.set(key, String(value))
    }
  })

  const query = searchParams.toString()
  return adminFetch<ListInPostAdminReturnsResponse<string>>(
    `/admin/inpost/returns${query ? `?${query}` : ""}`
  )
}

export async function getInPostReturn(
  id: string
): Promise<InPostAdminReturnResponse<string>> {
  return adminFetch<InPostAdminReturnResponse<string>>(
    `/admin/inpost/returns/${id}`
  )
}

export async function refreshInPostShipmentData(
  id: string
): Promise<InPostAdminShipment> {
  const response = await adminFetch<InPostAdminShipmentResponse>(
    `/admin/inpost/shipments/${id}/refresh`,
    {
      method: "POST",
    }
  )

  return response.shipment
}

export async function cancelInPostShipment(
  id: string
): Promise<InPostAdminShipment> {
  const response = await adminFetch<InPostAdminShipmentResponse>(
    `/admin/inpost/shipments/${id}`,
    {
      method: "DELETE",
    }
  )

  return response.shipment
}

export async function downloadInPostReturnLabel(
  returnRequest: InPostAdminReturn
): Promise<void> {
  const response = await fetch(
    `/admin/inpost/returns/${returnRequest.id}/documents`,
    {
      credentials: "include",
    }
  )

  if (!response.ok) {
    throw new Error(await parseError(response))
  }

  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = `inpost-return-label-${
    returnRequest.return_id || returnRequest.id
  }.pdf`
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

export async function downloadInPostLabel(
  shipment: InPostAdminShipment,
  format: InPostLabelFormat
): Promise<void> {
  const response = await fetch(
    `/admin/inpost/shipments/${shipment.id}/label?format=${format}`,
    {
      credentials: "include",
    }
  )

  if (!response.ok) {
    throw new Error(await parseError(response))
  }

  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = `inpost-label-${shipment.shipment_id}.${format}`
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}
