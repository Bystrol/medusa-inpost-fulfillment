export interface InPostPluginOptions {
  apiToken: string
  organizationId: string
  sandbox?: boolean
  defaultParcelTemplate?: "small" | "medium" | "large"
  defaultLabelFormat?: InPostLabelFormat
  returnTokenTtlMinutes?: number
  returns?: InPostReturnsOptions
  sender?: InPostPerson
}

export type InPostLabelFormat = "pdf" | "zpl"

export type InPostReturnParcelSize = "A" | "B" | "C"

export interface InPostReturnsAddress {
  buildingNumber: string
  street: string
  city: string
  postalCode: string
  province?: string
  countryCode?: string
}

export interface InPostReturnsReceiver {
  companyName?: string
  firstName?: string
  lastName?: string
  phone: string
  email?: string
  address?: InPostReturnsAddress
}

export interface InPostReturnsOptions {
  clientId?: string
  clientSecret?: string
  defaultParcelSize?: InPostReturnParcelSize
  receiver?: InPostReturnsReceiver
  description?: string
}

export interface InPostAddress {
  street: string
  building_number: string
  city: string
  post_code: string
  country_code: string
}

export interface InPostPerson {
  company_name?: string
  first_name?: string
  last_name?: string
  email: string
  phone: string
  address?: InPostAddress
}

export type InPostParcelTemplate = "small" | "medium" | "large"

export interface InPostParcelDimensions {
  length: number
  width: number
  height: number
  unit?: "mm" | "cm" | "in"
}

export interface InPostParcelWeight {
  amount: number
  unit?: "kg" | "lbs" | "g"
}

export interface InPostParcel {
  template?: InPostParcelTemplate
  dimensions?: InPostParcelDimensions
  weight?: InPostParcelWeight
}

export enum InPostService {
  inpost_locker_standard = "inpost_locker_standard",
  inpost_courier_standard = "inpost_courier_standard",
}

export type InPostServiceType = InPostService | (string & {})

export interface InPostShipmentRequest {
  receiver: InPostPerson
  sender?: InPostPerson
  parcels: InPostParcel[]
  service: InPostService
  reference?: string
  custom_attributes?: {
    target_point?: string
    sending_method?: string
    [key: string]: unknown
  }
}

export interface InPostOffer {
  id: number
  status: string
  rate?: number
  currency?: string
  expires_at?: string
}

export interface InPostShipmentResponse {
  id: number
  status: string
  tracking_number: string
  href: string
  parcels: InPostParcel[]
  receiver?: InPostPerson
  sender?: InPostPerson
  service?: string
  reference?: string
  offers?: InPostOffer[]
  selected_offer?: InPostOffer
  created_at?: string
  updated_at?: string
}

export interface InPostDispatchOrderResponse {
  id: number
  status: string
}
