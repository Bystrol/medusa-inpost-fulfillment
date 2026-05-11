import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { Modules } from "@medusajs/framework/utils"
import { FulfillmentDTO, IFulfillmentModuleService } from "@medusajs/types"
import { buildInPostShipmentRecord } from "../../lib/shipments"
import { INPOST_MODULE } from "../../modules/inpost"
import InPostModuleService from "../../modules/inpost/service"

export type RecordInPostShipmentFromFulfillmentStepInput = {
  order_id: string
  fulfillment_id: string
}

type InPostFulfillmentShipmentData = {
  shipment_id?: number | string
  tracking_number?: string
  service_type?: string
  status?: string
  label_format?: "pdf" | "zpl"
  dispatch_order_id?: number | string
}

function toShipmentData(
  fulfillment: FulfillmentDTO
): InPostFulfillmentShipmentData {
  return (fulfillment.data || {}) as InPostFulfillmentShipmentData
}

export const recordInPostShipmentFromFulfillmentStep = createStep(
  "record-inpost-shipment-from-fulfillment",
  async (input: RecordInPostShipmentFromFulfillmentStepInput, { container }) => {
    const fulfillmentService =
      container.resolve<IFulfillmentModuleService>(Modules.FULFILLMENT)
    const inpostService = container.resolve<InPostModuleService>(INPOST_MODULE)

    const fulfillment = await fulfillmentService.retrieveFulfillment(
      input.fulfillment_id,
      {
        select: ["id", "data"],
      }
    )
    const shipmentData = toShipmentData(fulfillment)

    if (!shipmentData.shipment_id) {
      return new StepResponse(null)
    }

    const shipment = await inpostService.upsertShipmentFromFulfillment(
      buildInPostShipmentRecord({
        order_id: input.order_id,
        fulfillment_id: input.fulfillment_id,
        shipment_id: shipmentData.shipment_id,
        tracking_number: shipmentData.tracking_number,
        service_type: shipmentData.service_type,
        status: shipmentData.status,
        label_format: shipmentData.label_format,
        dispatch_order_id: shipmentData.dispatch_order_id,
        raw_response: shipmentData as Record<string, unknown>,
      })
    )

    return new StepResponse(shipment)
  }
)
