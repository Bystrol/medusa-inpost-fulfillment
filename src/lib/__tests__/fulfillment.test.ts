import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  buildShipmentRequest,
  buildTrackingUrl,
  INPOST_TRACKING_URL_BASE,
  normalizePolishPostalCode,
  resolveLabelFormat,
} from "../fulfillment"
import { InPostService } from "../types"

const baseOptions = {
  apiToken: "token",
  organizationId: "org_123",
}

const shippingAddress = {
  first_name: "Jan",
  last_name: "Kowalski",
  address_1: "Marszalkowska",
  address_2: "10",
  city: "Warsaw",
  postal_code: "00001",
  country_code: "pl",
  phone: "500100200",
}

describe("InPost fulfillment helpers", () => {
  it("normalizes Polish postal codes", () => {
    assert.equal(normalizePolishPostalCode("00001"), "00-001")
    assert.equal(normalizePolishPostalCode("00-001"), "00-001")
  })

  it("builds locker shipment requests", () => {
    const request = buildShipmentRequest({
      data: {
        service_type: InPostService.inpost_locker_standard,
        target_point: "WAW123",
      },
      options: baseOptions,
      shippingAddress,
      email: "customer@example.com",
      reference: "order_123",
    })

    assert.equal(request.service, InPostService.inpost_locker_standard)
    assert.deepEqual(request.parcels, [{ template: "small" }])
    assert.equal(request.receiver.email, "customer@example.com")
    assert.equal(request.receiver.phone, "500100200")
    assert.equal(request.receiver.address?.post_code, "00-001")
    assert.equal(request.receiver.address?.country_code, "PL")
    assert.equal(request.custom_attributes?.target_point, "WAW123")
    assert.equal(request.custom_attributes?.sending_method, "parcel_locker")
    assert.equal(request.reference, "order_123")
  })

  it("builds courier shipment requests with sender and dimensions", () => {
    const request = buildShipmentRequest({
      data: {
        service_type: InPostService.inpost_courier_standard,
        parcel_dimensions: {
          length: 300,
          width: 200,
          height: 120,
          weight: 2,
        },
      },
      options: {
        ...baseOptions,
        sender: {
          company_name: "Store",
          first_name: "Jan",
          last_name: "Kowalski",
          email: "shipping@example.com",
          phone: "500100201",
          address: {
            street: "Prosta",
            building_number: "1",
            city: "Warsaw",
            post_code: "00002",
            country_code: "PL",
          },
        },
      },
      shippingAddress,
      email: "customer@example.com",
    })

    assert.equal(request.service, InPostService.inpost_courier_standard)
    assert.equal(request.parcels[0].dimensions?.length, 300)
    assert.equal(request.parcels[0].weight?.amount, 2)
    assert.equal(request.sender?.address?.post_code, "00-002")
    assert.equal(request.custom_attributes?.sending_method, "dispatch_order")
  })

  it("rejects missing locker target points before ShipX call", () => {
    assert.throws(
      () =>
        buildShipmentRequest({
          data: {
            service_type: InPostService.inpost_locker_standard,
          },
          options: baseOptions,
          shippingAddress,
          email: "customer@example.com",
        }),
      /target_point/
    )
  })

  it("rejects courier shipments without sender configuration", () => {
    assert.throws(
      () =>
        buildShipmentRequest({
          data: {
            service_type: InPostService.inpost_courier_standard,
          },
          options: baseOptions,
          shippingAddress,
          email: "customer@example.com",
        }),
      /sender/
    )
  })

  it("rejects shipments without service type", () => {
    assert.throws(
      () =>
        buildShipmentRequest({
          data: {
            target_point: "WAW123",
          },
          options: baseOptions,
          shippingAddress,
          email: "customer@example.com",
        }),
      /service type/
    )
  })

  it("rejects shipments without receiver building number", () => {
    assert.throws(
      () =>
        buildShipmentRequest({
          data: {
            service_type: InPostService.inpost_locker_standard,
            target_point: "WAW123",
          },
          options: baseOptions,
          shippingAddress: {
            ...shippingAddress,
            address_2: undefined,
          },
          email: "customer@example.com",
        }),
      /building number/
    )
  })

  it("rejects shipments without receiver name", () => {
    assert.throws(
      () =>
        buildShipmentRequest({
          data: {
            service_type: InPostService.inpost_locker_standard,
            target_point: "WAW123",
          },
          options: baseOptions,
          shippingAddress: {
            ...shippingAddress,
            first_name: "",
          },
          email: "customer@example.com",
        }),
      /first name/
    )

    assert.throws(
      () =>
        buildShipmentRequest({
          data: {
            service_type: InPostService.inpost_locker_standard,
            target_point: "WAW123",
          },
          options: baseOptions,
          shippingAddress: {
            ...shippingAddress,
            last_name: undefined,
          },
          email: "customer@example.com",
        }),
      /last name/
    )
  })

  it("rejects shipments without receiver country code", () => {
    assert.throws(
      () =>
        buildShipmentRequest({
          data: {
            service_type: InPostService.inpost_locker_standard,
            target_point: "WAW123",
          },
          options: baseOptions,
          shippingAddress: {
            ...shippingAddress,
            country_code: undefined,
          },
          email: "customer@example.com",
        }),
      /country code/
    )
  })

  it("rejects courier senders without country code", () => {
    assert.throws(
      () =>
        buildShipmentRequest({
          data: {
            service_type: InPostService.inpost_courier_standard,
          },
          options: {
            ...baseOptions,
            sender: {
              company_name: "Store",
              first_name: "Jan",
              last_name: "Kowalski",
              email: "shipping@example.com",
              phone: "500100201",
              address: {
                street: "Prosta",
                building_number: "1",
                city: "Warsaw",
                post_code: "00-002",
                country_code: "",
              },
            },
          },
          shippingAddress,
          email: "customer@example.com",
        }),
      /country_code/
    )
  })

  it("rejects courier senders without required identity fields", () => {
    assert.throws(
      () =>
        buildShipmentRequest({
          data: {
            service_type: InPostService.inpost_courier_standard,
            parcel_dimensions: {
              length: 300,
              width: 200,
              height: 120,
              weight: 2,
            },
          },
          options: {
            ...baseOptions,
            sender: {
              email: "shipping@example.com",
              phone: "500100201",
              address: {
                street: "Prosta",
                building_number: "1",
                city: "Warsaw",
                post_code: "00-002",
                country_code: "PL",
              },
            },
          },
          shippingAddress,
          email: "customer@example.com",
        }),
      /sender.company_name/
    )
  })

  it("rejects courier shipments without parcel dimensions", () => {
    assert.throws(
      () =>
        buildShipmentRequest({
          data: {
            service_type: InPostService.inpost_courier_standard,
          },
          options: {
            ...baseOptions,
            sender: {
              company_name: "Store",
              first_name: "Jan",
              last_name: "Kowalski",
              email: "shipping@example.com",
              phone: "500100201",
              address: {
                street: "Prosta",
                building_number: "1",
                city: "Warsaw",
                post_code: "00-002",
                country_code: "PL",
              },
            },
          },
          shippingAddress,
          email: "customer@example.com",
        }),
      /parcel_dimensions/
    )
  })

  it("resolves label format defaults and overrides", () => {
    assert.equal(resolveLabelFormat(baseOptions), "pdf")
    assert.equal(
      resolveLabelFormat({ ...baseOptions, defaultLabelFormat: "zpl" }),
      "zpl"
    )
    assert.equal(resolveLabelFormat(baseOptions, { label_format: "zpl" }), "zpl")
  })

  it("builds public InPost tracking URLs", () => {
    assert.equal(
      buildTrackingUrl("1234567890"),
      `${INPOST_TRACKING_URL_BASE}?number=1234567890`
    )
  })
})
