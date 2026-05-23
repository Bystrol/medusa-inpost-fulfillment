import { MedusaContainer } from "@medusajs/framework/types"
import { INPOST_MODULE } from "../modules/inpost"
import InPostModuleService from "../modules/inpost/service"
import { refreshInPostReturnDataWorkflow } from "../workflows/refresh-inpost-return"

export default async function syncInPostReturnsJob(container: MedusaContainer) {
  const logger = container.resolve("logger")
  const inpostService = container.resolve<InPostModuleService>(INPOST_MODULE)

  try {
    const returns = await inpostService.listActiveReturns(50)

    for (const returnRecord of returns) {
      try {
        await refreshInPostReturnDataWorkflow(container).run({
          input: {
            id: returnRecord.id,
          },
        })
      } catch (error) {
        logger.warn(
          `InPost return sync failed for ${returnRecord.return_id}: ${
            error instanceof Error ? error.message : String(error)
          }`
        )
      }
    }
  } catch (error) {
    logger.error(
      `InPost return sync job failed: ${
        error instanceof Error ? error.message : String(error)
      }`
    )
  }
}

export const config = {
  name: "sync-inpost-returns",
  schedule: "*/30 * * * *",
}
