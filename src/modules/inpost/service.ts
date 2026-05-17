import { Logger } from "@medusajs/framework/types";
import { MedusaError, MedusaService } from "@medusajs/framework/utils";
import {
  INPOST_FINAL_SHIPMENT_STATUSES,
  InPostLocalShipmentRecord,
  UpsertInPostShipmentInput,
  canCancelInPostShipmentViaApi,
} from "../../lib/admin-shipments";
import { InPostShipXClient } from "../../lib/client";
import { normalizeReturnTokenTtlMinutes } from "../../lib/return-sessions";
import {
  CreateInPostReturnInput,
  CreateInPostReturnItemInput,
  InPostLocalReturnItemRecord,
  InPostLocalReturnRecord,
  UpdateInPostReturnInput,
  UpdateInPostReturnItemInput,
} from "../../lib/returns";
import { InPostLabelFormat, InPostPluginOptions } from "../../lib/types";
import InpostReturn from "./models/inpost-return";
import InpostReturnItem from "./models/inpost-return-item";
import InpostShipment from "./models/inpost-shipment";

export type InPostShipmentRecord = InPostLocalShipmentRecord<Date>;
export type InPostReturnRecord = InPostLocalReturnRecord<Date>;
export type InPostReturnItemRecord = InPostLocalReturnItemRecord<Date>;

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

type InPostReturnCrud = {
  createInpostReturns(
    data: CreateInPostReturnInput
  ): Promise<InPostReturnRecord>;
  listInpostReturns(
    filters?: Record<string, unknown>,
    config?: Record<string, unknown>
  ): Promise<InPostReturnRecord[]>;
  listAndCountInpostReturns(
    filters?: Record<string, unknown>,
    config?: Record<string, unknown>
  ): Promise<[InPostReturnRecord[], number]>;
  retrieveInpostReturn(
    id: string,
    config?: Record<string, unknown>
  ): Promise<InPostReturnRecord>;
  updateInpostReturns(
    data:
      | UpdateInPostReturnInput
      | {
          selector: Record<string, unknown>;
          data: Partial<CreateInPostReturnInput>;
        }
  ): Promise<InPostReturnRecord>;
  createInpostReturnItems(
    data: CreateInPostReturnItemInput | CreateInPostReturnItemInput[]
  ): Promise<InPostReturnItemRecord | InPostReturnItemRecord[]>;
  listInpostReturnItems(
    filters?: Record<string, unknown>,
    config?: Record<string, unknown>
  ): Promise<InPostReturnItemRecord[]>;
  listAndCountInpostReturnItems(
    filters?: Record<string, unknown>,
    config?: Record<string, unknown>
  ): Promise<[InPostReturnItemRecord[], number]>;
  retrieveInpostReturnItem(
    id: string,
    config?: Record<string, unknown>
  ): Promise<InPostReturnItemRecord>;
  updateInpostReturnItems(
    data:
      | UpdateInPostReturnItemInput
      | {
          selector: Record<string, unknown>;
          data: Partial<CreateInPostReturnItemInput>;
        }
  ): Promise<InPostReturnItemRecord>;
};

const FINAL_STATUSES: ReadonlySet<string> = new Set(
  INPOST_FINAL_SHIPMENT_STATUSES
);

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
  InpostReturn,
  InpostReturnItem,
  InpostShipment,
}) {
  private client: InPostShipXClient;
  private logger: Logger;
  private returnTokenTtlMinutes: number;

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
    this.returnTokenTtlMinutes = normalizeReturnTokenTtlMinutes(
      options.returnTokenTtlMinutes
    );
  }

  private crud(): InPostShipmentCrud {
    return this as unknown as InPostShipmentCrud;
  }

  private returnCrud(): InPostReturnCrud {
    return this as unknown as InPostReturnCrud;
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

  async refreshShipmentData(id: string): Promise<InPostShipmentRecord> {
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

    if (!canCancelInPostShipmentViaApi(remoteShipment.status)) {
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

  getReturnTokenTtlMinutes(): number {
    return this.returnTokenTtlMinutes;
  }

  async createReturn(input: CreateInPostReturnInput): Promise<InPostReturnRecord> {
    return this.returnCrud().createInpostReturns({
      status: "requested",
      ...input,
    });
  }

  async updateReturn(input: UpdateInPostReturnInput): Promise<InPostReturnRecord> {
    return this.returnCrud().updateInpostReturns(input);
  }

  async retrieveReturn(id: string): Promise<InPostReturnRecord> {
    return this.returnCrud().retrieveInpostReturn(id);
  }

  async listReturns(
    filters: Record<string, unknown> = {},
    config: Record<string, unknown> = {}
  ): Promise<[InPostReturnRecord[], number]> {
    return this.returnCrud().listAndCountInpostReturns(filters, config);
  }

  async createReturnItems(
    input: CreateInPostReturnItemInput[]
  ): Promise<InPostReturnItemRecord[]> {
    const items = await this.returnCrud().createInpostReturnItems(input);
    return Array.isArray(items) ? items : [items];
  }

  async listReturnItems(
    filters: Record<string, unknown>,
    config: Record<string, unknown> = {}
  ): Promise<InPostReturnItemRecord[]> {
    return this.returnCrud().listInpostReturnItems(filters, config);
  }
}

export default InPostModuleService;
