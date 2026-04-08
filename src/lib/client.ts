import { MedusaError } from "@medusajs/framework/utils";
import {
  InPostPluginOptions,
  InPostShipmentRequest,
  InPostShipmentResponse,
} from "./types";

const SANDBOX_BASE_URL = "https://sandbox-api-shipx-pl.easypack24.net";
const PRODUCTION_BASE_URL = "https://api-shipx-pl.easypack24.net";

export class InPostShipXClient {
  private apiToken: string;
  private baseUrl: string;
  private organizationId: string;

  constructor(options: InPostPluginOptions) {
    this.baseUrl = options.sandbox ? SANDBOX_BASE_URL : PRODUCTION_BASE_URL;
    this.organizationId = options.organizationId;
    this.apiToken = options.apiToken;
  }

  private async request<T>(
    method: "GET" | "POST" | "DELETE",
    path: string,
    body?: unknown,
    responseType: "json" | "buffer" = "json"
  ): Promise<T> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiToken}`,
      "Content-Type": "application/json",
    };

    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `InPost API error: ${response.status} ${response.statusText}`;

      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.details) {
          errorMessage += ` - ${JSON.stringify(errorJson.details)}`;
        } else if (errorJson.message) {
          errorMessage += ` - ${errorJson.message}`;
        } else if (errorJson.error) {
          errorMessage += ` - ${errorJson.error}`;
        } else {
          errorMessage += ` - ${errorText}`;
        }
      } catch {
        if (errorText) {
          errorMessage += ` - ${errorText}`;
        }
      }

      if (response.status === 401 || response.status === 403) {
        throw new MedusaError(MedusaError.Types.NOT_ALLOWED, errorMessage);
      }
      if (response.status === 404) {
        throw new MedusaError(MedusaError.Types.NOT_FOUND, errorMessage);
      }
      if (response.status === 422) {
        throw new MedusaError(MedusaError.Types.INVALID_DATA, errorMessage);
      }

      throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, errorMessage);
    }

    if (responseType === "buffer") {
      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer) as unknown as T;
    }

    if (response.status === 204) {
      return undefined as unknown as T;
    }

    return response.json() as Promise<T>;
  }

  async createShipment(
    data: InPostShipmentRequest
  ): Promise<InPostShipmentResponse> {
    return this.request<InPostShipmentResponse>(
      "POST",
      `/v1/organizations/${this.organizationId}/shipments`,
      data
    );
  }

  async buyShipment(
    id: number,
    offerId: number
  ): Promise<InPostShipmentResponse> {
    return this.request<InPostShipmentResponse>(
      "POST",
      `/v1/shipments/${id}/buy`,
      { offer_id: offerId }
    );
  }

  async getShipment(id: number): Promise<InPostShipmentResponse> {
    return this.request<InPostShipmentResponse>(
      "GET",
      `/v1/shipments/${id}`
    );
  }

  async cancelShipment(id: number): Promise<void> {
    return this.request<void>(
      "DELETE",
      `/v1/shipments/${id}`
    );
  }

  async getLabel(id: number, format: "pdf" | "zpl" = "pdf"): Promise<Buffer> {
    return this.request<Buffer>(
      "GET",
      `/v1/shipments/${id}/label?format=${format}`,
      undefined,
      "buffer"
    );
  }

  async createDispatchOrder(
    shipmentIds: number[],
    address: {
      street: string;
      building_number: string;
      city: string;
      post_code: string;
      country_code?: string;
    },
    comment?: string
  ): Promise<{ id: number; status: string }> {
    return this.request<{ id: number; status: string }>(
      "POST",
      `/v1/organizations/${this.organizationId}/dispatch_orders`,
      {
        shipments: shipmentIds,
        address,
        ...(comment && { comment }),
      }
    );
  }

}
