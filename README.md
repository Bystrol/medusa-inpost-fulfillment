# medusa-inpost-fulfillment

InPost fulfillment provider plugin for [MedusaJS v2](https://medusajs.com/). Integrates with the [InPost ShipX API](https://dokumentacja-inpost.atlassian.net/wiki/spaces/PL/pages/622754/API+ShipX) to support Paczkomat locker and courier delivery.

> ## 🧪 Beta testers wanted
>
> This plugin has been tested thoroughly against the **InPost sandbox**, but not yet end-to-end against a **production** InPost account. If you have production InPost ShipX credentials and are using Medusa v2, I'd love your help validating real locker and courier shipments.
>
> What you'd get:
>
> - Free setup assistance
> - Priority bug fixes
>
> Reach out by [opening a GitHub issue](https://github.com/bystrol/medusa-inpost-fulfillment/issues/new) or emailing the maintainer. Bug reports from production use are especially welcome.

## Features

- **Paczkomat locker delivery** (`inpost_locker_standard`) — ships to a selected InPost locker machine
- **Courier delivery** (`inpost_courier_standard`) — ships to the receiver's address with automatic dispatch order creation
- Automatic offer selection and purchase (for prepaid accounts)
- Local InPost shipment history stored in Medusa
- Admin API for shipment list, details, status refresh, labels, and cancellation
- Scheduled status synchronization for active shipments
- Shipment label retrieval (PDF/ZPL)
- Shipment cancellation
- Polish postal code normalization (5 digits to XX-XXX format)
- Parcel dimensions aggregated from cart item variants

## Prerequisites

- MedusaJS v2 (`@medusajs/framework` ^2.5.0)
- Node.js >= 20
- InPost ShipX API credentials ([register here](https://manager.paczkomaty.pl/))

## InPost API version

This plugin currently integrates with the Polish InPost ShipX v1 API:

- Sandbox: `https://sandbox-api-shipx-pl.easypack24.net/v1`
- Production: `https://api-shipx-pl.easypack24.net/v1`

It does not yet use the newer InPost Global API (`/shipping/v2` on `api.inpost-group.com`). Migrating to the Global API requires separate changes to authentication, shipment payloads, label retrieval, tracking identifiers, and endpoint URLs.

## Installation

```bash
npm install medusa-inpost-fulfillment
```

After installing or upgrading to a version that includes the InPost shipment module, run Medusa migrations:

```bash
npx medusa db:migrate
```

## Configuration

Add the plugin to your `medusa-config.ts`:

```ts
import { defineConfig } from "@medusajs/framework/utils";

const inpostOptions = {
  // Required
  apiToken: process.env.INPOST_API_TOKEN,
  organizationId: process.env.INPOST_ORGANIZATION_ID,

  // Optional — use InPost sandbox environment (default: false)
  sandbox: true,

  // Optional — default parcel template for locker shipments
  // "small" | "medium" | "large" (default: "small")
  defaultParcelTemplate: "small",

  // Optional — default shipment label format
  // "pdf" | "zpl" (default: "pdf")
  defaultLabelFormat: "pdf",

  // Optional — return session token lifetime in minutes (default: 60)
  returnTokenTtlMinutes: 60,

  // Required for courier shipments — sender details
  sender: {
    company_name: "My Store",
    first_name: "John",
    last_name: "Doe",
    email: "shipping@mystore.com",
    phone: "500100200",
    address: {
      street: "Marszalkowska",
      building_number: "1",
      city: "Warsaw",
      post_code: "00-001",
      country_code: "PL",
    },
  },
};

export default defineConfig({
  // ...
  plugins: [
    // Registers the plugin module, Admin API routes, scheduled jobs, and migrations.
    {
      resolve: "medusa-inpost-fulfillment",
      options: inpostOptions,
    },
  ],
  modules: [
    {
      resolve: "@medusajs/medusa/fulfillment",
      options: {
        providers: [
          // default provider
          {
            resolve: "@medusajs/medusa/fulfillment-manual",
            id: "manual",
          },
          {
            resolve: "medusa-inpost-fulfillment/providers/inpost",
            id: "inpost",
            options: inpostOptions,
          },
        ],
      },
    },
  ],
});
```

The `medusa-inpost-fulfillment` plugin registration must be placed in `plugins`. It lets Medusa discover the plugin's `inpost` module, Admin API routes, scheduled jobs, and migrations. Do not place `resolve: "medusa-inpost-fulfillment"` in `modules`.

The fulfillment provider registration under `@medusajs/medusa/fulfillment` must stay in `modules`, because it tells Medusa's fulfillment module that InPost is available as a shipping provider.

### Environment variables

| Variable                 | Description                 |
| ------------------------ | --------------------------- |
| `INPOST_API_TOKEN`       | Your InPost ShipX API token |
| `INPOST_ORGANIZATION_ID` | Your InPost organization ID |

## Shipping options

After installing the plugin, create shipping options in the Medusa admin that use the InPost fulfillment provider. The plugin exposes two services:

| Service ID                | Description               |
| ------------------------- | ------------------------- |
| `inpost_locker_standard`  | Paczkomat locker delivery |
| `inpost_courier_standard` | Courier home delivery     |

## Where to find your shipments

InPost uses different apps for locker and courier shipments:

- **Locker (Paczkomat) shipments** — visible in [Manager Paczek](https://manager.paczkomaty.pl) (sandbox: [sandbox-manager.paczkomaty.pl](https://sandbox-manager.paczkomaty.pl))
- **Courier shipments** — visible in **WebTrucker** at [kurier.inpost.pl](https://kurier.inpost.pl) under "Przesyłki do nadania" (Shipments to send), and later under "Monitoring" once InPost processes them

> **Note on sandbox for courier shipments:** WebTrucker has no sandbox equivalent, so courier shipments created in sandbox will not appear in any UI. In sandbox, a correctly created courier shipment will simply reach status `confirmed` via the API — that is the sandbox success criterion. Only production courier shipments are visible in WebTrucker.

## Storefront integration

### Locker delivery

For Paczkomat locker delivery, the storefront must pass `target_point` (the Paczkomat machine ID) when adding a shipping method to the cart:

```ts
await sdk.store.cart.addShippingMethod(cartId, {
  option_id: lockerShippingOptionId,
  data: {
    target_point: "WAW123", // Paczkomat machine ID
  },
});
```

You can use the [InPost Geowidget](https://dokumentacja-inpost.atlassian.net/wiki/spaces/PL/pages/622594/Geowidget) to let customers pick a Paczkomat on a map.

### Courier delivery

For courier delivery, no additional data is needed — the receiver address is taken from the cart's shipping address:

```ts
await sdk.store.cart.addShippingMethod(cartId, {
  option_id: courierShippingOptionId,
});
```

### Address requirements

InPost ShipX expects the street and building number as separate address fields. The storefront checkout should collect and save them separately:

| Storefront field        | Medusa shipping address field        | Required |
| ----------------------- | ------------------------------------ | -------- |
| First name              | `shipping_address.first_name`        | Yes      |
| Last name               | `shipping_address.last_name`         | Yes      |
| Street                  | `shipping_address.address_1`         | Yes      |
| Building number         | `shipping_address.address_2`         | Yes      |
| Postal code             | `shipping_address.postal_code`       | Yes      |
| City                    | `shipping_address.city`              | Yes      |
| Country                 | `shipping_address.country_code`      | Yes      |
| Phone                   | `shipping_address.phone`             | Yes      |
| Company                 | `shipping_address.company`           | No       |
| State / province        | `shipping_address.province`          | No       |
| Apartment / flat number | `shipping_address.metadata.flat_number` | No    |

Do not put the full street address with building number into `address_1` (for example `Marszalkowska 10`). Use `address_1` for the street name only and `address_2` for the building number.

If the storefront has a single `Address` field, split it into separate `Street` and `Building number` inputs before using this provider.

### Parcel dimensions

For courier shipments, the plugin aggregates parcel dimensions from cart item variants (the `weight`, `length`, `height`, and `width` fields on product variants). If no dimensions are available, `parcel_dimensions` must be provided in fulfillment data. The plugin does not silently fall back to placeholder parcel dimensions.

For locker shipments, a parcel template (`small`, `medium`, or `large`) is used instead, configurable via the `defaultParcelTemplate` option or per-shipment via `parcel_template` in fulfillment data.

## InPost shipment history

The plugin includes an `inpost` module that stores a local record after a ShipX shipment is created successfully. This makes shipment data available outside of `fulfillment.data` and gives the admin API a stable source for list/detail views and status synchronization.

Local shipment history is recorded asynchronously: after Medusa creates an order fulfillment, the plugin listens to the `order.fulfillment_created` event, reads the InPost shipment data from `fulfillment.data`, and upserts an `InpostShipment` record.

Stored fields include:

- `order_id`
- `fulfillment_id`
- `shipment_id`
- `tracking_number`
- `service_type`
- `status`
- `label_format`
- `dispatch_order_id`
- `last_synced_at`
- `last_error`
- `raw_response`

### Admin API

The following admin routes are available:

| Method   | Path                                      | Description                       |
| -------- | ----------------------------------------- | --------------------------------- |
| `GET`    | `/admin/inpost/shipments`                 | List local InPost shipments       |
| `GET`    | `/admin/inpost/shipments/:id`             | Retrieve one local shipment       |
| `POST`   | `/admin/inpost/shipments/:id/refresh`     | Refresh shipment data from ShipX |
| `GET`    | `/admin/inpost/shipments/:id/label`       | Download shipment label           |
| `DELETE` | `/admin/inpost/shipments/:id`             | Cancel shipment in ShipX if allowed |

List filters: `order_id`, `fulfillment_id`, `shipment_id`, `tracking_number`, `q`, `status`, `service_type`, `state`, `errors`, `date_from`, `date_to`, `limit`, and `offset`.

Supported list filter values:

| Query param    | Description                                      |
| -------------- | ------------------------------------------------ |
| `q`            | Searches order ID, fulfillment ID, shipment ID, tracking number, and dispatch order ID |
| `service_type` | `inpost_locker_standard` or `inpost_courier_standard` |
| `state`        | `active` or `canceled`                           |
| `errors`       | `with` or `without`                              |
| `date_from`    | Shipment creation date lower bound, `YYYY-MM-DD` |
| `date_to`      | Shipment creation date upper bound, `YYYY-MM-DD` |

Label download accepts an optional `format` query parameter:

```txt
/admin/inpost/shipments/:id/label?format=pdf
/admin/inpost/shipments/:id/label?format=zpl
```

Active shipments are synchronized every 15 minutes by the `sync-inpost-shipments` scheduled job.

### Admin UI

The plugin adds an Admin UI extension under **InPost**. The shipments view uses the plugin Admin API and lets store staff:

- browse locally recorded InPost shipments,
- search by order ID, fulfillment ID, ShipX shipment ID, tracking number, receiver, or destination,
- filter by status, service type, and sync errors,
- refresh shipment data from ShipX,
- download PDF or ZPL labels,
- open public InPost tracking,
- copy the tracking number,
- cancel cancellable shipments,
- inspect the raw ShipX response.

The plugin also adds an order details widget showing InPost shipments recorded for the current order.

## How it works

### Fulfillment flow

1. **Create shipment** — sends parcel, receiver, and sender data to InPost ShipX API
2. **Offer handling** — for prepaid accounts, the plugin polls for offers, selects the first available one, and purchases it
3. **Dispatch order** (courier only) — creates a dispatch order to schedule courier pickup from the sender's address
4. **Return data** — stores `shipment_id`, `tracking_number`, and `dispatch_order_id` in the fulfillment data
5. **Local history** — after Medusa emits `order.fulfillment_created`, the plugin upserts an `InpostShipment` record in the `inpost` module

### Cancellation

When a fulfillment is cancelled in Medusa, the plugin attempts to cancel the corresponding shipment in InPost.

ShipX cancellation is only possible before the shipment is confirmed. The plugin treats the following statuses as cancellable through the API:

- `created`
- `offers_prepared`
- `offer_selected`

Once a shipment reaches `confirmed`, ShipX rejects cancellation with `invalid_action`. In that case, the plugin does not call the cancellation endpoint and lets Medusa cancel the fulfillment locally only. The physical shipment must then be cancelled manually in [InPost Manager](https://manager.paczkomaty.pl) for locker shipments or [WebTrucker](https://kurier.inpost.pl) for courier shipments.

The Admin UI disables the **Cancel shipment** action for non-cancellable statuses and shows a tooltip explaining that the shipment must be cancelled manually in InPost.

See the official InPost ShipX cancellation docs: [Anulowanie przesyłki](https://dokumentacja-inpost.atlassian.net/wiki/spaces/PL/pages/11731070).

### Labels

The plugin supports retrieving shipment labels as PDF documents through Medusa's fulfillment documents API.

### Returns

Medusa's default fulfillment-provider return flow does not provide enough data to create a full InPost return shipment automatically (for example, it does not include the customer's selected return locker). For that native Medusa flow, `createReturnFulfillment` intentionally does not call ShipX.

The plugin includes the first part of a self-service return flow:

| Method | Path | Description |
| ------ | ---- | ----------- |
| `POST` | `/store/inpost/returns/lookup` | Looks up an order by `order_id` and `email`, then prepares a hashed return-session token if the order matches |
| `GET` | `/store/inpost/returns/session?token=...` | Validates a return-session token and returns safe order/item data for the return UI |
| `POST` | `/store/inpost/returns` | Submits a local return request from an active return-session token |

Lookup request body:

```json
{
  "order_id": "order_...",
  "email": "customer@example.com",
  "return_method": "locker"
}
```

`return_method` is optional and defaults to `locker`.

Submit return request body:

```json
{
  "token": "return-session-token",
  "items": [
    {
      "order_line_item_id": "ordli_...",
      "quantity": 1,
      "reason": "Wrong size"
    }
  ]
}
```

The submit endpoint validates that the token is active, the requested items belong to the order, the quantities are returnable, and the same line items have not already been submitted in another active InPost return. On success, the local return moves to `submitted` and the selected items are stored in `inpost_return_item`.

The lookup endpoint always returns the same neutral response, so it does not reveal whether an order exists. The raw token is never stored; only a SHA-256 hash and expiration date are saved in `inpost_return`.

Email delivery of the magic link and actual ShipX return shipment creation are not implemented yet. Those are planned as the next return-flow steps.

## Options reference

| Option                  | Type                             | Required    | Default   | Description                                     |
| ----------------------- | -------------------------------- | ----------- | --------- | ----------------------------------------------- |
| `apiToken`              | `string`                         | Yes         | —         | InPost ShipX API token                          |
| `organizationId`        | `string`                         | Yes         | —         | InPost organization ID                          |
| `sandbox`               | `boolean`                        | No          | `false`   | Use sandbox API environment                     |
| `defaultParcelTemplate` | `"small" \| "medium" \| "large"` | No          | `"small"` | Default parcel template for locker shipments    |
| `defaultLabelFormat`    | `"pdf" \| "zpl"`                 | No          | `"pdf"`   | Default label format for shipment documents     |
| `sender`                | `object`                         | For courier | —         | Sender details (required for courier shipments) |
| `sender.company_name`   | `string`                         | For courier | —         | Sender company name                             |
| `sender.first_name`     | `string`                         | For courier | —         | Sender first name                               |
| `sender.last_name`      | `string`                         | For courier | —         | Sender last name                                |
| `sender.email`          | `string`                         | Yes         | —         | Sender email                                    |
| `sender.phone`          | `string`                         | Yes         | —         | Sender phone number                             |
| `sender.address`        | `object`                         | Yes         | —         | Sender address                                  |

## License

MIT
