import { MedusaError } from "@medusajs/framework/utils"
import {
  InPostLabelFormat,
  InPostParcel,
  InPostParcelTemplate,
  InPostPerson,
  InPostPluginOptions,
  InPostService,
  InPostShipmentRequest,
} from "./types"

export type InPostParcelDimensionsInput = {
  length: number
  width: number
  height: number
  weight: number
}

export type InPostShippingAddressInput = {
  first_name?: string | null
  last_name?: string | null
  address_1?: string | null
  address_2?: string | null
  city?: string | null
  postal_code?: string | null
  country_code?: string | null
  phone?: string | null
}

export type BuildShipmentRequestInput = {
  data: InPostFulfillmentData
  options: InPostPluginOptions
  shippingAddress: InPostShippingAddressInput
  email: string
  reference?: string
}

export type InPostFulfillmentData = {
  service_type?: InPostService
  target_point?: string
  parcel_template?: InPostParcelTemplate
  label_format?: InPostLabelFormat
  parcel_dimensions?: Partial<InPostParcelDimensionsInput>
  email?: string
}

const PARCEL_TEMPLATES = new Set<InPostParcelTemplate>([
  "small",
  "medium",
  "large",
])

const LABEL_FORMATS = new Set<InPostLabelFormat>(["pdf", "zpl"])

const INPOST_DIMENSION_UNIT = "mm"
const INPOST_WEIGHT_UNIT = "kg"

export const INPOST_TRACKING_URL_BASE =
  "https://inpost.pl/sledzenie-przesylek"

export function normalizePolishPostalCode(postCode: string): string {
  const normalized = postCode.trim()

  if (/^\d{5}$/.test(normalized)) {
    return `${normalized.slice(0, 2)}-${normalized.slice(2)}`
  }

  return normalized
}

export function resolveLabelFormat(
  options: InPostPluginOptions,
  data: Pick<InPostFulfillmentData, "label_format"> = {}
): InPostLabelFormat {
  const format = data.label_format || options.defaultLabelFormat || "pdf"

  if (!LABEL_FORMATS.has(format)) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "InPost fulfillment: `label_format` must be either `pdf` or `zpl`"
    )
  }

  return format
}

export function buildTrackingUrl(trackingNumber?: string): string {
  if (!trackingNumber) {
    return ""
  }

  return `${INPOST_TRACKING_URL_BASE}?number=${encodeURIComponent(
    trackingNumber
  )}`
}

function assertNotEmpty(value: unknown, message: string): asserts value is string {
  if (typeof value !== "string" || !value.trim()) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, message)
  }
}

function assertPostalCode(postCode: string, fieldName: string): void {
  if (!/^\d{2}-\d{3}$/.test(postCode)) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `InPost fulfillment: ${fieldName} must use XX-XXX postal code format`
    )
  }
}

function assertPositiveNumber(
  value: unknown,
  message: string
): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, message)
  }
}

export function validateSenderForCourier(sender?: InPostPerson): InPostPerson {
  if (!sender) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "InPost fulfillment: `sender` is required in plugin options for courier shipments"
    )
  }

  assertNotEmpty(
    sender.company_name,
    "InPost fulfillment: `sender.company_name` is required for courier shipments"
  )
  assertNotEmpty(
    sender.first_name,
    "InPost fulfillment: `sender.first_name` is required for courier shipments"
  )
  assertNotEmpty(
    sender.last_name,
    "InPost fulfillment: `sender.last_name` is required for courier shipments"
  )
  assertNotEmpty(
    sender.email,
    "InPost fulfillment: `sender.email` is required for courier shipments"
  )
  assertNotEmpty(
    sender.phone,
    "InPost fulfillment: `sender.phone` is required for courier shipments"
  )

  if (!sender.address) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "InPost fulfillment: `sender.address` is required for courier shipments"
    )
  }

  assertNotEmpty(
    sender.address.street,
    "InPost fulfillment: `sender.address.street` is required for courier shipments"
  )
  assertNotEmpty(
    sender.address.building_number,
    "InPost fulfillment: `sender.address.building_number` is required for courier shipments"
  )
  assertNotEmpty(
    sender.address.city,
    "InPost fulfillment: `sender.address.city` is required for courier shipments"
  )
  assertNotEmpty(
    sender.address.post_code,
    "InPost fulfillment: `sender.address.post_code` is required for courier shipments"
  )
  assertNotEmpty(
    sender.address.country_code,
    "InPost fulfillment: `sender.address.country_code` is required for courier shipments"
  )

  const postCode = normalizePolishPostalCode(sender.address.post_code)
  assertPostalCode(postCode, "`sender.address.post_code`")

  return {
    ...sender,
    address: {
      ...sender.address,
      post_code: postCode,
      country_code: sender.address.country_code.toUpperCase(),
    },
  }
}

export function buildReceiver(
  shippingAddress: InPostShippingAddressInput,
  email: string
): InPostPerson {
  assertNotEmpty(
    shippingAddress.first_name,
    "InPost fulfillment: receiver first name is required"
  )
  assertNotEmpty(
    shippingAddress.last_name,
    "InPost fulfillment: receiver last name is required"
  )
  assertNotEmpty(
    email,
    "InPost fulfillment: receiver email is required. Ensure the order has an email address."
  )
  assertNotEmpty(
    shippingAddress.phone,
    "InPost fulfillment: receiver phone is required. Ensure the shipping address has a phone number."
  )
  assertNotEmpty(
    shippingAddress.address_1,
    "InPost fulfillment: receiver street address is required"
  )
  assertNotEmpty(
    shippingAddress.address_2,
    "InPost fulfillment: receiver building number is required. Put the building number in shipping address_2."
  )
  assertNotEmpty(
    shippingAddress.city,
    "InPost fulfillment: receiver city is required"
  )
  assertNotEmpty(
    shippingAddress.postal_code,
    "InPost fulfillment: receiver postal code is required"
  )
  assertNotEmpty(
    shippingAddress.country_code,
    "InPost fulfillment: receiver country code is required"
  )

  const postCode = normalizePolishPostalCode(shippingAddress.postal_code)
  assertPostalCode(postCode, "receiver postal code")

  return {
    first_name: shippingAddress.first_name,
    last_name: shippingAddress.last_name,
    email,
    phone: shippingAddress.phone,
    address: {
      street: shippingAddress.address_1,
      building_number: shippingAddress.address_2,
      city: shippingAddress.city,
      post_code: postCode,
      country_code: shippingAddress.country_code.toUpperCase(),
    },
  }
}

export function buildParcel(
  serviceType: InPostService,
  data: Pick<InPostFulfillmentData, "parcel_dimensions" | "parcel_template">,
  options: InPostPluginOptions
): InPostParcel {
  if (serviceType === InPostService.inpost_locker_standard) {
    const template =
      data.parcel_template ||
      options.defaultParcelTemplate ||
      "small"

    if (!PARCEL_TEMPLATES.has(template)) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "InPost fulfillment: `parcel_template` must be `small`, `medium`, or `large`"
      )
    }

    return { template }
  }

  const dims = data.parcel_dimensions

  if (!dims) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "InPost courier delivery requires `parcel_dimensions` in fulfillment data"
    )
  }

  assertPositiveNumber(
    dims.length,
    "InPost courier delivery requires `parcel_dimensions.length`"
  )
  assertPositiveNumber(
    dims.width,
    "InPost courier delivery requires `parcel_dimensions.width`"
  )
  assertPositiveNumber(
    dims.height,
    "InPost courier delivery requires `parcel_dimensions.height`"
  )
  assertPositiveNumber(
    dims.weight,
    "InPost courier delivery requires `parcel_dimensions.weight`"
  )

  return {
    dimensions: {
      length: dims.length,
      width: dims.width,
      height: dims.height,
      unit: INPOST_DIMENSION_UNIT,
    },
    weight: {
      amount: dims.weight,
      unit: INPOST_WEIGHT_UNIT,
    },
  }
}

export function buildShipmentRequest({
  data,
  options,
  shippingAddress,
  email,
  reference,
}: BuildShipmentRequestInput): InPostShipmentRequest {
  const serviceType = data.service_type

  if (!serviceType || !Object.values(InPostService).includes(serviceType)) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "InPost fulfillment: unsupported service type"
    )
  }

  const isLockerService = serviceType === InPostService.inpost_locker_standard
  let sender: InPostPerson | undefined

  if (isLockerService) {
    assertNotEmpty(
      data.target_point,
      "InPost locker delivery requires `target_point` (Paczkomat machine ID) in fulfillment data"
    )
  } else {
    sender = validateSenderForCourier(options.sender)
  }

  const receiver = buildReceiver(shippingAddress, email)
  const parcel = buildParcel(serviceType, data, options)

  const customAttributes: InPostShipmentRequest["custom_attributes"] =
    isLockerService
      ? {
          target_point: data.target_point,
          sending_method: "parcel_locker",
        }
      : {
          sending_method: "dispatch_order",
        }

  return {
    receiver,
    ...(isLockerService
      ? options.sender && { sender: options.sender }
      : sender && { sender }),
    parcels: [parcel],
    service: serviceType,
    reference,
    custom_attributes: customAttributes,
  }
}
