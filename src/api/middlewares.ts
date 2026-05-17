import { defineMiddlewares } from "@medusajs/framework/http"
import { storeInPostReturnMiddlewares } from "./store/inpost/returns/middlewares"

export default defineMiddlewares({
  routes: [...storeInPostReturnMiddlewares],
})
