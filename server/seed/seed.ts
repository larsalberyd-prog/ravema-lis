/**
 * LIS seed — populates MySQL from the curated companies.json + the ICP-Modell v1
 * tier lists (spec/Ravema-ICP-Modell.pdf). Runs idempotently on server startup:
 * seeds when the companies table is empty, or when SEED_LIS_FORCE is truthy.
 *
 * Keyed on companies.slug so re-runs upsert rather than duplicate. esbuild inlines
 * the JSON import into the server bundle, so no data files are needed at runtime.
 */
import { eq, sql } from "drizzle-orm";
import { getDb } from "../db";
import { companies, contacts, signals } from "../../drizzle/schema";
// eslint-disable-next-line @typescript-eslint/no-var-requires
import companiesRaw from "../../client/src/data/companies.json";

type AnyRec = Record<string, any>;

// ─── ICP-Modell v1 tier membership (authoritative; spec/Ravema-ICP-Modell.pdf) ──
const TIER1 = [
  "RZ Gruppen", "Zampart", "Vrena Mek", "Vrea Mek", "LK Precision", "Axido",
  "ACC Innovation", "IS Plåt", "Bergen Engines", "Sperre", "Setech", "Kinnex",
  "PNM Pro", "Alfa Laval", "Bharat Forge", "Leax", "Elme Spreader", "Spuhr",
];
const TIER2 = [
  "Wallåkra", "AnVa", "Ölme Mekaniska", "Blomberg & Stensson", "Kils Mekaniska",
  "Skaraverken", "PDS Mecan", "Finnøy Gear", "SMV", "Kystdesign", "Stryvo",
  "Tooltech", "Hultdins", "Huddig", "Indexator", "HSP Gripen", "Pepab",
  "Tramek", "Spitze", "Hyngarps", "Tre-Mek",
];
const TIER3 = [
  "Volvo Köping", "Volvo Olofström", "A-teknik", "ZIWA", "Stålmännen",
  "HJ-Tooling", "Roplan", "Protab", "Hakfelt", "NMV", "Hackås", "Alfta",
];

function icpTierFor(name: string): number | null {
  const n = (name || "").toLowerCase();
  const hit = (list: string[]) => list.some(m => n.includes(m.toLowerCase()));
  if (hit(TIER1)) return 1;
  if (hit(TIER2)) return 2;
  if (hit(TIER3)) return 3;
  return null;
}

function normConfidence(c: any): "high" | "medium" | "low" | null {
  const v = String(c || "").toLowerCase();
  if (["high", "hög"].includes(v)) return "high";
  if (["medium", "medel"].includes(v)) return "medium";
  if (["low", "låg"].includes(v)) return "low";
  return null;
}

// Map a precise LIS signal code to the coarse signalType enum.
function signalTypeFor(lisType: string): "job" | "news" | "funding" | "ownership" | "procurement" | "engagement" {
  const t = (lisType || "").toUpperCase();
  if (t.includes("CAPEX") || t.includes("FUNDING") || t.includes("EMISSION") || t.includes("INVEST")) return "funding";
  if (t.startsWith("HIRE") || t.includes("RECRUIT") || t.includes("PRODUCTION_MANAGER") || t.includes("OPERATOR")) return "job";
  if (t.includes("OWNER") || t.includes("ACQUISITION") || t.includes("MERGER")) return "ownership";
  if (t.includes("PROCUREMENT") || t.includes("TENDER") || t.includes("GATE")) return "procurement";
  if (t.includes("EXPANSION") || t.includes("PLANT") || t.includes("MARKET_POSITION") || t.includes("NEWS")) return "news";
  return "engagement";
}

function nameToParts(full: string): { firstName?: string; lastName?: string } {
  const parts = (full || "").trim().split(/\s+/);
  if (parts.length === 0) return {};
  if (parts.length === 1) return { firstName: parts[0] };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

export async function seedLisIfNeeded(): Promise<void> {
  const db = await getDb();
  if (!db) { console.warn("[seed] database not available — skipping"); return; }

  const force = ["1", "true", "yes"].includes(String(process.env.SEED_LIS_FORCE || "").toLowerCase());
  const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(companies);
  if (Number(count) > 0 && !force) {
    console.log(`[seed] companies table already populated (${count}) — skipping (set SEED_LIS_FORCE=1 to re-seed)`);
    return;
  }

  const records = (companiesRaw as AnyRec[]) || [];
  console.log(`[seed] seeding ${records.length} companies (force=${force})…`);
  let companiesUpserted = 0, contactsUpserted = 0, signalsInserted = 0;

  for (const r of records) {
    const lis: AnyRec = r.lis || {};
    const slug: string = r.id || String(r.name || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    if (!slug || !r.name) continue;

    const companyRow = {
      slug,
      name: r.name,
      domain: r.domain || undefined,
      category: r.segment || undefined,
      focus: r.priority || lis.tier || undefined,
      source: "icp-modell-v1",
      city: r.city || undefined,
      country: r.country || undefined,
      description: r.description || undefined,
      icpSegment: r.segment || undefined,
      icpTier: icpTierFor(r.name),
      confidence: normConfidence(lis.confidence) || undefined,
      sowPotential: r.sowPotential || undefined,
      competitorIncumbent: lis.competitorIncumbent || undefined,
      managementPriority: !!lis.managementPriority,
      deadline: r.deadline || undefined,
      nextSteps: r.nextSteps || undefined,
      notes: r.notes || undefined,
      status: (["new", "contacted", "meeting", "qualified", "lost"].includes(r.status) ? r.status : "new") as any,
      scoreTotal: typeof lis.scoreTotal === "number" ? lis.scoreTotal : undefined,
      scoreBreakdown: lis.scoreBreakdown || undefined,
      triggers: r.triggers || undefined,
      entryAngles: r.entryAngles || undefined,
      qualifyingQuestions: r.qualifyingQuestions || undefined,
      reasons: lis.reasons || undefined,
      overrides: lis.overrides || undefined,
      lisMeta: {
        tier: lis.tier,
        district: lis.district,
        rationaleKlas: lis.rationaleKlas,
        flaggedBy: lis.flaggedBy,
        hasBrief: lis.hasBrief,
        icpFlaggedBy: lis.icpFlaggedBy,
      },
      enrichedAt: new Date(),
      scoredAt: lis.scoreTotal != null ? new Date() : undefined,
    };

    // upsert by slug
    const existing = await db.select({ id: companies.id }).from(companies).where(eq(companies.slug, slug)).limit(1);
    let companyId: number;
    if (existing.length > 0) {
      companyId = existing[0].id;
      await db.update(companies).set({ ...companyRow, updatedAt: new Date() }).where(eq(companies.id, companyId));
    } else {
      const res = await db.insert(companies).values(companyRow);
      companyId = Number((res as any).insertId ?? 0);
    }
    companiesUpserted++;

    // contacts (skip placeholder "Sök:" search rows)
    for (const dm of (r.decisionMakers || []) as AnyRec[]) {
      if (!dm?.name || String(dm.name).startsWith("Sök:")) continue;
      const { firstName, lastName } = nameToParts(dm.name);
      const contactRow = {
        companyId,
        firstName,
        lastName,
        fullName: dm.name,
        title: dm.title || undefined,
        seniority: dm.seniority || undefined,
        department: dm.role || undefined,
        email: dm.email || undefined,
        emailVerified: !!dm.email && /a\+?/i.test(String(dm.email_confidence || "")),
        phone: dm.phone || undefined,
        linkedinUrl: dm.linkedin || undefined,
        location: dm.country || undefined,
        priority: (["high", "medium", "low"].includes(dm.priority) ? dm.priority : "medium") as any,
        notes: dm.note || undefined,
      };
      const existingC = dm.email
        ? await db.select({ id: contacts.id }).from(contacts)
            .where(sql`${contacts.companyId} = ${companyId} AND ${contacts.email} = ${dm.email}`).limit(1)
        : [];
      if (existingC.length > 0) {
        await db.update(contacts).set({ ...contactRow, updatedAt: new Date() }).where(eq(contacts.id, existingC[0].id));
      } else {
        await db.insert(contacts).values(contactRow);
      }
      contactsUpserted++;
    }

    // signals — replace this company's seeded signals to stay idempotent
    await db.delete(signals).where(sql`${signals.companyId} = ${companyId} AND ${signals.source} != 'live'`);
    for (const s of (lis.signals || []) as AnyRec[]) {
      if (!s?.type) continue;
      await db.insert(signals).values({
        companyId,
        signalType: signalTypeFor(s.type),
        lisType: String(s.type).slice(0, 64),
        source: (s.evidenceSource || "icp-modell-v1").slice(0, 100),
        title: String(s.type).replace(/_/g, " ").slice(0, 500),
        detail: s.detail || undefined,
        payload: { date: s.date ?? null, evidenceSource: s.evidenceSource ?? null },
      });
      signalsInserted++;
    }
  }

  console.log(`[seed] done: ${companiesUpserted} companies, ${contactsUpserted} contacts, ${signalsInserted} signals.`);
}
