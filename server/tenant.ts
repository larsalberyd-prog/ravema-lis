import { eq } from "drizzle-orm";

/**
 * Tenant-isolering (Order 3, multi-tenant-grunden).
 *
 * All tenant-ägd data bär en `tenantId`. Varje läsning scopas med tenantCond
 * (WHERE tenantId = ?), och assertOnlyTenant är en runtime-vakt som kastar om
 * en främmande tenants rad ändå skulle slinka med — så ett isoleringsbrott
 * failar hårt i stället för att läcka tyst.
 *
 * Invarianten (tenant A kan aldrig läsa tenant B:s data) bevisas i
 * tenant-isolation.test.ts och körs i CI.
 */
export const DEFAULT_TENANT = 1; // Ravemas egna instans tills multi-tenant-resolvern är på

/** Drizzle-villkor: scopa en tabell (med tenantId-kolumn) till en tenant. */
export function tenantCond(table: any, tenantId: number) {
  return eq(table.tenantId, tenantId);
}

/** Ren filtrering (testbar): returnera endast rader för tenant. */
export function onlyTenant<T extends { tenantId?: number | null }>(rows: T[], tenantId: number): T[] {
  return rows.filter((r) => (r.tenantId ?? DEFAULT_TENANT) === tenantId);
}

/** Runtime-vakt: kasta om någon rad tillhör fel tenant (fångar läckor). */
export function assertOnlyTenant<T extends { tenantId?: number | null }>(rows: T[], tenantId: number): T[] {
  for (const r of rows) {
    if (r.tenantId != null && r.tenantId !== tenantId) {
      throw new Error(`Tenant-isoleringsbrott: rad tillhör tenant ${r.tenantId}, förväntade ${tenantId}`);
    }
  }
  return rows;
}
