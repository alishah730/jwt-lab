/**
 * Table-based formatters for JWT CLI output using cli-table3.
 */

import Table from "cli-table3";
import type { LintFinding, InspectResult } from "../core/types.js";

/** Severity emoji prefixes for table display. */
const SEVERITY_EMOJI: Record<LintFinding["severity"], string> = {
  error: "❌",
  warn: "⚠️ ",
  info: "ℹ️ ",
};

/**
 * Builds a formatted table of lint findings.
 *
 * @param findings - Array of lint findings to display.
 * @returns A string representation of the findings table.
 */
export function buildFindingsTable(findings: LintFinding[]): string {
  if (findings.length === 0) {
    return "No lint findings.";
  }

  const table = new Table({
    head: ["Severity", "Rule ID", "Description", "Suggested Fix"],
    colWidths: [12, 20, 40, 40],
    wordWrap: true,
    style: { head: ["cyan"] },
  });

  for (const finding of findings) {
    table.push([
      `${SEVERITY_EMOJI[finding.severity]} ${finding.severity}`,
      finding.ruleId,
      finding.description,
      finding.suggestedFix,
    ]);
  }

  return table.toString();
}

/**
 * Builds a formatted table of token inspection metadata.
 *
 * @param inspection - The inspection result to display.
 * @returns A string representation of the inspection metadata table.
 */
export function buildInspectTable(inspection: InspectResult): string {
  const table = new Table({
    head: ["Field", "Value"],
    colWidths: [20, 60],
    wordWrap: true,
    style: { head: ["cyan"] },
  });

  table.push(["Status", inspection.status.replace(/_/g, " ")]);
  table.push(["Algorithm", inspection.algorithm]);

  if (inspection.kid !== undefined) table.push(["Key ID", inspection.kid]);
  if (inspection.issuer !== undefined) table.push(["Issuer", inspection.issuer]);
  if (inspection.subject !== undefined) table.push(["Subject", inspection.subject]);

  if (inspection.audience !== undefined) {
    const aud = Array.isArray(inspection.audience)
      ? inspection.audience.join(", ")
      : inspection.audience;
    table.push(["Audience", aud]);
  }

  if (inspection.issuedAt !== undefined) {
    const d = inspection.issuedAt;
    table.push(["Issued At", `${d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} · ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true })}`]);
  }
  if (inspection.expiresAt !== undefined) {
    const d = inspection.expiresAt;
    table.push(["Expires At", `${d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} · ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true })}`]);
  }
  if (inspection.notBefore !== undefined) {
    const d = inspection.notBefore;
    table.push(["Not Before", `${d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} · ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true })}`]);
  }
  if (inspection.timeUntilExpiry !== undefined) {
    const label =
      inspection.timeUntilExpiry >= 0 ? "Expires In (s)" : "Expired (s ago)";
    table.push([label, String(Math.abs(inspection.timeUntilExpiry))]);
  }

  const customKeys = Object.keys(inspection.customClaims);
  for (const key of customKeys) {
    table.push([`custom: ${key}`, JSON.stringify(inspection.customClaims[key])]);
  }

  return table.toString();
}
