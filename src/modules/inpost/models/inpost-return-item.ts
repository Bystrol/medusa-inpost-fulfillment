import { model } from "@medusajs/framework/utils"

const InpostReturnItem = model.define("inpost_return_item", {
  id: model.id().primaryKey(),
  inpost_return_id: model.text(),
  order_line_item_id: model.text(),
  quantity: model.number(),
  reason: model.text().nullable(),
})

export default InpostReturnItem
