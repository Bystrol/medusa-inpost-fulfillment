import { MedusaError } from "@medusajs/framework/utils"
import {
  InPostCreateReturnTicketRequest,
  InPostCreateReturnTicketResponse,
  InPostReturnTicketListQuery,
  InPostReturnTicketListResponse,
} from "./returns"
import { InPostPluginOptions } from "./types"

const SANDBOX_API_BASE_URL = "https://sandbox-api.inpost.pl"
const PRODUCTION_API_BASE_URL = "https://api.inpost.pl"
const SANDBOX_AUTH_BASE_URL = "https://sandbox-login.inpost.pl"
const PRODUCTION_AUTH_BASE_URL = "https://login.inpost.pl"
const TOKEN_REFRESH_BUFFER_MS = 30_000

type InPostReturnsTokenResponse = {
  access_token: string
  expires_in: number
  token_type: string
}

type CachedToken = {
  accessToken: string
  expiresAt: number
}

function buildInPostReturnsError(prefix: string, response: Response, body: string): string {
  let message = `${prefix}: ${response.status} ${response.statusText}`

  try {
    const json = JSON.parse(body)
    if (json.message) {
      message += ` - ${json.message}`
    } else if (json.error_description) {
      message += ` - ${json.error_description}`
    } else if (json.error) {
      message += ` - ${json.error}`
    } else {
      message += ` - ${body}`
    }
  } catch {
    if (body) {
      message += ` - ${body}`
    }
  }

  return message
}

function throwInPostReturnsError(
  prefix: string,
  response: Response,
  body: string
): never {
  const message = buildInPostReturnsError(prefix, response, body)

  if (response.status === 401 || response.status === 403) {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, message)
  }
  if (response.status === 404) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, message)
  }
  if (response.status === 400 || response.status === 422) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, message)
  }
  if (response.status === 429) {
    throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, message)
  }

  throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, message)
}

export class InPostReturnsClient {
  private apiBaseUrl: string
  private authBaseUrl: string
  private clientId?: string
  private clientSecret?: string
  private cachedToken?: CachedToken

  constructor(options: InPostPluginOptions) {
    this.apiBaseUrl = options.sandbox
      ? SANDBOX_API_BASE_URL
      : PRODUCTION_API_BASE_URL
    this.authBaseUrl = options.sandbox
      ? SANDBOX_AUTH_BASE_URL
      : PRODUCTION_AUTH_BASE_URL
    this.clientId = options.returns?.clientId
    this.clientSecret = options.returns?.clientSecret
  }

  isConfigured(): boolean {
    return Boolean(this.clientId && this.clientSecret)
  }

  private getCredentials(): { clientId: string; clientSecret: string } {
    if (!this.clientId || !this.clientSecret) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "InPost Returns API: missing required returns.clientId or returns.clientSecret configuration"
      )
    }

    return {
      clientId: this.clientId,
      clientSecret: this.clientSecret,
    }
  }

  private async getAccessToken(): Promise<string> {
    const credentials = this.getCredentials()

    if (
      this.cachedToken &&
      this.cachedToken.expiresAt - TOKEN_REFRESH_BUFFER_MS > Date.now()
    ) {
      return this.cachedToken.accessToken
    }

    const body = new URLSearchParams({
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
      grant_type: "client_credentials",
    })
    const response = await fetch(
      `${this.authBaseUrl}/auth/realms/external/protocol/openid-connect/token`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
      }
    )
    const text = await response.text()

    if (!response.ok) {
      throwInPostReturnsError("InPost Returns API auth error", response, text)
    }

    const token = JSON.parse(text) as InPostReturnsTokenResponse

    this.cachedToken = {
      accessToken: token.access_token,
      expiresAt: Date.now() + token.expires_in * 1000,
    }

    return this.cachedToken.accessToken
  }

  private async request<T>(
    method: "GET" | "POST",
    path: string,
    body?: unknown,
    responseType: "json" | "buffer" = "json",
    headers: Record<string, string> = {}
  ): Promise<T> {
    const accessToken = await this.getAccessToken()
    const response = await fetch(`${this.apiBaseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })

    if (!response.ok) {
      throwInPostReturnsError(
        "InPost Returns API error",
        response,
        await response.text()
      )
    }

    if (responseType === "buffer") {
      const arrayBuffer = await response.arrayBuffer()
      return Buffer.from(arrayBuffer) as unknown as T
    }

    if (response.status === 204) {
      return undefined as unknown as T
    }

    return response.json() as Promise<T>
  }

  async createReturnTicket(
    data: InPostCreateReturnTicketRequest
  ): Promise<InPostCreateReturnTicketResponse> {
    return this.request<InPostCreateReturnTicketResponse>(
      "POST",
      "/v1/returns/tickets",
      data
    )
  }

  async listReturnTickets(
    query: InPostReturnTicketListQuery
  ): Promise<InPostReturnTicketListResponse> {
    const searchParams = new URLSearchParams()

    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        searchParams.set(key, String(value))
      }
    })

    return this.request<InPostReturnTicketListResponse>(
      "GET",
      `/v1/returns/tickets?${searchParams.toString()}`,
      undefined,
      "json",
      {
        "Accept-Time-Zone": "Europe/Warsaw",
      }
    )
  }

  async getReturnLabel(id: string): Promise<Buffer> {
    return this.request<Buffer>(
      "GET",
      `/v1/returns/tickets/${encodeURIComponent(id)}/label`,
      undefined,
      "buffer"
    )
  }
}
