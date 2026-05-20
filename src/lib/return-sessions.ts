import { createHash, randomBytes } from "node:crypto"

export const DEFAULT_RETURN_TOKEN_TTL_MINUTES = 60
export const RETURN_SESSION_TOKEN_BYTES = 32

export function normalizeReturnTokenTtlMinutes(value?: number): number {
  if (!Number.isFinite(value) || !value || value <= 0) {
    return DEFAULT_RETURN_TOKEN_TTL_MINUTES
  }

  return Math.floor(value)
}

export function createInPostReturnSessionToken(): string {
  return randomBytes(RETURN_SESSION_TOKEN_BYTES).toString("base64url")
}

export function hashInPostReturnSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}

export function buildInPostReturnMagicLink(
  baseUrl: string,
  token: string
): string {
  const url = new URL(baseUrl)
  url.searchParams.set("token", token)

  return url.toString()
}

export function getInPostReturnSessionExpiresAt(
  ttlMinutes: number,
  now = new Date()
): Date {
  return new Date(now.getTime() + ttlMinutes * 60 * 1000)
}

export function isInPostReturnSessionActive(
  expiresAt: Date | string | null,
  now = new Date()
): boolean {
  if (!expiresAt) {
    return false
  }

  const date = expiresAt instanceof Date ? expiresAt : new Date(expiresAt)

  return !Number.isNaN(date.getTime()) && date.getTime() > now.getTime()
}
