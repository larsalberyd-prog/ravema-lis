import { eq, like, or, desc, and, sql, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser, users, companies, contacts, generatedEmails, activities, webhookLogs, weeklyAssignments,
  signals, icpChanges, generatedPacks, discoverySessions, tenantSettings,
  InsertCompany, InsertContact, InsertGeneratedEmail,
} from "../drizzle/schema";
import { ENV } from "./_core/env";
import { DEFAULT_TENANT, tenantCond, assertOnlyTenant } from "./tenant";

let _db: ReturnType<typeof drizzle> | null = null;

/**
 * Drizzle/mysql2 returnerar insert-resultat som en tuple [ResultSetHeader, FieldPacket[]]
 * (se node_modules/drizzle-orm/mysql2/session.d.ts). Auto-increment-id:t ligger alltså
 * på res[0].insertId — INTE res.insertId. Att läsa res.insertId gav tidigare alltid 0,
 * vilket orphanade kontakter/signaler till companyId=0 vid seeding. Defensiv: hanterar
 * både tuple- och objekt-form ifall drivern/versionen ändras.
 */
export function insertIdOf(res: any): number {
  const header = Array.isArray(res) ? res[0] : res;
  return Number(header?.insertId ?? 0);
}

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try { _db = drizzle(process.env.DATABASE_URL); }
    catch (error) { console.warn("[Database] Failed to connect:", error); _db = null; }
  }
  return _db;
}

// ─── Users ───────────────────────────────────────────────────────────────────
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) { console.warn("[Database] Cannot upsert user: database not available"); return; }
  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;
  type TextField = (typeof textFields)[number];
  const assignNullable = (field: TextField) => {
    const value = user[field];
    if (value === undefined) return;
    const normalized = value ?? null;
    values[field] = normalized;
    updateSet[field] = normalized;
  };
  textFields.forEach(assignNullable);
  if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
  if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
  else if (user.openId === ENV.ownerOpenId) { values.role = "admin"; updateSet.role = "admin"; }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) { console.warn("[Database] Cannot get user: database not available"); return undefined; }
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getAllUsers() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users).orderBy(users.name);
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function updateUserRole(id: number, role: "user" | "admin") {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set({ role }).where(eq(users.id, id));
}

// ─── Companies ───────────────────────────────────────────────────────────────
export async function getAllCompanies(tenantId: number = DEFAULT_TENANT) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(companies).where(tenantCond(companies, tenantId)).orderBy(
    sql`FIELD(focus, 'AAA', 'AA', 'A', 'B', 'C', '')`,
    companies.name
  );
  return assertOnlyTenant(rows as any[], tenantId);
}

export async function getCompanyById(id: number, tenantId: number = DEFAULT_TENANT) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(companies).where(and(eq(companies.id, id), tenantCond(companies, tenantId))).limit(1);
  return result[0] ?? null;
}

export async function updateCompanyDescription(id: number, description: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(companies).set({ description, updatedAt: new Date() }).where(eq(companies.id, id));
}

export async function getGeneratedEmailCount(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const rows = await db.select({ c: sql<number>`count(*)` }).from(generatedEmails);
  return Number((rows[0] as any)?.c ?? 0);
}

export async function searchCompanies(query: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(companies).where(
    or(like(companies.name, `%${query}%`), like(companies.city, `%${query}%`), like(companies.category, `%${query}%`), like(companies.domain, `%${query}%`))
  );
}

export async function upsertCompany(data: InsertCompany): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (data.domain && data.domain !== "UNABLE_TO_FIND") {
    const existing = await db.select().from(companies).where(eq(companies.domain, data.domain)).limit(1);
    if (existing.length > 0) {
      await db.update(companies).set({ ...data, updatedAt: new Date() }).where(eq(companies.id, existing[0].id));
      return existing[0].id;
    }
  }
  const result = await db.insert(companies).values(data);
  return insertIdOf(result);
}

export async function updateCompanyStatus(id: number, status: "new" | "contacted" | "meeting" | "qualified" | "lost", assignedTo?: string, notes?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(companies).set({ status, ...(assignedTo !== undefined ? { assignedTo } : {}), ...(notes !== undefined ? { notes } : {}), updatedAt: new Date() }).where(eq(companies.id, id));
}

export async function assignCompanyToUser(companyId: number, userId: number | null, userName: string | null) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(companies).set({ assignedToUserId: userId, assignedToName: userName, updatedAt: new Date() }).where(eq(companies.id, companyId));
}

export async function getCompaniesByAssignedUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(companies).where(eq(companies.assignedToUserId, userId)).orderBy(
    sql`FIELD(focus, 'AAA', 'AA', 'A', 'B', 'C', '')`,
    companies.name
  );
}

export async function getUnassignedCompanies() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(companies).where(isNull(companies.assignedToUserId)).orderBy(
    sql`FIELD(focus, 'AAA', 'AA', 'A', 'B', 'C', '')`,
    companies.name
  );
}

// ─── Signals ─────────────────────────────────────────────────────────────────
export async function getSignalsByCompanyId(companyId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(signals).where(eq(signals.companyId, companyId)).orderBy(desc(signals.detectedAt));
}

export async function getAllSignals() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(signals).orderBy(desc(signals.detectedAt));
}

export async function getCompanyBySlug(slug: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(companies).where(eq(companies.slug, slug)).limit(1);
  return result[0] ?? null;
}

// ─── Generated Intelligence Packs (intelligence.generate) ─────────────────────
export async function saveGeneratedPack(data: {
  companyId: number; role?: string; headlineHypothesis?: string; payload: any; generatedBy?: string;
}): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const res = await db.insert(generatedPacks).values({
    companyId: data.companyId,
    role: data.role,
    headlineHypothesis: (data.headlineHypothesis || "").slice(0, 500),
    payload: data.payload,
    generatedBy: data.generatedBy,
  });
  return insertIdOf(res);
}

export async function getPacksByCompanyId(companyId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(generatedPacks).where(eq(generatedPacks.companyId, companyId)).orderBy(desc(generatedPacks.createdAt));
}

export async function getLatestPack(companyId: number): Promise<any | null> {
  const rows = await getPacksByCompanyId(companyId);
  if (!rows.length) return null;
  const p: any = rows[0].payload;
  // MariaDB returnerar JSON-kolumner som strängar — parsa defensivt
  return typeof p === "string" ? JSON.parse(p) : p;
}

// ─── Discovery (SPAR) + reinforcement → LIS ───────────────────────────────────
export async function saveDiscoverySession(data: {
  companyId: number; role?: string; payload: any; createdBy?: string;
}): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const res = await db.insert(discoverySessions).values({
    companyId: data.companyId, role: data.role, payload: data.payload, createdBy: data.createdBy,
  });
  return insertIdOf(res);
}

export async function getLatestDiscovery(companyId: number): Promise<any | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(discoverySessions)
    .where(eq(discoverySessions.companyId, companyId)).orderBy(desc(discoverySessions.createdAt)).limit(1);
  if (!rows.length) return null;
  const p: any = rows[0].payload;
  return typeof p === "string" ? JSON.parse(p) : p;
}

// Återför en Discovery-insikt till LIS som en signal (reinforcement).
export async function addSignal(data: {
  companyId: number; signalType?: string; lisType?: string; source?: string; title?: string; detail?: string;
}): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(signals).values({
    companyId: data.companyId,
    signalType: (["job", "news", "funding", "ownership", "procurement", "engagement"].includes(String(data.signalType)) ? data.signalType : "engagement") as any,
    lisType: (data.lisType || "").slice(0, 64) || undefined,
    source: (data.source || "discovery").slice(0, 100),
    title: (data.title || "").slice(0, 500) || undefined,
    detail: data.detail || undefined,
  });
}

// ─── Tenant-fas (test / pilot / normal) — åtkomststyrning ─────────────────────
export type Phase = "test" | "pilot" | "normal";
export type ConfigStatus = "draft" | "reviewed" | "live";
export interface TenantPhase { accountPhase: Phase; testUnlockLimit: number; testStartedAt: Date | null; configStatus: ConfigStatus; }

// Config-granskningsgrind (Order 2): en tenant kan INTE gå till test-fas på en draft-config.
// Ren funktion (testbar utan DB) — ENDA källan för grind-logiken.
export function phaseTransitionError(targetPhase: Phase, configStatus: ConfigStatus): string | null {
  if (targetPhase === "test" && configStatus === "draft") {
    return "Config är i 'draft' och måste granskas (status 'reviewed') innan tenanten kan gå till test-fas.";
  }
  return null;
}

// Default för DENNA (Ravemas egna) instans = pilot (allt upplåst), config 'live' (gat:ar inte operatören).
const PHASE_DEFAULTS: TenantPhase = { accountPhase: "pilot", testUnlockLimit: 12, testStartedAt: null, configStatus: "live" };

export async function getTenantSettings(): Promise<TenantPhase> {
  const db = await getDb();
  if (!db) return PHASE_DEFAULTS;
  const rows = await db.select().from(tenantSettings).where(eq(tenantSettings.id, 1)).limit(1);
  if (!rows.length) {
    // Skapa default-rad första gången (test startar vid leverans)
    try { await db.insert(tenantSettings).values({ id: 1, accountPhase: "pilot", configStatus: "live", testUnlockLimit: 12 }); } catch {}
    return { ...PHASE_DEFAULTS };
  }
  const r: any = rows[0];
  return { accountPhase: r.accountPhase, testUnlockLimit: r.testUnlockLimit, testStartedAt: r.testStartedAt ?? null, configStatus: r.configStatus ?? "draft" };
}

export async function setTenantSettings(patch: Partial<TenantPhase>): Promise<TenantPhase> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const cur = await getTenantSettings();
  const next: any = { ...cur, ...patch };
  // test börjar räkna när man går in i test-läget om det inte redan startat
  if (next.accountPhase === "test" && !next.testStartedAt) next.testStartedAt = new Date();
  // Config-grind: blockera test-fas på draft-config.
  const gate = phaseTransitionError(next.accountPhase, next.configStatus);
  if (gate) throw new Error(gate);
  await db.update(tenantSettings).set({
    accountPhase: next.accountPhase, configStatus: next.configStatus,
    testUnlockLimit: next.testUnlockLimit, testStartedAt: next.testStartedAt, updatedAt: new Date(),
  }).where(eq(tenantSettings.id, 1));
  return next;
}

// Är ett konto låst? ENDA källan för låslogiken.
// I test-läget är de första `testUnlockLimit` i kanonisk ordning upplåsta; resten låsta.
// Normalisera lands-strängen (datan har både "SE"/"Sverige" och "NO"/"Norge").
export function normalizeCountry(c?: string | null): "SE" | "NO" | "OTHER" {
  const s = String(c || "").trim().toLowerCase();
  if (s === "se" || s === "sverige" || s === "sweden") return "SE";
  if (s === "no" || s === "norge" || s === "norway") return "NO";
  return "OTHER";
}

// Test-fasens erbjudande: lås upp N per land (12 svenska + 6 norska), resten låst.
// Vill man ändra fördelningen byts denna konstant (eller görs UI-konfigurerbar senare).
export const TEST_UNLOCK_BY_COUNTRY: Record<string, number> = { SE: 12, NO: 6 };

// ENDA källan för vilka konton som är upplåsta i test-läget. Plockar topp-N per land
// i kanonisk ordning (tier AAA→C, sedan namn — från getAllCompanies).
export async function getTestUnlockedIds(): Promise<Set<number>> {
  const all = await getAllCompanies();
  const counts: Record<string, number> = {};
  const ids = new Set<number>();
  for (const c of all as any[]) {
    const cc = normalizeCountry(c.country);
    const cap = TEST_UNLOCK_BY_COUNTRY[cc];
    if (cap == null) continue; // land utan kvot → låst
    counts[cc] = counts[cc] ?? 0;
    if (counts[cc] < cap) { ids.add(c.id); counts[cc]++; }
  }
  return ids;
}

export async function isCompanyLocked(companyId: number): Promise<boolean> {
  const s = await getTenantSettings();
  if (s.accountPhase !== "test") return false;
  const unlocked = await getTestUnlockedIds();
  return !unlocked.has(companyId);
}

// ─── ICP tier editing (Klas/Nejra validate Tier 1/2/3) ────────────────────────
export async function updateCompanyTier(input: {
  companyId: number;
  toTier?: number | null;
  toFocus?: string | null;
  changedByUserId?: number | null;
  changedByName?: string | null;
  reason?: string | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db.select({ icpTier: companies.icpTier, focus: companies.focus }).from(companies).where(eq(companies.id, input.companyId)).limit(1);
  const before = rows[0] ?? { icpTier: null, focus: null };
  await db.update(companies).set({
    ...(input.toTier !== undefined ? { icpTier: input.toTier } : {}),
    ...(input.toFocus !== undefined ? { focus: input.toFocus ?? undefined } : {}),
    updatedAt: new Date(),
  }).where(eq(companies.id, input.companyId));
  await db.insert(icpChanges).values({
    companyId: input.companyId,
    fromTier: before.icpTier ?? null,
    toTier: input.toTier ?? before.icpTier ?? null,
    fromFocus: before.focus ?? null,
    toFocus: input.toFocus ?? before.focus ?? null,
    changedByUserId: input.changedByUserId ?? null,
    changedByName: input.changedByName ?? null,
    reason: input.reason ?? null,
  });
  return { success: true };
}

export async function getIcpChangesByCompanyId(companyId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(icpChanges).where(eq(icpChanges.companyId, companyId)).orderBy(desc(icpChanges.createdAt));
}

// ─── Contacts ────────────────────────────────────────────────────────────────
export async function getContactsByCompanyId(companyId: number, tenantId: number = DEFAULT_TENANT) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(contacts).where(and(eq(contacts.companyId, companyId), tenantCond(contacts, tenantId)));
  return assertOnlyTenant(rows as any[], tenantId);
}

export async function getContactById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(contacts).where(eq(contacts.id, id)).limit(1);
  return result[0] ?? null;
}

export async function upsertContact(data: InsertContact): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (data.email) {
    const existing = await db.select().from(contacts).where(and(eq(contacts.companyId, data.companyId), eq(contacts.email, data.email))).limit(1);
    if (existing.length > 0) {
      await db.update(contacts).set({ ...data, updatedAt: new Date() }).where(eq(contacts.id, existing[0].id));
      return existing[0].id;
    }
  }
  const result = await db.insert(contacts).values(data);
  return insertIdOf(result);
}

export async function getAllContacts(tenantId: number = DEFAULT_TENANT) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(contacts).where(tenantCond(contacts, tenantId)).orderBy(contacts.companyId, contacts.fullName);
  return assertOnlyTenant(rows as any[], tenantId);
}

export async function updateContactPhone(contactId: number, phone: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(contacts).set({ phone, updatedAt: new Date() }).where(eq(contacts.id, contactId));
  const result = await db.select().from(contacts).where(eq(contacts.id, contactId)).limit(1);
  return result[0] ?? null;
}

const CONTACT_EDITABLE = ["firstName", "lastName", "fullName", "title", "email", "phone", "linkedinUrl"] as const;

// Manuell inmatning: skapa en helt ny kontakt (för personer enrichment inte hittade).
export async function createContact(
  data: { companyId: number } & Partial<Record<(typeof CONTACT_EDITABLE)[number], string>>
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const fullName =
    data.fullName?.trim() ||
    [data.firstName, data.lastName].filter(Boolean).join(" ").trim() ||
    null;
  const values: any = { companyId: data.companyId, tenantId: DEFAULT_TENANT, fullName };
  for (const k of CONTACT_EDITABLE) {
    if (k === "fullName") continue;
    if (data[k] !== undefined) values[k] = data[k] === "" ? null : data[k];
  }
  const result = await db.insert(contacts).values(values);
  const id = insertIdOf(result);
  const row = await db.select().from(contacts).where(eq(contacts.id, id)).limit(1);
  return row[0] ?? null;
}

// Manuell inmatning: komplettera en befintlig kontakt (t.ex. lägg till mejl/mobil/LinkedIn).
export async function updateContact(
  id: number,
  fields: Partial<Record<(typeof CONTACT_EDITABLE)[number], string>>
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const patch: any = { updatedAt: new Date() };
  for (const k of CONTACT_EDITABLE) {
    if (fields[k] !== undefined) patch[k] = fields[k] === "" ? null : fields[k];
  }
  await db.update(contacts).set(patch).where(eq(contacts.id, id));
  const row = await db.select().from(contacts).where(eq(contacts.id, id)).limit(1);
  return row[0] ?? null;
}

// ─── Generated Emails ────────────────────────────────────────────────────────
export async function getEmailsByCompanyId(companyId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(generatedEmails).where(eq(generatedEmails.companyId, companyId)).orderBy(desc(generatedEmails.createdAt));
}

export async function saveGeneratedEmail(data: InsertGeneratedEmail): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(generatedEmails).values(data);
  return insertIdOf(result);
}

export async function updateEmailStatus(id: number, status: "draft" | "sent" | "opened" | "replied", editedBody?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(generatedEmails).set({ status, ...(editedBody !== undefined ? { editedBody } : {}), updatedAt: new Date() }).where(eq(generatedEmails.id, id));
}

// ─── Activities ──────────────────────────────────────────────────────────────
export async function getActivitiesByCompanyId(companyId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(activities).where(eq(activities.companyId, companyId)).orderBy(desc(activities.createdAt));
}

export async function addActivity(data: { companyId: number; contactId?: number; type: "email_sent" | "email_opened" | "email_replied" | "meeting_booked" | "call" | "note"; description?: string; performedBy?: string; }) {
  const db = await getDb();
  if (!db) return;
  await db.insert(activities).values(data);
}

// ─── Webhook Logs ────────────────────────────────────────────────────────────
export async function logWebhook(data: { source?: string; payload?: string; status: "success" | "error" | "partial"; errorMessage?: string; companiesCreated?: number; contactsCreated?: number; }) {
  const db = await getDb();
  if (!db) return;
  await db.insert(webhookLogs).values(data);
}

// ─── Weekly Assignments ──────────────────────────────────────────────────────
export async function createWeeklyAssignment(data: { assignedToUserId: number; assignedToName: string; weekLabel: string; createdByUserId: number; companyIds: number[] }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(weeklyAssignments).values({
    assignedToUserId: data.assignedToUserId,
    assignedToName: data.assignedToName,
    weekLabel: data.weekLabel,
    createdByUserId: data.createdByUserId,
  });
  const weeklyId = insertIdOf(result);
  if (data.companyIds.length > 0) {
    for (const cid of data.companyIds) {
      await db.update(companies).set({
        assignedToUserId: data.assignedToUserId,
        assignedToName: data.assignedToName,
        weeklyListId: weeklyId,
        updatedAt: new Date(),
      }).where(eq(companies.id, cid));
    }
  }
  return weeklyId;
}

export async function getWeeklyAssignments() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(weeklyAssignments).orderBy(desc(weeklyAssignments.createdAt));
}

export async function getCompaniesByWeeklyList(weeklyListId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(companies).where(eq(companies.weeklyListId, weeklyListId)).orderBy(
    sql`FIELD(focus, 'AAA', 'AA', 'A', 'B', 'C', '')`,
    companies.name
  );
}

// ─── Stats ───────────────────────────────────────────────────────────────────
export async function getDashboardStats() {
  const db = await getDb();
  if (!db) return { totalCompanies: 0, totalContacts: 0, aaaCount: 0, aaCount: 0, aCount: 0, contactedCount: 0, emailsGenerated: 0 };
  const [companyRows, contactRows, emailRows] = await Promise.all([
    db.select().from(companies),
    db.select({ id: contacts.id }).from(contacts),
    db.select({ id: generatedEmails.id }).from(generatedEmails),
  ]);
  return {
    totalCompanies: companyRows.length,
    totalContacts: contactRows.length,
    aaaCount: companyRows.filter(c => c.focus === "AAA").length,
    aaCount: companyRows.filter(c => c.focus === "AA").length,
    aCount: companyRows.filter(c => c.focus === "A").length,
    contactedCount: companyRows.filter(c => c.status !== "new").length,
    emailsGenerated: emailRows.length,
  };
}
