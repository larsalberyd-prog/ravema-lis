/**
 * DB → frontend-form mappers.
 *
 * Backend-tabellerna lagrar platta kolumner + JSON-blobbar och kontakter i en
 * separat tabell. Frontendens `Company`-interface (client/src/hooks/useCompanies.ts)
 * vill ha den NÄSTLADE formen: decisionMakers[] + lis:{}. Denna fil är inversen av
 * seed:ens forward-mappning (server/seed/seed.ts) så `companies.list/getById` kan
 * returnera exakt det frontend redan konsumerar — inga ändringar i de 8 sidorna.
 *
 * Håll detta i synk med:
 *  - drizzle/schema.ts (companies, contacts, signals)
 *  - client/src/hooks/useCompanies.ts (Company, DecisionMaker, LisMeta, LisSignal)
 */
import type { Company, Contact, Signal } from "../drizzle/schema";

type AnyRec = Record<string, any>;

// MariaDB lagrar JSON-kolumner som LONGTEXT (ej native JSON-typ), så mysql2/drizzle
// returnerar dem som STRÄNGAR — inte parsade arrayer/objekt. Coerca defensivt här,
// annars kraschar frontend på t.ex. `reasons.map(...)`.
function parseJson(v: any): any {
  if (v == null) return null;
  if (typeof v !== "string") return v;
  try { return JSON.parse(v); } catch { return null; }
}
function asArr(v: any): any[] { const p = parseJson(v); return Array.isArray(p) ? p : []; }
function asObj(v: any): AnyRec { const p = parseJson(v); return p && typeof p === "object" && !Array.isArray(p) ? p : {}; }

const FOCUS = new Set(["AAA", "AA", "A", "B", "C"]);
function focusOf(row: AnyRec): "AAA" | "AA" | "A" | "B" | "C" {
  const f = String(row.focus || "").toUpperCase();
  return (FOCUS.has(f) ? f : "B") as any;
}

// contacts.department håller original-rollsträngen; seniority avgör Executive/Technical.
function dmRole(c: AnyRec): "Executive" | "Technical" | "Buyer" | "Gatekeeper" | "Other" {
  const sen = String(c.seniority || "").toLowerCase();
  const dep = String(c.department || "").toLowerCase();
  if (sen.includes("c-level") || sen.includes("vd") || dep.includes("ledning") || dep.includes("exec")) return "Executive";
  if (dep.includes("teknik") || dep.includes("produktion") || dep.includes("konstruktion") || dep.includes("kvalitet")) return "Technical";
  if (dep.includes("inköp") || dep.includes("purchas")) return "Buyer";
  return "Other";
}

export function contactToDecisionMaker(c: Contact | AnyRec): AnyRec {
  return {
    id: c.id,
    name: c.fullName || [c.firstName, c.lastName].filter(Boolean).join(" "),
    title: c.title || "",
    role: dmRole(c),
    email: c.email ?? null,
    phone: c.phone ?? null,
    linkedin: c.linkedinUrl ?? null,
    priority: (["high", "medium", "low"].includes(String(c.priority)) ? c.priority : "medium") as any,
  };
}

function lisFrom(row: AnyRec, signalRows: AnyRec[]): AnyRec | undefined {
  const meta = asObj(row.lisMeta);
  const hasLis = row.scoreTotal != null || row.scoreBreakdown || meta.tier || (signalRows && signalRows.length);
  if (!hasLis) return undefined;
  return {
    tier: meta.tier || focusOf(row),
    scoreTotal: typeof row.scoreTotal === "number" ? row.scoreTotal : 0,
    scoreBreakdown: { firmographic: 0, capacity: 0, signals: 0, engagement: 0, strategic: 0, ...asObj(row.scoreBreakdown) },
    reasons: asArr(row.reasons),
    overrides: asArr(row.overrides),
    confidence: row.confidence || "medium",
    signals: (signalRows || []).map((s) => {
      const payload = asObj(s.payload);
      return {
        type: s.lisType || s.signalType,
        detail: s.detail || "",
        date: payload.date ?? null,
        evidenceSource: s.source ?? payload.evidenceSource ?? null,
      };
    }),
    district: meta.district ?? null,
    competitorIncumbent: row.competitorIncumbent ?? null,
    managementPriority: !!row.managementPriority,
    rationaleKlas: meta.rationaleKlas,
  };
}

/**
 * Map a DB company row (+ optionally its contacts/signals) to the frontend Company shape.
 * List views can omit contacts/signals (cheap); detail view passes both.
 */
export function dbRowToCompany(
  row: Company | AnyRec,
  contactRows: (Contact | AnyRec)[] = [],
  signalRows: (Signal | AnyRec)[] = [],
): AnyRec {
  return {
    dbId: row.id,                       // numeriskt DB-id — frontend nycklar mutationer på detta (id = slug)
    id: row.slug || String(row.id),
    name: row.name,
    country: row.country || "",
    city: row.city || "",
    segment: row.icpSegment || row.category || "",
    priority: focusOf(row),
    status: (["new", "contacted", "meeting", "qualified"].includes(String(row.status)) ? row.status : "new") as any,
    assignedTo: row.assignedToName ?? row.assignedTo ?? null,
    deadline: row.deadline ?? null,
    description: row.description || "",
    sowPotential: row.sowPotential || "",
    triggers: asArr(row.triggers),
    decisionMakers: contactRows.map(contactToDecisionMaker),
    entryAngles: asArr(row.entryAngles),
    qualifyingQuestions: asArr(row.qualifyingQuestions),
    nextSteps: row.nextSteps ?? null,
    notes: row.notes ?? null,
    updatedAt: row.updatedAt ?? null,
    lis: lisFrom(row, signalRows),
  };
}
