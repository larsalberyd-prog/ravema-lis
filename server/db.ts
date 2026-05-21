import { eq, like, or, desc, and, sql, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser, users, companies, contacts, generatedEmails, activities, webhookLogs, weeklyAssignments,
  InsertCompany, InsertContact, InsertGeneratedEmail,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

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
export async function getAllCompanies() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(companies).orderBy(
    sql`FIELD(focus, 'AAA', 'AA', 'A', 'B', 'C', '')`,
    companies.name
  );
}

export async function getCompanyById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(companies).where(eq(companies.id, id)).limit(1);
  return result[0] ?? null;
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
  return Number((result as any).insertId ?? 0);
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

// ─── Contacts ────────────────────────────────────────────────────────────────
export async function getContactsByCompanyId(companyId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(contacts).where(eq(contacts.companyId, companyId));
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
  return Number((result as any).insertId ?? 0);
}

export async function getAllContacts() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(contacts).orderBy(contacts.companyId, contacts.fullName);
}

export async function updateContactPhone(contactId: number, phone: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(contacts).set({ phone, updatedAt: new Date() }).where(eq(contacts.id, contactId));
  const result = await db.select().from(contacts).where(eq(contacts.id, contactId)).limit(1);
  return result[0] ?? null;
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
  return Number((result as any).insertId ?? 0);
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
  const weeklyId = Number((result as any).insertId);
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
