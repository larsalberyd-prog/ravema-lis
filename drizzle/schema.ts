import {
  boolean,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Companies table - enriched from Clay
 */
export const companies = mysqlTable("companies", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").default(1).notNull(),     // multi-tenant-isolering (Order 3)

  // Core identifiers
  name: varchar("name", { length: 255 }).notNull(),
  domain: varchar("domain", { length: 255 }),
  slug: varchar("slug", { length: 96 }).unique(), // stable key from seed (e.g. "acc-innovation")

  // Classification
  category: varchar("category", { length: 255 }),
  focus: varchar("focus", { length: 10 }), // AAA, AA, A, B, C
  source: varchar("source", { length: 100 }),

  // Location
  city: varchar("city", { length: 100 }),
  country: varchar("country", { length: 100 }),

  // Enriched data from Clay
  description: text("description"),
  industry: varchar("industry", { length: 255 }),
  employeeCount: int("employeeCount"),
  employeeRange: varchar("employeeRange", { length: 50 }),
  linkedinUrl: varchar("linkedinUrl", { length: 500 }),
  websiteUrl: varchar("websiteUrl", { length: 500 }),
  logoUrl: varchar("logoUrl", { length: 500 }),
  foundedYear: int("foundedYear"),

  // CRM status
  status: mysqlEnum("status", ["new", "contacted", "meeting", "qualified", "lost"]).default("new").notNull(),
  assignedTo: varchar("assignedTo", { length: 255 }), // legacy
  assignedToUserId: int("assignedToUserId"), // FK to users.id
  assignedToName: varchar("assignedToName", { length: 255 }),
  weeklyListId: int("weeklyListId"), // FK to weeklyAssignments.id
  notes: text("notes"),

  // Ravema LIS scoring (DELTA §2.1)
  scoreTotal: int("scoreTotal"),
  scoreBreakdown: json("scoreBreakdown"),
  icpSegment: varchar("icpSegment", { length: 64 }),

  // ICP-Modell v1 (spec/Ravema-ICP-Modell.pdf) — tier + curated intelligence
  icpTier: int("icpTier"),                                  // 1 = strategisk ICP, 2 = stark potential, 3 = anti-mönster
  confidence: mysqlEnum("confidence", ["high", "medium", "low"]),
  sowPotential: varchar("sowPotential", { length: 255 }),
  competitorIncumbent: varchar("competitorIncumbent", { length: 255 }),
  managementPriority: boolean("managementPriority").default(false),
  deadline: varchar("deadline", { length: 64 }),
  nextSteps: text("nextSteps"),
  // JSON blobs carrying the curated LIS payload rendered by IntelligencePack
  triggers: json("triggers"),                               // string[]
  entryAngles: json("entryAngles"),                         // string[]
  qualifyingQuestions: json("qualifyingQuestions"),         // string[]
  reasons: json("reasons"),                                 // string[] — score explanation
  overrides: json("overrides"),                             // string[] — floor/ceiling rules
  lisMeta: json("lisMeta"),                                 // catch-all: district, rationaleKlas, flaggedBy, hasBrief, icpFlaggedBy

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  enrichedAt: timestamp("enrichedAt"),
  scoredAt: timestamp("scoredAt"),
});

export type Company = typeof companies.$inferSelect;
export type InsertCompany = typeof companies.$inferInsert;

/**
 * Signals — autonomously detected events about a company (jobs, news, ownership, etc.).
 * Drives the scoring engine. See DELTA §2.1 + §3.1.
 */
export const signals = mysqlTable("signals", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull(),
  signalType: mysqlEnum("signalType", ["job", "news", "funding", "ownership", "procurement", "engagement"]).notNull(),
  lisType: varchar("lisType", { length: 64 }),     // precise LIS code, e.g. CAPEX_ANNOUNCEMENT, MANAGEMENT_PRIORITY
  source: varchar("source", { length: 100 }).notNull(),
  title: varchar("title", { length: 500 }),
  detail: text("detail"),                           // human-readable evidence shown in the timeline
  url: varchar("url", { length: 1000 }),
  payload: json("payload"),
  pointsAwarded: int("pointsAwarded").default(0),
  detectedAt: timestamp("detectedAt").defaultNow().notNull(),
  decaysAt: timestamp("decaysAt"),
});

export type Signal = typeof signals.$inferSelect;
export type InsertSignal = typeof signals.$inferInsert;

/**
 * Contacts table - decision makers found via Clay "Find People"
 */
export const contacts = mysqlTable("contacts", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").default(1).notNull(),     // multi-tenant-isolering (Order 3)
  companyId: int("companyId").notNull(),

  firstName: varchar("firstName", { length: 100 }),
  lastName: varchar("lastName", { length: 100 }),
  fullName: varchar("fullName", { length: 255 }),

  title: varchar("title", { length: 255 }),
  seniority: varchar("seniority", { length: 100 }),
  department: varchar("department", { length: 100 }),

  email: varchar("email", { length: 320 }),
  emailVerified: boolean("emailVerified").default(false),
  phone: varchar("phone", { length: 50 }),
  linkedinUrl: varchar("linkedinUrl", { length: 500 }),
  location: varchar("location", { length: 255 }),

  priority: mysqlEnum("priority", ["high", "medium", "low"]).default("medium"),
  notes: text("notes"),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Contact = typeof contacts.$inferSelect;
export type InsertContact = typeof contacts.$inferInsert;

/**
 * AI-generated emails
 */
export const generatedEmails = mysqlTable("generated_emails", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull(),
  contactId: int("contactId"),

  subject: text("subject").notNull(),
  body: text("body").notNull(),
  editedBody: text("editedBody"),

  contactName: varchar("contactName", { length: 255 }),
  contactTitle: varchar("contactTitle", { length: 255 }),
  companyName: varchar("companyName", { length: 255 }),
  companyCategory: varchar("companyCategory", { length: 255 }),
  companyFocus: varchar("companyFocus", { length: 10 }),

  status: mysqlEnum("status", ["draft", "sent", "opened", "replied"]).default("draft"),
  generatedBy: varchar("generatedBy", { length: 255 }),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type GeneratedEmail = typeof generatedEmails.$inferSelect;
export type InsertGeneratedEmail = typeof generatedEmails.$inferInsert;

/**
 * Activity log
 */
export const activities = mysqlTable("activities", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull(),
  contactId: int("contactId"),

  type: mysqlEnum("type", ["email_sent", "email_opened", "email_replied", "meeting_booked", "call", "note"]).notNull(),
  description: text("description"),
  performedBy: varchar("performedBy", { length: 255 }),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Activity = typeof activities.$inferSelect;

/**
 * Weekly assignment lists - Per creates a weekly list of companies for each salesperson
 */
export const weeklyAssignments = mysqlTable("weekly_assignments", {
  id: int("id").autoincrement().primaryKey(),
  assignedToUserId: int("assignedToUserId").notNull(), // FK to users.id
  assignedToName: varchar("assignedToName", { length: 255 }),
  weekLabel: varchar("weekLabel", { length: 50 }).notNull(), // e.g. "2026-W09"
  createdByUserId: int("createdByUserId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type WeeklyAssignment = typeof weeklyAssignments.$inferSelect;

/**
 * ICP tier changes — audit trail for the in-app ICP editing (Klas/Nejra validate
 * Tier 1/2/3 and approve the model's promotion/demotion recommendations).
 */
export const icpChanges = mysqlTable("icp_changes", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull(),
  fromTier: int("fromTier"),
  toTier: int("toTier"),
  fromFocus: varchar("fromFocus", { length: 8 }),
  toFocus: varchar("toFocus", { length: 8 }),
  changedByUserId: int("changedByUserId"),
  changedByName: varchar("changedByName", { length: 255 }),
  reason: text("reason"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type IcpChange = typeof icpChanges.$inferSelect;

/**
 * Clay webhook log
 */
export const webhookLogs = mysqlTable("webhook_logs", {
  id: int("id").autoincrement().primaryKey(),
  source: varchar("source", { length: 50 }).default("clay"),
  payload: text("payload"),
  status: mysqlEnum("status", ["success", "error", "partial"]).default("success"),
  errorMessage: text("errorMessage"),
  companiesCreated: int("companiesCreated").default(0),
  contactsCreated: int("contactsCreated").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/**
 * Generated Intelligence Packs — live, roll-styrda info-packs (intelligence.generate).
 * Persisteras så packen ACKUMULERAS över tid (moaten) och så varje ny generering kan
 * ta hänsyn till tidigare vinklar (icke-repetition). Se APP-STRATEGI.md.
 */
export const generatedPacks = mysqlTable("generated_packs", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull(),
  role: varchar("role", { length: 64 }),                          // fc | salesperson
  headlineHypothesis: varchar("headlineHypothesis", { length: 500 }),
  payload: json("payload").notNull(),                             // full IntelligencePackData
  generatedBy: varchar("generatedBy", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type GeneratedPack = typeof generatedPacks.$inferSelect;

/**
 * Discovery-sessioner — SPAR-frågor (genererade ur info-pack + Ravema-data) och
 * säljarens svar. Svaren återförs till LIS som signaler (reinforcement-loopen).
 */
export const discoverySessions = mysqlTable("discovery_sessions", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull(),
  role: varchar("role", { length: 64 }),
  payload: json("payload").notNull(),                  // { questions, answers }
  createdBy: varchar("createdBy", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type DiscoverySession = typeof discoverySessions.$inferSelect;

/**
 * Tenant-inställningar (en rad) — driftläge per kund: test / pilot / normal.
 * Styr hur många prospekt-konton som är upplåsta (test = N st, resten låsta).
 * Lås = dölj/spärra, ALDRIG radera. testUnlockLimit är konfigurerbar.
 */
export const tenantSettings = mysqlTable("tenant_settings", {
  id: int("id").primaryKey(),                                          // alltid 1
  accountPhase: mysqlEnum("accountPhase", ["test", "pilot", "normal"]).default("test").notNull(),
  configStatus: mysqlEnum("configStatus", ["draft", "reviewed", "live"]).default("draft").notNull(),
  testUnlockLimit: int("testUnlockLimit").default(12).notNull(),
  testStartedAt: timestamp("testStartedAt"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type TenantSettings = typeof tenantSettings.$inferSelect;
