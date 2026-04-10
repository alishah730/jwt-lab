import { type Result, type DurationError, ok, err } from "./types.js";

/** Multipliers in seconds for each supported duration unit. */
const UNIT_MULTIPLIERS: Record<string, number> = {
  s: 1,
  m: 60,
  h: 3600,
  d: 86400,
  w: 604800,
};

/** Regex that matches a single duration group, e.g. "30s", "2h". */
const DURATION_GROUP_RE = /(\d+)([smhdw])/g;

/**
 * Parses a human-readable duration string into seconds.
 *
 * Supports single-unit formats: `"30s"`, `"5m"`, `"2h"`, `"7d"`, `"2w"`.
 * Supports compound formats: `"1h30m"`, `"2d12h"`.
 *
 * @param input - The duration string to parse.
 * @returns `Ok(totalSeconds)` on success, or `Err(DurationError)` when no
 *   valid duration groups are found in a non-empty string.
 *
 * @example
 * parseDuration("1h30m") // Ok(5400)
 * parseDuration("7d")    // Ok(604800)
 * parseDuration("bad")   // Err({ message: ..., input: "bad" })
 */
export function parseDuration(input: string): Result<number, DurationError> {
  const matches = [...input.matchAll(DURATION_GROUP_RE)];

  if (matches.length === 0) {
    return err({
      message: `Invalid duration string: "${input}". Expected format like "30s", "5m", "2h", "7d", "2w", or compound "1h30m".`,
      input,
    });
  }

  let totalSeconds = 0;
  for (const match of matches) {
    const value = parseInt(match[1], 10);
    const unit = match[2];
    totalSeconds += value * (UNIT_MULTIPLIERS[unit] ?? 0);
  }

  return ok(totalSeconds);
}

/**
 * Adds a duration string to a `Date`, returning a new `Date`.
 *
 * @param date - The base date to add the duration to.
 * @param duration - A human-readable duration string (e.g. `"1h30m"`, `"7d"`).
 * @returns A new `Date` offset by the parsed duration.
 * @throws {Error} If the duration string is invalid.
 *
 * @example
 * addDuration(new Date(), "1h") // Date one hour from now
 */
export function addDuration(date: Date, duration: string): Date {
  const result = parseDuration(duration);
  if (!result.ok) {
    throw new Error(result.error.message);
  }
  return new Date(date.getTime() + result.value * 1000);
}
