# Plan: `medusa-fulfillment-inpost` Plugin

## Context

We're building a publishable npm package that integrates InPost (Polish parcel locker/courier service) with MedusaJS v2 as a fulfillment module provider. InPost provides the ShipX API for creating shipments to Paczkomat lockers and via courier. This plugin follows the same pattern as the ShipStation integration example but is structured as an external plugin (not embedded in a Medusa app).

## Project Structure

```
medusa-fulfillment-inpost/
├── .gitignore
├── package.json
├── tsconfig.json
├── src/
│   ├── providers/
│   │   └── inpost/
│   │       ├── index.ts              # ModuleProvider(Modules.FULFILLMENT, { services: [...] })
│   │       └── service.ts            # InPostFulfillmentProviderService extends AbstractFulfillmentProviderService
│   └── lib/
│       ├── client.ts                 # InPostShipXClient - HTTP wrapper around ShipX API
│       ├── auth.ts                   # OAuth2 client_credentials token manager
│       └── types.ts                  # InPost API types + plugin option types
```

## Step-by-step Implementation

### Step 1: Initialize project

Create `package.json`:
```json
{
  "name": "medusa-fulfillment-inpost",
  "version": "0.1.0",
  "description": "InPost fulfillment provider for MedusaJS v2 - Paczkomat locker and courier integration via ShipX API",
  "license": "MIT",
  "keywords": ["medusa-plugin-integration", "medusa-v2", "medusa-plugin-shipping", "inpost", "paczkomat", "shipx"],
  "exports": {
    "./package.json": "./package.json",
    "./providers/*": "./.medusa/server/src/providers/*/index.js",
    "./*": "./.medusa/server/src/*.js"
  },
  "files": [".medusa", "!.medusa/server/src/**/__tests__/**", "!.medusa/server/src/**/__mocks__/**"],
  "scripts": {
    "build": "medusa plugin:build",
    "dev": "medusa plugin:develop",
    "publish:local": "medusa plugin:publish"
  },
  "devDependencies": {
    "@medusajs/cli": "^2.5.0",
    "@medusajs/framework": "^2.5.0",
    "@medusajs/medusa": "^2.5.0",
    "@swc/core": "1.5.7"
  },
  "peerDependencies": {
    "@medusajs/framework": "^2.5.0"
  },
  "engines": { "node": ">=20" }
}
```

Create `tsconfig.json`, `.gitignore`.

Run `npm install`.

### Step 2: Create `src/lib/types.ts` — All InPost API and plugin types

- `InPostPluginOptions` — `clientId`, `clientSecret`, `organizationId`, `sandbox` (bool, default false), `defaultParcelTemplate` (default `"small"`)
- `InPostAddress` — `street`, `building_number`, `city`, `post_code`, `country_code`
- `InPostPerson` — `company_name?`, `first_name?`, `last_name?`, `email`, `phone`, `address?`
- `InPostParcel` — `template` (`"small"` | `"medium"` | `"large"`), `dimensions?`, `weight?`
- `InPostShipmentRequest` — `receiver`, `sender?`, `parcels[]`, `service`, `reference?`, `custom_attributes?` (includes `target_point`, `sending_method`)
- `InPostShipmentResponse` — `id`, `status`, `tracking_number`, `href`, `parcels`, etc.
- `InPostService` enum: `inpost_locker_standard`, `inpost_courier_standard`
- Template-to-size mapping: `small` → `"A"`, `medium` → `"B"`, `large` → `"C"`

### Step 3: Create `src/lib/auth.ts` — OAuth2 Token Manager

Class `InPostAuthManager`:
- Constructor takes `clientId`, `clientSecret`, `baseUrl`
- `getToken(): Promise<string>` — returns cached token or refreshes
- Token endpoint: `POST {baseUrl}/v1/token` with form-urlencoded body `grant_type=client_credentials`
- Caches token in memory, refreshes 60s before expiry
- Uses promise-based lock to prevent concurrent refresh requests
- Uses native `fetch` (Node 20+)

### Step 4: Create `src/lib/client.ts` — InPost ShipX API Client

Class `InPostShipXClient`:
- Constructor: takes `InPostPluginOptions`, creates `InPostAuthManager`, selects base URL
  - Sandbox: `https://sandbox-api-shipx-pl.easypack24.net`
  - Production: `https://api-shipx-pl.easypack24.net`
- Private `request<T>(method, path, body?)` — injects Bearer token, handles JSON, maps errors
- Public methods:
  - `createShipment(data: InPostShipmentRequest): Promise<InPostShipmentResponse>` — `POST /v1/organizations/{org}/shipments`
  - `getShipment(id: number): Promise<InPostShipmentResponse>` — `GET /v1/organizations/{org}/shipments/{id}`
  - `cancelShipment(id: number): Promise<void>` — `DELETE /v1/organizations/{org}/shipments/{id}`
  - `getLabel(id: number, format?: "pdf" | "zpl"): Promise<Buffer>` — `GET /v1/organizations/{org}/shipments/{id}/label`
  - `getPoints(query?): Promise<InPostPointResponse[]>` — `GET /v1/points`
- Error handling: throw `MedusaError` with appropriate types for API failures

### Step 5: Create `src/providers/inpost/service.ts` — Fulfillment Provider Service

Class `InPostFulfillmentProviderService extends AbstractFulfillmentProviderService`:

```
static identifier = "inpost"
```

**Constructor:**
- Accepts `{ logger }` and `options: InPostPluginOptions`
- Validates required options (`clientId`, `clientSecret`, `organizationId`)
- Instantiates `InPostShipXClient`

**Method implementations:**

| Method | Behavior |
|--------|----------|
| `getFulfillmentOptions()` | Returns 4 options: locker standard, locker return, courier standard, courier return. Each has `id`, `name`, `is_return`. |
| `validateOption(data)` | Returns `true` if `data.id` is a recognized InPost service type |
| `validateFulfillmentData(optionData, data, context)` | For locker services: validates `data.target_point` is present (the Paczkomat machine ID sent from storefront). Returns enriched data with `service_type` and `target_point`. |
| `canCalculate(data)` | Returns `false` — InPost pricing is contract-based, not API-queryable |
| `calculatePrice(...)` | Throws error (unreachable since `canCalculate` returns false). Merchants set flat-rate prices on shipping options. |
| `createFulfillment(data, items, order, fulfillment)` | Maps Medusa order data → InPost shipment request. Builds receiver from `order.shipping_address`, maps parcel template (`small`→`A`, etc.), calls `client.createShipment()`. Returns `{ data: { shipment_id, tracking_number, status } }`. Labels returned empty (InPost generates them async). |
| `cancelFulfillment(data)` | Calls `client.cancelShipment(data.shipment_id)` |
| `createReturnFulfillment(fulfillment)` | Creates a return shipment via `client.createShipment()` with return service type |
| `getFulfillmentDocuments(data)` | Fetches label via `client.getLabel(data.shipment_id)`, returns as base64 PDF |
| `getReturnDocuments(data)` | Same pattern for `data.return_shipment_id` |
| `getShipmentDocuments(data)` | Delegates to `getFulfillmentDocuments` |
| `retrieveDocuments(data, type)` | Routes to appropriate getter based on document type |

### Step 6: Create `src/providers/inpost/index.ts` — Module Provider Definition

```typescript
import { ModuleProvider, Modules } from "@medusajs/framework/utils"
import InPostFulfillmentProviderService from "./service"

export default ModuleProvider(Modules.FULFILLMENT, {
  services: [InPostFulfillmentProviderService],
})
```

### Step 7: Build and verify

Run `npx medusa plugin:build` to compile and verify no type errors.

## Consumer Usage

In the consumer's `medusa-config.ts`:

```typescript
module.exports = defineConfig({
  // ...
  modules: [
    {
      resolve: "@medusajs/medusa/fulfillment",
      options: {
        providers: [
          {
            resolve: "@medusajs/medusa/fulfillment-manual",
            id: "manual",
          },
          {
            resolve: "medusa-fulfillment-inpost/providers/inpost",
            id: "inpost",
            options: {
              clientId: process.env.INPOST_CLIENT_ID,
              clientSecret: process.env.INPOST_CLIENT_SECRET,
              organizationId: process.env.INPOST_ORGANIZATION_ID,
              sandbox: process.env.INPOST_SANDBOX === "true",
              defaultParcelTemplate: "small", // "small" (A), "medium" (B), "large" (C)
            },
          },
        ],
      },
    },
  ],
})
```

**Storefront requirement:** For locker delivery, the storefront must pass `target_point` (Paczkomat machine ID) in the shipping method data. InPost provides a GeoWidget JS widget for locker selection.

## Key Design Decisions

1. **No dynamic pricing** — InPost pricing is contract-based per organization, not queryable via API. Merchants set flat-rate prices in Medusa admin.
2. **Labels fetched separately** — InPost generates labels async after shipment confirmation. `createFulfillment` returns empty labels; merchant retrieves via `getFulfillmentDocuments`.
3. **Native `fetch`** — No axios dependency. Node 20+ (required by Medusa) guarantees global `fetch`.
4. **OAuth2 token caching** — Token cached in memory with promise-based lock to prevent thundering herd on concurrent refresh.
5. **Separation of concerns** — `InPostShipXClient` (lib/) has no Medusa dependencies; the provider service (providers/inpost/) adapts it to Medusa's interface.

## InPost ShipX API Reference

- **Auth:** OAuth2 client_credentials → `POST /v1/token`
- **Shipments:** `POST/GET/DELETE /v1/organizations/{org}/shipments/{id}`
- **Labels:** `GET /v1/organizations/{org}/shipments/{id}/label`
- **Points:** `GET /v1/points`
- **Services:** `inpost_locker_standard`, `inpost_courier_standard`
- **Parcel sizes:** A (8×38×64cm, 25kg), B (19×38×64cm, 25kg), C (41×38×64cm, 25kg)
- **Sandbox:** `https://sandbox-api-shipx-pl.easypack24.net`
- **Production:** `https://api-shipx-pl.easypack24.net`

## Verification

1. Run `npx medusa plugin:build` — must compile without errors
2. Manual testing: install in a Medusa app via `npx medusa plugin:publish` + `npx medusa plugin:add`, configure in medusa-config.ts, create shipping option in admin, place test order against InPost sandbox
