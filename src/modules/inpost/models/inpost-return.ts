import { model } from "@medusajs/framework/utils"

const InpostReturn = model.define("inpost_return", {
  id: model.id().primaryKey(),
  order_id: model.text(),
  return_id: model.text().nullable(),
  customer_email: model.text(),
  status: model.text().default("requested"),
  return_method: model.text(),
  inpost_shipment_id: model.text().nullable(),
  tracking_number: model.text().nullable(),
  token_hash: model.text().nullable(),
  token_expires_at: model.dateTime().nullable(),
  last_synced_at: model.dateTime().nullable(),
  last_error: model.text().nullable(),
  raw_response: model.json().nullable(),
})

export default InpostReturn
