import { Injectable } from '@angular/core';
import {
  decodeToken,
  lintToken,
  type DecodedToken,
  type DecodeError,
  type Result,
  type LintFinding,
} from 'jwt-lab';

/**
 * Angular service wrapping jwt-lab's browser-compatible APIs.
 *
 * These functions work in the browser because jwt-lab uses universal
 * Web APIs (atob, TextDecoder, Web Crypto) — no Node.js Buffer required.
 */
@Injectable({ providedIn: 'root' })
export class JwtService {
  /**
   * Decode a JWT without verifying its signature.
   * Works identically to jwt-decode but returns a typed Result.
   */
  decode(token: string): Result<DecodedToken, DecodeError> {
    return decodeToken(token);
  }

  /**
   * Extract only the payload from a JWT.
   * Returns an empty object on error — safe for template binding.
   */
  extractPayload(token: string): Record<string, unknown> {
    const result = decodeToken(token);
    return result.ok ? result.value.payload : {};
  }

  /**
   * Extract header claims from a JWT.
   */
  extractHeader(token: string): Record<string, unknown> {
    const result = decodeToken(token);
    return result.ok ? result.value.header : {};
  }

  /**
   * Check if a token has expired based on its `exp` claim.
   */
  isExpired(token: string): boolean {
    const result = decodeToken(token);
    if (!result.ok) return true;
    const exp = result.value.payload['exp'];
    if (typeof exp !== 'number') return false;
    return exp * 1000 < Date.now();
  }

  /**
   * Get human-readable expiration info.
   */
  getExpiryInfo(token: string): string {
    const result = decodeToken(token);
    if (!result.ok) return 'Invalid token';
    const exp = result.value.payload['exp'];
    if (typeof exp !== 'number') return 'No expiration set';
    const expiresAt = new Date(exp * 1000);
    const diff = exp * 1000 - Date.now();
    if (diff < 0) {
      return `Expired ${new Date(exp * 1000).toLocaleString()} (${Math.abs(Math.round(diff / 60000))}m ago)`;
    }
    return `Expires ${expiresAt.toLocaleString()} (in ${Math.round(diff / 60000)}m)`;
  }

  /**
   * Run security lint checks on a decoded token.
   */
  lint(token: string): LintFinding[] {
    const result = decodeToken(token);
    if (!result.ok) return [];
    return lintToken(result.value, {});
  }
}
