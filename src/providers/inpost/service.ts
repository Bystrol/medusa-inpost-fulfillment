import { Logger } from "@medusajs/framework/types";
import {
  AbstractFulfillmentProviderService,
  MedusaError,
} from "@medusajs/framework/utils";
import {
  CalculatedShippingOptionPrice,
  CalculateShippingOptionPriceDTO,
  CreateFulfillmentResult,
  CreateShippingOptionDTO,
  FulfillmentDTO,
  FulfillmentItemDTO,
  FulfillmentOrderDTO,
  ValidateFulfillmentDataContext,
} from "@medusajs/types";
import { InPostShipXClient } from "../../lib/client";
import {
  InPostParcel,
  InPostParcelTemplate,
  InPostPerson,
  InPostPluginOptions,
  InPostService,
  InPostShipmentRequest,
} from "../../lib/types";

type InjectedDependencies = {
  logger: Logger;
};

class InPostFulfillmentProviderService extends AbstractFulfillmentProviderService {
  static identifier = "inpost";

  private client: InPostShipXClient;
  private logger: Logger;
  private options: InPostPluginOptions;

  constructor({ logger }: InjectedDependencies, options: InPostPluginOptions) {
    super();

    if (!options.apiToken) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "InPost fulfillment provider: missing required option `apiToken`"
      );
    }
    if (!options.organizationId) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "InPost fulfillment provider: missing required option `organizationId`"
      );
    }

    this.logger = logger;
    this.options = options;
    this.client = new InPostShipXClient(options);
  }

  async getFulfillmentOptions() {
    return [
      {
        id: InPostService.inpost_locker_standard,
        name: "InPost Paczkomat (locker delivery)",
        is_return: false,
      },
      {
        id: InPostService.inpost_courier_standard,
        name: "InPost Courier (home delivery)",
        is_return: false,
      },
    ];
  }

  async validateOption(data: Record<string, unknown>): Promise<boolean> {
    return Object.values(InPostService).includes(data.id as InPostService);
  }

  async validateFulfillmentData(
    optionData: Record<string, unknown>,
    data: Record<string, unknown>,
    context: ValidateFulfillmentDataContext
  ): Promise<Record<string, unknown>> {
    const serviceId = optionData.id as InPostService;

    const isLockerService = serviceId === InPostService.inpost_locker_standard;

    if (isLockerService && !data.target_point) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "InPost locker delivery requires `target_point` (Paczkomat machine ID) in fulfillment data"
      );
    }

    // Extract parcel dimensions from cart items' variant data.
    // For courier shipments, we aggregate item dimensions to build
    // the parcel size sent to InPost.
    type CartItem = {
      quantity: number;
      variant?: {
        weight?: number;
        length?: number;
        height?: number;
        width?: number;
      };
    };
    const items = (context as ValidateFulfillmentDataContext & {
      items?: CartItem[];
    }).items;

    let parcelDimensions:
      | { length: number; width: number; height: number; weight: number }
      | undefined;

    if (items?.length) {
      let totalWeight = 0;
      let maxLength = 0;
      let maxWidth = 0;
      let totalHeight = 0;

      for (const item of items) {
        const qty = item.quantity || 1;
        const v = item.variant;
        if (v) {
          totalWeight += (v.weight || 0) * qty;
          maxLength = Math.max(maxLength, v.length || 0);
          maxWidth = Math.max(maxWidth, v.width || 0);
          totalHeight += (v.height || 0) * qty;
        }
      }

      if (totalWeight > 0 || maxLength > 0 || maxWidth > 0 || totalHeight > 0) {
        parcelDimensions = {
          length: maxLength,
          width: maxWidth,
          height: totalHeight,
          weight: totalWeight,
        };
      }
    }

    return {
      ...data,
      service_type: serviceId,
      target_point: data.target_point,
      ...(parcelDimensions && { parcel_dimensions: parcelDimensions }),
    };
  }

  async canCalculate(_data: CreateShippingOptionDTO): Promise<boolean> {
    return false;
  }

  async calculatePrice(
    _optionData: CalculateShippingOptionPriceDTO["optionData"],
    _data: CalculateShippingOptionPriceDTO["data"],
    _context: CalculateShippingOptionPriceDTO["context"]
  ): Promise<CalculatedShippingOptionPrice> {
    return { calculated_amount: 0, is_calculated_price_tax_inclusive: true };
  }

  async createFulfillment(
    data: Record<string, unknown>,
    _items: Partial<Omit<FulfillmentItemDTO, "fulfillment">>[],
    order: Partial<FulfillmentOrderDTO> | undefined,
    fulfillment: Partial<Omit<FulfillmentDTO, "provider_id" | "data" | "items">>
  ): Promise<CreateFulfillmentResult> {
    const shippingAddress = order?.shipping_address;

    if (!shippingAddress) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "InPost fulfillment: shipping address is required"
      );
    }

    const email =
      order?.email ||
      (order as Partial<FulfillmentOrderDTO> & { customer?: { email?: string } })?.customer?.email ||
      (data.email as string) ||
      "";

    if (!email) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "InPost fulfillment: receiver email is required. Ensure the order has an email address."
      );
    }

    // Normalize Polish postal code to XX-XXX format
    let postCode = shippingAddress.postal_code || "";
    if (/^\d{5}$/.test(postCode)) {
      postCode = `${postCode.slice(0, 2)}-${postCode.slice(2)}`;
    }

    const receiver: InPostPerson = {
      first_name: shippingAddress.first_name || undefined,
      last_name: shippingAddress.last_name || undefined,
      email,
      phone: shippingAddress.phone || "",
      address: {
        street: shippingAddress.address_1 || "",
        building_number: shippingAddress.address_2 || "1",
        city: shippingAddress.city || "",
        post_code: postCode,
        country_code: (shippingAddress.country_code || "PL").toUpperCase(),
      },
    };

    const serviceType =
      (data.service_type as InPostService) ||
      InPostService.inpost_locker_standard;

    const isLockerService =
      serviceType === InPostService.inpost_locker_standard;

    let parcel: InPostParcel;
    if (isLockerService) {
      const template = (data.parcel_template ||
        this.options.defaultParcelTemplate ||
        "small") as InPostParcelTemplate;
      parcel = { template };
    } else {
      const dims = data.parcel_dimensions as
        | { length: number; width: number; height: number; weight: number }
        | undefined;

      parcel = {
        dimensions: {
          length: dims?.length || 200,
          width: dims?.width || 200,
          height: dims?.height || 100,
          unit: "mm",
        },
        weight: {
          amount: dims?.weight || 1,
          unit: "kg",
        },
      };
    }

    const customAttributes: InPostShipmentRequest["custom_attributes"] =
      isLockerService
        ? {
            target_point: data.target_point as string,
            sending_method: "parcel_locker",
          }
        : {
            sending_method: "dispatch_order",
          };

    const shipmentRequest: InPostShipmentRequest = {
      receiver,
      ...(this.options.sender && { sender: this.options.sender }),
      parcels: [parcel],
      service: serviceType,
      reference: order?.id || fulfillment.id,
      custom_attributes: customAttributes,
    };

    try {
      const shipment = await this.client.createShipment(shipmentRequest);

      // Poll until shipment is confirmed or offers are ready
      let current = shipment;
      for (let i = 0; i < 15; i++) {
        if (current.status === "confirmed") break;

        const hasOffers = current.offers?.some(
          (o) => o.status === "available"
        );
        if (hasOffers || current.status === "offers_prepared") break;

        await new Promise((resolve) => setTimeout(resolve, 2000));
        current = await this.client.getShipment(shipment.id);
      }

      // If not yet confirmed, try the offer flow (select + buy)
      if (current.status !== "confirmed") {
        const offer = current.offers?.find((o) => o.status === "available") ||
          current.selected_offer ||
          current.offers?.[0];

        if (!offer) {
          throw new MedusaError(
            MedusaError.Types.UNEXPECTED_STATE,
            `InPost fulfillment: shipment ${shipment.id} stuck in status "${current.status}" with no available offers`
          );
        }

        current = await this.client.buyShipment(shipment.id, offer.id);
      }

      let dispatchOrderId: number | undefined;

      if (!isLockerService) {
        const senderAddress = this.options.sender?.address;

        if (!senderAddress) {
          throw new MedusaError(
            MedusaError.Types.INVALID_DATA,
            "InPost fulfillment: `sender.address` is required in plugin options for courier shipments (needed to create a dispatch order)"
          );
        }

        const dispatchOrder = await this.client.createDispatchOrder(
          [current.id],
          {
            street: senderAddress.street,
            building_number: senderAddress.building_number,
            city: senderAddress.city,
            post_code: senderAddress.post_code,
            country_code: senderAddress.country_code || "PL",
          }
        );

        dispatchOrderId = dispatchOrder.id;
      }

      return {
        data: {
          shipment_id: current.id,
          tracking_number: current.tracking_number,
          status: current.status,
          service_type: serviceType,
          target_point: data.target_point,
          ...(dispatchOrderId && { dispatch_order_id: dispatchOrderId }),
        },
        labels: [],
      };
    } catch (error) {
      this.logger.error("InPost createFulfillment failed", error as Error);
      throw error;
    }
  }

  async cancelFulfillment(data: Record<string, unknown>): Promise<Record<string, unknown>> {
    const shipmentId = data.shipment_id as number | undefined;

    if (!shipmentId) {
      this.logger.error(
        "InPost cancelFulfillment: no shipment_id in data, skipping cancellation"
      );
      return {};
    }

    try {
      // InPost only allows cancelling shipments that haven't been confirmed/
      // dispatched yet. Once a shipment moves past `created`, the DELETE call
      // returns 400. In that case we skip the API call and let Medusa mark the
      // fulfillment cancelled locally — the physical shipment must then be
      // cancelled manually in the InPost Manager panel.
      const CANCELLABLE_STATUSES = new Set(["created", "offers_prepared"]);

      let status: string | undefined;
      try {
        const shipment = await this.client.getShipment(shipmentId);
        status = shipment.status;
      } catch (error) {
        this.logger.warn(
          `InPost cancelFulfillment: could not fetch shipment ${shipmentId} status, attempting cancel anyway: ${(error as Error).message}`
        );
      }

      if (status && !CANCELLABLE_STATUSES.has(status)) {
        this.logger.warn(
          `InPost cancelFulfillment: shipment ${shipmentId} is in status "${status}" and cannot be cancelled via API. Marking fulfillment cancelled locally — cancel the shipment manually in InPost Manager if needed.`
        );
        return {};
      }

      await this.client.cancelShipment(shipmentId);
    } catch (error) {
      this.logger.error("InPost cancelFulfillment failed", error as Error);
      throw error;
    }

    return {};
  }

  async createReturnFulfillment(
    fulfillment: Record<string, unknown>
  ): Promise<CreateFulfillmentResult> {
    // Medusa's default return flow doesn't provide enough data to create
    // an InPost return shipment (no target_point for locker, no order address).
    // Return shipments should be created manually in InPost Manager.
    this.logger.info(
      "InPost createReturnFulfillment - skipping InPost API call, return shipment should be created manually in InPost Manager"
    );

    return {
      data: {
        note: "Return shipment not created automatically. Please create it manually in InPost Manager.",
      },
      labels: [],
    };
  }

  // Note: base class declares Promise<never[]> which appears incorrect; we
  // return real document objects, so we use `any` here to satisfy the override.
  async getFulfillmentDocuments(data: Record<string, unknown>): Promise<any> {
    const shipmentId = data.shipment_id as number | undefined;

    if (!shipmentId) {
      return [];
    }

    try {
      const labelBuffer = await this.client.getLabel(shipmentId, "pdf");
      return [
        {
          base64: labelBuffer.toString("base64"),
          name: `inpost-label-${shipmentId}.pdf`,
          type: "application/pdf",
        },
      ];
    } catch (error) {
      this.logger.error(
        "InPost getFulfillmentDocuments failed",
        error as Error
      );
      throw error;
    }
  }

  async getReturnDocuments(data: Record<string, unknown>): Promise<any> {
    const shipmentId =
      (data.return_shipment_id as number | undefined) ||
      (data.shipment_id as number | undefined);

    if (!shipmentId) {
      return [];
    }

    try {
      const labelBuffer = await this.client.getLabel(shipmentId, "pdf");
      return [
        {
          base64: labelBuffer.toString("base64"),
          name: `inpost-return-label-${shipmentId}.pdf`,
          type: "application/pdf",
        },
      ];
    } catch (error) {
      this.logger.error("InPost getReturnDocuments failed", error as Error);
      throw error;
    }
  }

  async getShipmentDocuments(data: Record<string, unknown>): Promise<any> {
    return this.getFulfillmentDocuments(data);
  }

  async retrieveDocuments(
    fulfillmentData: Record<string, unknown>,
    documentType: string
  ): Promise<void> {
    if (documentType === "invoice") {
      return;
    }
    await this.getFulfillmentDocuments(fulfillmentData);
  }
}

export default InPostFulfillmentProviderService;
