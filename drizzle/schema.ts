import {
  boolean,
  int,
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

  // Core identifiers
  name: varchar("name", { length: 255 }).notNull(),
  domain: varchar("domain", { length: 255 }),

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

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  enrichedAt: timestamp("enrichedAt"),
});

export type Company = typeof companies.$inferSelect;
export type InsertCompany = typeof companies.$inferInsert;

/**
 * Contacts table - decision makers found via Clay "Find People"
 */
export const contacts = mysqlTable("contacts", {
  id: int("id").autoincrement().primaryKey(),
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
