import { Logger } from "@medusajs/framework/types";
import { MedusaError, MedusaService } from "@medusajs/framework/utils";
import { InPostShipXClient } from "../../lib/client";
import { InPostLabelFormat, InPostPluginOptions } from "../../lib/types";
import InpostShipment from "./models/inpost-shipment";

export type InPostShipmentRecord = {
  id: string;
  order_id: string | null;
  fulfillment_id: string | null;
  shipment_id: string;
  tracking_number: string | null;
  service_type: string | null;
  status: string;
  label_format: InPostLabelFormat;
  dispatch_order_id: string | null;
  last_synced_at: Date | null;
  last_error: string | null;
  raw_response: Record<string, unknown> | null;
  created_at?: Date;
  updated_at?: Date;
  deleted_at?: Date | null;
};

export type UpsertInPostShipmentInput = {
  order_id?: string | null;
  fulfillment_id?: string | null;
  shipment_id: string;
  tracking_number?: string | null;
  service_type?: string | null;
  status: string;
  label_format?: InPostLabelFormat;
  dispatch_order_id?: string | null;
  last_synced_at?: Date | null;
  last_error?: string | null;
  raw_response?: Record<string, unknown> | null;
};

type InjectedDependencies = {
  logger: Logger;
};

type InPostShipmentCrud = {
  createInpostShipments(
    data: UpsertInPostShipmentInput
  ): Promise<InPostShipmentRecord>;
  listInpostShipments(
    filters?: Record<string, unknown>,
    config?: Record<string, unknown>
  ): Promise<InPostShipmentRecord[]>;
  listAndCountInpostShipments(
    filters?: Record<string, unknown>,
    config?: Record<string, unknown>
  ): Promise<[InPostShipmentRecord[], number]>;
  retrieveInpostShipment(
    id: string,
    config?: Record<string, unknown>
  ): Promise<InPostShipmentRecord>;
  updateInpostShipments(
    data:
      | (Partial<UpsertInPostShipmentInput> & { id: string })
      | {
          selector: Record<string, unknown>;
          data: Partial<UpsertInPostShipmentInput>;
        }
  ): Promise<InPostShipmentRecord>;
};

const CANCELLABLE_STATUSES = new Set(["created", "offers_prepared"]);
const FINAL_STATUSES = new Set(["delivered", "canceled", "returned_to_sender"]);

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function toShipmentIdNumber(shipmentId: string): number {
  const parsed = Number(shipmentId);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `InPost shipment: invalid ShipX shipment_id "${shipmentId}"`
    );
  }

  return parsed;
}

class InPostModuleService extends MedusaService({
  InpostShipment,
}) {
  private client: InPostShipXClient;
  private logger: Logger;

  constructor(deps: InjectedDependencies, options: InPostPluginOptions) {
    super(...arguments);

    if (!options.apiToken) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "InPost module: missing required option `apiToken`"
      );
    }
    if (!options.organizationId) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "InPost module: missing required option `organizationId`"
      );
    }

    this.logger = deps.logger;
    this.client = new InPostShipXClient(options);
  }

  private crud(): InPostShipmentCrud {
    return this as unknown as InPostShipmentCrud;
  }

  async upsertShipmentFromFulfillment(
    input: UpsertInPostShipmentInput
  ): Promise<InPostShipmentRecord> {
    const existing = await this.crud().listInpostShipments(
      { shipment_id: input.shipment_id },
      { take: 1 }
    );

    if (existing[0]) {
      return this.crud().updateInpostShipments({
        id: existing[0].id,
        ...input,
      });
    }

    return this.crud().createInpostShipments(input);
  }

  async refreshShipmentStatus(id: string): Promise<InPostShipmentRecord> {
    const localShipment = await this.crud().retrieveInpostShipment(id);

    try {
      const remoteShipment = await this.client.getShipment(
        toShipmentIdNumber(localShipment.shipment_id)
      );

      return this.crud().updateInpostShipments({
        id,
        status: remoteShipment.status,
        tracking_number:
          remoteShipment.tracking_number || localShipment.tracking_number,
        service_type: remoteShipment.service || localShipment.service_type,
        last_synced_at: new Date(),
        last_error: null,
        raw_response: remoteShipment as unknown as Record<string, unknown>,
      });
    } catch (error) {
      await this.crud().updateInpostShipments({
        id,
        last_synced_at: new Date(),
        last_error: errorMessage(error),
      });

      throw error;
    }
  }

  async getShipmentLabel(
    id: string,
    format?: InPostLabelFormat
  ): Promise<{
    buffer: Buffer;
    format: InPostLabelFormat;
    shipment_id: string;
  }> {
    const localShipment = await this.crud().retrieveInpostShipment(id);
    const labelFormat = format || localShipment.label_format || "pdf";
    const buffer = await this.client.getLabel(
      toShipmentIdNumber(localShipment.shipment_id),
      labelFormat
    );

    return {
      buffer,
      format: labelFormat,
      shipment_id: localShipment.shipment_id,
    };
  }

  async cancelShipment(id: string): Promise<InPostShipmentRecord> {
    const localShipment = await this.crud().retrieveInpostShipment(id);
    const remoteShipment = await this.client.getShipment(
      toShipmentIdNumber(localShipment.shipment_id)
    );

    if (!CANCELLABLE_STATUSES.has(remoteShipment.status)) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        `InPost shipment ${localShipment.shipment_id} is in status "${remoteShipment.status}" and cannot be cancelled via API`
      );
    }

    await this.client.cancelShipment(
      toShipmentIdNumber(localShipment.shipment_id)
    );

    return this.crud().updateInpostShipments({
      id,
      status: "canceled",
      last_synced_at: new Date(),
      last_error: null,
      raw_response: remoteShipment as unknown as Record<string, unknown>,
    });
  }

  async listActiveShipments(limit = 50): Promise<InPostShipmentRecord[]> {
    const shipments = await this.crud().listInpostShipments(
      {},
      {
        take: limit,
        order: { updated_at: "ASC" },
      }
    );

    return shipments.filter((shipment) => !FINAL_STATUSES.has(shipment.status));
  }

  async listShipments(
    filters: Record<string, unknown> = {},
    config: Record<string, unknown> = {}
  ): Promise<[InPostShipmentRecord[], number]> {
    return this.crud().listAndCountInpostShipments(filters, config);
  }

  async retrieveShipment(id: string): Promise<InPostShipmentRecord> {
    return this.crud().retrieveInpostShipment(id);
  }
}

export default InPostModuleService;
