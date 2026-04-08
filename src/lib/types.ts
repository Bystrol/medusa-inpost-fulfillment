export interface InPostPluginOptions {
  apiToken: string
  organizationId: string
  sandbox?: boolean
  defaultParcelTemplate?: "small" | "medium" | "large"
  sender?: InPostPerson
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

