import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  DEFAULT_RETURN_TOKEN_TTL_MINUTES,
  createInPostReturnSessionToken,
  getInPostReturnSessionExpiresAt,
  hashInPostReturnSessionToken,
  isInPostReturnSessionActive,
  normalizeReturnTokenTtlMinutes,
} from "../return-sessions"

describe("InPost return sessions", () => {
  it("normalizes invalid token TTL values to the default", () => {
    assert.equal(
      normalizeReturnTokenTtlMinutes(undefined),
      DEFAULT_RETURN_TOKEN_TTL_MINUTES
    )
    assert.equal(normalizeReturnTokenTtlMinutes(0), DEFAULT_RETURN_TOKEN_TTL_MINUTES)
    assert.equal(
      normalizeReturnTokenTtlMinutes(-10),
      DEFAULT_RETURN_TOKEN_TTL_MINUTES
    )
  })

  it("floors valid token TTL values", () => {
    assert.equal(normalizeReturnTokenTtlMinutes(15.9), 15)
  })

  it("creates URL-safe random tokens and stable SHA-256 hashes", () => {
    const token = createInPostReturnSessionToken()
    const hash = hashInPostReturnSessionToken(token)

    assert.match(token, /^[A-Za-z0-9_-]+$/)
    assert.equal(hash.length, 64)
    assert.equal(hash, hashInPostReturnSessionToken(token))
  })

  it("calculates and validates expiration dates", () => {
    const now = new Date("2026-05-17T10:00:00.000Z")
    const expiresAt = getInPostReturnSessionExpiresAt(30, now)

    assert.equal(expiresAt.toISOString(), "2026-05-17T10:30:00.000Z")
    assert.equal(
      isInPostReturnSessionActive(
        expiresAt,
        new Date("2026-05-17T10:29:59.000Z")
      ),
      true
    )
    assert.equal(
      isInPostReturnSessionActive(
        expiresAt,
        new Date("2026-05-17T10:30:00.000Z")
      ),
      false
    )
  })
})
