import { describe, it, expect } from "vitest";
import { parseDuration, addDuration } from "../../src/core/duration.js";

describe("parseDuration", () => {
  it("parses seconds", () => {
    const result = parseDuration("30s");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(30);
  });

  it("parses minutes", () => {
    const result = parseDuration("5m");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(300);
  });

  it("parses hours", () => {
    const result = parseDuration("2h");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(7200);
  });

  it("parses days", () => {
    const result = parseDuration("7d");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(604800);
  });

  it("parses weeks", () => {
    const result = parseDuration("2w");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(1209600);
  });

  it("parses compound durations", () => {
    const result = parseDuration("1h30m");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(5400);
  });

  it("parses complex compound durations", () => {
    const result = parseDuration("2d12h30m15s");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(2 * 86400 + 12 * 3600 + 30 * 60 + 15);
  });

  it("returns Err for empty string", () => {
    const result = parseDuration("");
    expect(result.ok).toBe(false);
  });

  it("returns Err for invalid strings", () => {
    const result = parseDuration("abc");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.input).toBe("abc");
  });

  it("returns Err for number without unit", () => {
    const result = parseDuration("123");
    expect(result.ok).toBe(false);
  });
});

describe("addDuration", () => {
  it("adds hours to a date", () => {
    const base = new Date("2024-01-01T00:00:00Z");
    const result = addDuration(base, "1h");
    expect(result.toISOString()).toBe("2024-01-01T01:00:00.000Z");
  });

  it("throws for invalid duration", () => {
    expect(() => addDuration(new Date(), "xyz")).toThrow();
  });
});
