import { describe, it, expect } from "vitest";
import { onlyTenant, assertOnlyTenant } from "./tenant";

describe("Tenant-isolering (Order 3)", () => {
  const rows = [
    { id: 1, tenantId: 1, name: "A-bolag" },
    { id: 2, tenantId: 2, name: "B-bolag (hemligt)" },
    { id: 3, tenantId: 1, name: "A-bolag 2" },
  ];

  it("tenant A ser BARA tenant A:s rader — aldrig tenant B:s", () => {
    const a = onlyTenant(rows, 1);
    expect(a.map((r) => r.id)).toEqual([1, 3]);
    expect(a.some((r) => r.tenantId === 2)).toBe(false);
  });

  it("tenant B ser bara tenant B", () => {
    expect(onlyTenant(rows, 2).map((r) => r.id)).toEqual([2]);
  });

  it("assertOnlyTenant FAILAR hårt om en främmande tenant-rad läcker (fångar regression)", () => {
    // Osanerad åtkomst (alla rader) som tenant 1 → ska kasta.
    expect(() => assertOnlyTenant(rows, 1)).toThrow(/isoleringsbrott/i);
    // Korrekt scopad åtkomst → ska inte kasta.
    expect(() => assertOnlyTenant(onlyTenant(rows, 1), 1)).not.toThrow();
  });
});
