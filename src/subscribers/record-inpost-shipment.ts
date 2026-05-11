import { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { recordInPostShipmentFromFulfillmentWorkflow } from "../workflows/record-inpost-shipment-from-fulfillment"

type OrderFulfillmentCreatedEvent = {
  order_id: string
  fulfillment_id: string
}

export default async function recordInPostShipmentHandler({
  event: { data },
  container,
}: SubscriberArgs<OrderFulfillmentCreatedEvent>) {
  const logger = container.resolve("logger")

  try {
    await recordInPostShipmentFromFulfillmentWorkflow(container).run({
      input: {
        order_id: data.order_id,
        fulfillment_id: data.fulfillment_id,
      },
    })
  } catch (error) {
    logger.error(
      `InPost shipment record save failed for fulfillment ${
        data.fulfillment_id
      }: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

export const config: SubscriberConfig = {
  event: "order.fulfillment_created",
}
