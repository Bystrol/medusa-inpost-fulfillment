import { ModuleProvider, Modules } from "@medusajs/framework/utils"
import InPostFulfillmentProviderService from "./service"

export default ModuleProvider(Modules.FULFILLMENT, {
  services: [InPostFulfillmentProviderService],
})
