import { model } from "@medusajs/framework/utils"

const InpostShipment = model.define("inpost_shipment", {
  id: model.id().primaryKey(),
  order_id: model.text().nullable(),
  fulfillment_id: model.text().nullable(),
  shipment_id: model.text().unique(),
  tracking_number: model.text().nullable(),
  service_type: model.text().nullable(),
  status: model.text(),
  label_format: model.enum(["pdf", "zpl"]).default("pdf"),
  dispatch_order_id: model.text().nullable(),
  last_synced_at: model.dateTime().nullable(),
  last_error: model.text().nullable(),
  raw_response: model.json().nullable(),
})

export default InpostShipment
