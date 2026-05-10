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

## Configuration

Add the plugin to your `medusa-config.ts`:

```ts
import { defineConfig } from "@medusajs/framework/utils";

export default defineConfig({
  // ...
  plugins: [
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
            options: {
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
            },
          },
        ],
      },
    },
  ],
});
```

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

For courier shipments, the plugin aggregates parcel dimensions from cart item variants (the `weight`, `length`, `height`, and `width` fields on product variants). If no dimensions are set, defaults are used (200x200x100mm, 1kg).

For locker shipments, a parcel template (`small`, `medium`, or `large`) is used instead, configurable via the `defaultParcelTemplate` option or per-shipment via `parcel_template` in fulfillment data.

## How it works

### Fulfillment flow

1. **Create shipment** — sends parcel, receiver, and sender data to InPost ShipX API
2. **Offer handling** — for prepaid accounts, the plugin polls for offers, selects the first available one, and purchases it
3. **Dispatch order** (courier only) — creates a dispatch order to schedule courier pickup from the sender's address
4. **Return data** — stores `shipment_id`, `tracking_number`, and `dispatch_order_id` in the fulfillment data

### Cancellation

When a fulfillment is cancelled in Medusa, the plugin attempts to cancel the corresponding shipment in InPost.

> **Important:** InPost only allows cancelling shipments that are still in `created` or `offers_prepared` status. Once a shipment has been confirmed (label purchased/dispatch order issued), the InPost API will reject the cancel request. In that case, the plugin logs a warning and lets Medusa mark the fulfillment cancelled **locally only** — the physical shipment must be cancelled manually in [InPost Manager](https://manager.paczkomaty.pl) (for locker shipments) or [WebTrucker](https://kurier.inpost.pl) (for courier shipments).

### Labels

The plugin supports retrieving shipment labels as PDF documents through Medusa's fulfillment documents API.

### Returns

Return shipments are not created automatically — they should be created manually in InPost Manager, as Medusa's return flow does not provide sufficient data (e.g., target locker for locker returns).

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
