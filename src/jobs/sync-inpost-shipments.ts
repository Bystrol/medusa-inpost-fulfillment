import { MedusaContainer } from "@medusajs/framework/types"
import { INPOST_MODULE } from "../modules/inpost"
import InPostModuleService from "../modules/inpost/service"
import { refreshInPostShipmentDataWorkflow } from "../workflows/refresh-inpost-shipment"

export default async function syncInPostShipmentsJob(
  container: MedusaContainer
) {
  const logger = container.resolve("logger")
  const inpostService = container.resolve<InPostModuleService>(INPOST_MODULE)

  try {
    const shipments = await inpostService.listActiveShipments(50)

    for (const shipment of shipments) {
      try {
        await refreshInPostShipmentDataWorkflow(container).run({
          input: {
            id: shipment.id,
          },
        })
      } catch (error) {
        logger.warn(
          `InPost shipment sync failed for ${shipment.shipment_id}: ${
            error instanceof Error ? error.message : String(error)
          }`
        )
      }
    }
  } catch (error) {
    logger.error(
      `InPost shipment sync job failed: ${
        error instanceof Error ? error.message : String(error)
      }`
    )
  }
}

export const config = {
  name: "sync-inpost-shipments",
  schedule: "*/15 * * * *",
}
