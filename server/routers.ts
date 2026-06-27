import { COOKIE_NAME } from "@shared/const";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";
import { TRPCError } from "@trpc/server";
import {
  getAllCompanies, getCompanyById, searchCompanies, upsertCompany, updateCompanyStatus, updateCompanyDescription,
  assignCompanyToUser, getCompaniesByAssignedUser, getUnassignedCompanies,
  getContactsByCompanyId, getContactById, upsertContact, getAllContacts, updateContactPhone,
  createContact, updateContact,
  getEmailsByCompanyId, saveGeneratedEmail, updateEmailStatus, getGeneratedEmailCount,
  getActivitiesByCompanyId, addActivity,
  getDashboardStats, logWebhook,
  getAllUsers, getUserById, updateUserRole,
  createWeeklyAssignment, getWeeklyAssignments, getCompaniesByWeeklyList,
  getSignalsByCompanyId, getAllSignals, updateCompanyTier, getIcpChangesByCompanyId,
  saveGeneratedPack, getPacksByCompanyId, getLatestPack,
  saveDiscoverySession, getLatestDiscovery, addSignal,
  getTenantSettings, setTenantSettings, isCompanyLocked, getTestUnlockedIds, phaseTransitionError,
} from "./db";
import { dbRowToCompany } from "./mappers";
import { sanitizeDecisionMakers, firstNameOf } from "./pii";

// JSON-schema för IntelligencePackData (Anthropic structured outputs).
const PACK_SCHEMA = {
  type: "object",
  properties: {
    headline_hypothesis: { type: "string" },
    subtitle: { type: ["string", "null"] },
    urgency: { type: "string", enum: ["sälj_nu", "varma_ledet", "långsiktig", "monitor"] },
    urgency_reason: { type: "string" },
    hypothesis: { type: "string" },
    market_trend: { type: ["string", "null"] },
    prospecting_plan: { type: "array", items: { type: "string" } },
    qualifying_questions: { type: "array", items: { type: "string" } },
    sources: {
      type: "array",
      items: {
        type: "object",
        properties: { label: { type: "string" }, detail: { type: ["string", "null"] }, url: { type: ["string", "null"] } },
        required: ["label", "detail", "url"], additionalProperties: false,
      },
    },
    decision_makers: {
      type: "array",
      items: {
        type: "object",
        properties: {
          role_label: { type: "string" },
          role_category: { type: "string", enum: ["Executive", "Technical"] },
          name: { type: ["string", "null"] }, title: { type: ["string", "null"] },
          email: { type: ["string", "null"] }, mobile: { type: ["string", "null"] },
          linkedin: { type: ["string", "null"] }, why_relevant: { type: ["string", "null"] },
        },
        required: ["role_label", "role_category", "name", "title", "email", "mobile", "linkedin", "why_relevant"],
        additionalProperties: false,
      },
    },
    buying_signals: {
      type: "array",
      items: {
        type: "object",
        properties: {
          headline: { type: "string" }, detail: { type: ["string", "null"] }, date: { type: ["string", "null"] },
          impact: { type: "string", enum: ["high", "medium", "low"] }, linked_decision_maker: { type: ["string", "null"] },
        },
        required: ["headline", "detail", "date", "impact", "linked_decision_maker"], additionalProperties: false,
      },
    },
    competitors: {
      type: "array",
      items: {
        type: "object",
        properties: { name: { type: "string" }, incumbent_machines: { type: ["string", "null"] }, displacement_angle: { type: ["string", "null"] } },
        required: ["name", "incumbent_machines", "displacement_angle"], additionalProperties: false,
      },
    },
  },
  required: [
    "headline_hypothesis", "subtitle", "urgency", "urgency_reason", "hypothesis", "market_trend",
    "prospecting_plan", "qualifying_questions", "sources", "decision_makers", "buying_signals", "competitors",
  ],
  additionalProperties: false,
} as const;

// SPAR Discovery-schema (en lista {question, why} per fas).
const SPAR_PHASE = {
  type: "array",
  items: {
    type: "object",
    properties: { question: { type: "string" }, why: { type: "string" } },
    required: ["question", "why"], additionalProperties: false,
  },
};
const DISCOVERY_SCHEMA = {
  type: "object",
  properties: { situation: SPAR_PHASE, pain: SPAR_PHASE, affect: SPAR_PHASE, resolve: SPAR_PHASE },
  required: ["situation", "pain", "affect", "resolve"],
  additionalProperties: false,
} as const;

// Lås = dölj kontakter/DM-analys/AI-relevant detalj. Behåll namn/bransch/score/pain.
// ENDA stället där redaktionen sker (övrig låslogik bor i db.isCompanyLocked).
function redactLockedCompany(c: any): any {
  const painIndicator =
    (c.triggers && c.triggers[0]) || (c.lis && c.lis.reasons && c.lis.reasons[0]) || null;
  return {
    ...c,
    locked: true,
    painIndicator,
    description: "",
    decisionMakers: [],
    triggers: [], entryAngles: [], qualifyingQuestions: [],
    notes: null,
    lis: c.lis
      ? {
          tier: c.lis.tier,
          scoreTotal: c.lis.scoreTotal,
          scoreBreakdown: { firmographic: 0, capacity: 0, signals: 0, engagement: 0, strategic: 0 },
          reasons: [], overrides: [], confidence: "medium", signals: [], managementPriority: false,
        }
      : undefined,
  };
}

// Admin-only middleware
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  return next({ ctx });
});

export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ─── Users (admin only) ───────────────────────────────────────────────────
  users: router({
    list: adminProcedure.query(async () => getAllUsers()),

    updateRole: adminProcedure
      .input(z.object({ id: z.number(), role: z.enum(["user", "admin"]) }))
      .mutation(async ({ input }) => {
        await updateUserRole(input.id, input.role);
        return { success: true };
      }),
  }),

  // ─── Companies ────────────────────────────────────────────────────────────
  companies: router({
    // Returnerar den NÄSTLADE frontend-formen (decisionMakers[] + lis:{}) via dbRowToCompany,
    // så useCompanies kan läsa direkt från DB utan att de 8 konsument-sidorna ändras.
    list: publicProcedure.query(async () => {
      const [comps, allContacts, allSignals] = await Promise.all([
        getAllCompanies(), getAllContacts(), getAllSignals(),
      ]);
      const groupBy = <T extends { companyId: number }>(rows: T[]) => {
        const m = new Map<number, T[]>();
        for (const r of rows) { const a = m.get(r.companyId) ?? []; a.push(r); m.set(r.companyId, a); }
        return m;
      };
      const cMap = groupBy(allContacts as any);
      const sMap = groupBy(allSignals as any);
      const mapped = (comps as any[]).map((c) => dbRowToCompany(c, cMap.get(c.id) ?? [], sMap.get(c.id) ?? []));
      // Fas-gating: i test-läget är 12 svenska + 6 norska upplåsta (topp per land), resten låsta.
      const settings = await getTenantSettings();
      if (settings.accountPhase !== "test") return mapped.map((c) => ({ ...c, locked: false }));
      const unlocked = await getTestUnlockedIds();
      return mapped.map((c) => (unlocked.has(c.dbId) ? { ...c, locked: false, testOpen: true } : redactLockedCompany(c)));
    }),

    search: publicProcedure
      .input(z.object({ query: z.string() }))
      .query(async ({ input }) => searchCompanies(input.query)),

    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const c = await getCompanyById(input.id);
        if (!c) return null;
        const [cs, ss] = await Promise.all([
          getContactsByCompanyId(input.id), getSignalsByCompanyId(input.id),
        ]);
        const company = dbRowToCompany(c, cs, ss);
        if (await isCompanyLocked(input.id)) return redactLockedCompany(company);
        return { ...company, locked: false };
      }),

    updateStatus: publicProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(["new", "contacted", "meeting", "qualified", "lost"]),
        assignedTo: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        await updateCompanyStatus(input.id, input.status, input.assignedTo, input.notes);
        return { success: true };
      }),

    assign: adminProcedure
      .input(z.object({
        companyId: z.number(),
        userId: z.number().nullable(),
        userName: z.string().nullable(),
      }))
      .mutation(async ({ input }) => {
        await assignCompanyToUser(input.companyId, input.userId, input.userName);
        return { success: true };
      }),

    byAssignedUser: protectedProcedure
      .input(z.object({ userId: z.number() }))
      .query(async ({ input }) => getCompaniesByAssignedUser(input.userId)),

    unassigned: adminProcedure.query(async () => getUnassignedCompanies()),

    // Backfill: AI-genererar faktiska företagsbeskrivningar för bolag som saknar.
    backfillDescriptions: publicProcedure.mutation(async () => {
      const comps = (await getAllCompanies()) as any[];
      let filled = 0;
      for (const c of comps) {
        if ((c.description || "").trim().length >= 40) continue;
        const sys = "Du skriver korta, FAKTISKA företagsbeskrivningar (2 meningar, svenska) om nordiska industri-/verkstadsbolag — vad bolaget gör. Är du säker: var konkret. Är du osäker: beskriv branschtypiskt utifrån segment/ort UTAN att hitta på specifika siffror, kunder eller produkter. Returnera enbart beskrivningen, ingen rubrik.";
        const user = `Bolag: ${c.name}\nSegment: ${c.icpSegment || c.category || ""}\nOrt: ${c.city || ""}, ${c.country || ""}\nSkriv en kort faktisk beskrivning av vad bolaget gör.`;
        try {
          const resp = await invokeLLM({ messages: [{ role: "system", content: sys }, { role: "user", content: user }], max_tokens: 300 });
          const desc = (resp.choices[0].message.content || "").trim();
          if (desc) { await updateCompanyDescription(c.id, desc); filled++; }
        } catch { /* hoppa över vid fel, fortsätt */ }
      }
      return { filled };
    }),

    // ─── ICP editing — Klas/Nejra validate Tier 1/2/3 and approve model recs ──
    updateTier: protectedProcedure
      .input(z.object({
        companyId: z.number(),
        toTier: z.number().min(1).max(3).nullable().optional(),
        toFocus: z.enum(["AAA", "AA", "A", "B", "C"]).nullable().optional(),
        reason: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return updateCompanyTier({
          companyId: input.companyId,
          toTier: input.toTier,
          toFocus: input.toFocus,
          changedByUserId: ctx.user.id,
          changedByName: ctx.user.name ?? ctx.user.email ?? `user#${ctx.user.id}`,
          reason: input.reason,
        });
      }),

    icpHistory: publicProcedure
      .input(z.object({ companyId: z.number() }))
      .query(async ({ input }) => getIcpChangesByCompanyId(input.companyId)),

    // CSV import from Clay (admin only)
    importCsv: adminProcedure
      .input(z.object({
        rows: z.array(z.object({
          company_name: z.string().optional(),
          company_domain: z.string().optional(),
          category: z.string().optional(),
          city: z.string().optional(),
          country: z.string().optional(),
          focus: z.string().optional(),
          source: z.string().optional(),
          Name: z.string().optional(),
          Website: z.string().optional(),
          "Employee Count": z.union([z.string(), z.number()]).optional(),
          Size: z.string().optional(),
          Industry: z.string().optional(),
          Description: z.string().optional(),
          Url: z.string().optional(),
          Founded: z.union([z.string(), z.number()]).optional(),
        })),
      }))
      .mutation(async ({ input }) => {
        let created = 0, updated = 0, errors = 0;
        for (const row of input.rows) {
          try {
            const name = row.company_name || row.Name || "";
            if (!name) { errors++; continue; }
            await upsertCompany({
              name,
              domain: row.company_domain || undefined,
              category: row.category || undefined,
              focus: row.focus || undefined,
              source: row.source || undefined,
              city: row.city || undefined,
              country: row.country || undefined,
              description: row.Description || undefined,
              industry: row.Industry || undefined,
              employeeCount: row["Employee Count"] ? Number(row["Employee Count"]) : undefined,
              employeeRange: row.Size || undefined,
              linkedinUrl: row.Url || undefined,
              websiteUrl: row.Website || undefined,
              enrichedAt: new Date(),
            });
            created++;
          } catch {
            errors++;
          }
        }
        return { created, updated, errors };
      }),
  }),

  // ─── Contacts ─────────────────────────────────────────────────────────────
  contacts: router({
    byCompany: publicProcedure
      .input(z.object({ companyId: z.number() }))
      .query(async ({ input }) => getContactsByCompanyId(input.companyId)),

    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => getContactById(input.id)),

    all: publicProcedure.query(async () => getAllContacts()),

    updatePhone: protectedProcedure
      .input(z.object({ contactId: z.number(), phone: z.string().max(50) }))
      .mutation(async ({ input }) => updateContactPhone(input.contactId, input.phone)),

    // Manuell inmatning av ny person (enrichment hittade inte mejl/mobil).
    create: publicProcedure
      .input(z.object({
        companyId: z.number(),
        fullName: z.string().max(255).optional(),
        firstName: z.string().max(100).optional(),
        lastName: z.string().max(100).optional(),
        title: z.string().max(255).optional(),
        email: z.string().max(320).optional(),
        phone: z.string().max(50).optional(),
        linkedinUrl: z.string().max(500).optional(),
      }))
      .mutation(async ({ input }) => createContact(input)),

    // Komplettera befintlig kontakt (lägg till/ändra mejl, mobil, LinkedIn, titel, namn).
    update: publicProcedure
      .input(z.object({
        id: z.number(),
        fullName: z.string().max(255).optional(),
        title: z.string().max(255).optional(),
        email: z.string().max(320).optional(),
        phone: z.string().max(50).optional(),
        linkedinUrl: z.string().max(500).optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...fields } = input;
        return updateContact(id, fields);
      }),
  }),

  // ─── Emails ───────────────────────────────────────────────────────────────
  // ─── Tenant-fas (test / pilot / normal) — åtkomststyrning ──────────────────
  settings: router({
    get: publicProcedure.query(async () => {
      const s = await getTenantSettings();
      // Testfönster förlängt till juli (start 2026-06-08 → ~2026-07-31) för juli-avstämningen.
      const TEST_WINDOW_DAYS = 53;
      const startMs = s.testStartedAt ? new Date(s.testStartedAt).getTime() : null;
      const windowEndsAt = startMs ? new Date(startMs + TEST_WINDOW_DAYS * 24 * 3600 * 1000).toISOString() : null;
      const expired = s.accountPhase === "test" && startMs != null &&
        (Date.now() - startMs > TEST_WINDOW_DAYS * 24 * 3600 * 1000);
      return { ...s, expired, windowEndsAt, testWindowDays: TEST_WINDOW_DAYS };
    }),
    setPhase: publicProcedure
      .input(z.object({ accountPhase: z.enum(["test", "pilot", "normal"]) }))
      .mutation(async ({ input }) => {
        const cur = await getTenantSettings();
        const err = phaseTransitionError(input.accountPhase, cur.configStatus);
        if (err) throw new TRPCError({ code: "BAD_REQUEST", message: err });
        return setTenantSettings({ accountPhase: input.accountPhase });
      }),
    setUnlockLimit: publicProcedure
      .input(z.object({ limit: z.number().min(0).max(1000) }))
      .mutation(async ({ input }) => setTenantSettings({ testUnlockLimit: input.limit })),
    setConfigStatus: publicProcedure
      .input(z.object({ configStatus: z.enum(["draft", "reviewed", "live"]) }))
      .mutation(async ({ input }) => setTenantSettings({ configStatus: input.configStatus })),
  }),

  // ─── Intelligence Packs — live, roll-styrt info-pack via Claude ────────────
  intelligence: router({
    latest: publicProcedure
      .input(z.object({ companyId: z.number() }))
      .query(async ({ input }) => getLatestPack(input.companyId)),

    history: publicProcedure
      .input(z.object({ companyId: z.number() }))
      .query(async ({ input }) => {
        const rows = await getPacksByCompanyId(input.companyId);
        return rows.map((r) => ({ id: r.id, role: r.role, headline: r.headlineHypothesis, createdAt: r.createdAt }));
      }),

    generate: publicProcedure
      .input(z.object({
        companyId: z.number(),
        role: z.string().optional(),               // fc | salesperson
        language: z.enum(["sv", "no", "en"]).default("sv"),
      }))
      .mutation(async ({ input }) => {
        if (await isCompanyLocked(input.companyId)) throw new TRPCError({ code: "FORBIDDEN", message: "Kontot är låst — teckna avtal för att låsa upp." });
        const c = await getCompanyById(input.companyId);
        if (!c) throw new TRPCError({ code: "NOT_FOUND", message: "Company not found" });
        const [cs, ss] = await Promise.all([
          getContactsByCompanyId(input.companyId), getSignalsByCompanyId(input.companyId),
        ]);
        const company = dbRowToCompany(c, cs, ss);

        const prior = await getPacksByCompanyId(input.companyId);
        const priorHeadlines = prior
          .map((p: any) => {
            const pl = typeof p.payload === "string" ? JSON.parse(p.payload) : p.payload;
            return pl?.headline_hypothesis;
          })
          .filter(Boolean).slice(0, 6);

        const roleLabel = input.role === "salesperson"
          ? "Säljare (taktisk vy: vem att kontakta, vilken krok, vilken öppningsfråga)"
          : "FC / försäljningschef (strategisk vy: prioritet, var i pipen, nästa drag på kontonivå)";
        const langName = input.language === "no" ? "norska (bokmål)" : input.language === "en" ? "engelska" : "svenska";

        const systemPrompt = `Du är Ravemas Intelligence-motor. Du producerar ett skarpt, PAIN-FIRST info-pack om ett prospekt — grundat i bolagets FAKTISKA signaler och situation, aldrig i Ravemas produktkatalog. Ravema är teknisk partner inom avancerad skärande bearbetning, automation och mätteknik (Mazak, PAMA, Fastems, Erowa, Wenzel) — det är BAKGRUND, inte innehåll.

Metod = SPAR: Situation → Pain → Affect → Resolve. Affect — vad smärtan KOSTAR, ekonomiskt OCH emotionellt — är metodens hjärta. Pain väger ~4–5× tyngre än gain.

Roll-anpassning: ${roleLabel}.

Regler:
- Var konkret och bevisbar. Hitta INTE på köpsignaler — använd de som ges i datan.
- urgency speglar ett verkligt köpfönster: sälj_nu / varma_ledet / långsiktig / monitor (monitor = anti-fit, ingen affär nu).
- decision_makers ska bygga på de givna kontakterna (namn/titel/mejl/mobil/linkedin) — lägg på why_relevant.
- ICKE-REPETITION: tidigare huvudhypoteser för kontot listas nedan — ta en FÄRSK vinkel, upprepa inte samma headline_hypothesis.
- Skriv allt textinnehåll på ${langName}.
Returnera ENBART giltig JSON enligt schemat.`;

        const userPrompt = `BOLAGSDATA (JSON):
${JSON.stringify({
          name: company.name, segment: company.segment, city: company.city, country: company.country,
          priority: company.priority, description: company.description, sowPotential: company.sowPotential,
          triggers: company.triggers, entryAngles: company.entryAngles,
          qualifyingQuestions: company.qualifyingQuestions,
          decisionMakers: sanitizeDecisionMakers(company.decisionMakers), lis: company.lis,
        }).slice(0, 7000)}

TIDIGARE HUVUDHYPOTESER (undvik upprepning):
${priorHeadlines.length ? priorHeadlines.map((h: string) => `- ${h}`).join("\n") : "(inga tidigare — detta är första passet)"}

Producera info-packet nu, på ${langName}.`;

        const response = await invokeLLM({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          max_tokens: 8000,
          response_format: { type: "json_schema", json_schema: { name: "intelligence_pack", strict: true, schema: PACK_SCHEMA as any } },
        });

        const parsed = JSON.parse(response.choices[0].message.content);
        parsed.account_id = company.id;
        parsed.account_name = company.name;
        parsed.generated_at = new Date().toISOString();
        parsed.model_used = "claude-opus-4-8";
        if (response.usage) parsed.cost_credits = response.usage.total_tokens;

        // Återför RIKTIGA kontaktuppgifter (de nådde aldrig LLM:en) på beslutsfattarna.
        if (company.decisionMakers?.length) {
          const llmDMs: any[] = parsed.decision_makers || [];
          parsed.decision_makers = company.decisionMakers.map((d: any) => {
            const key = (d.title || "").toLowerCase().split(" ")[0];
            const match = llmDMs.find((x) => x?.role_label && key && String(x.role_label).toLowerCase().includes(key));
            const r = `${d.seniority || ""} ${d.role || ""} ${d.title || ""}`.toLowerCase();
            const cat = /c-level|vd|ceo|ägare|owner|grund/.test(r) ? "Executive" : "Technical";
            return {
              role_label: d.title || "Beslutsfattare",
              role_category: cat,
              name: d.name, title: d.title, email: d.email, mobile: d.phone, linkedin: d.linkedin,
              why_relevant: match?.why_relevant || null,
            };
          });
        }

        await saveGeneratedPack({
          companyId: input.companyId,
          role: input.role,
          headlineHypothesis: parsed.headline_hypothesis,
          payload: parsed,
          generatedBy: roleLabel,
        });
        return parsed;
      }),
  }),

  // ─── Discovery (SPAR) — frågor ur info-pack + Ravema-data, svar → LIS ───────
  discovery: router({
    latest: publicProcedure
      .input(z.object({ companyId: z.number() }))
      .query(async ({ input }) => getLatestDiscovery(input.companyId)),

    generate: publicProcedure
      .input(z.object({
        companyId: z.number(),
        role: z.string().optional(),
        language: z.enum(["sv", "no", "en"]).default("sv"),
      }))
      .mutation(async ({ input }) => {
        if (await isCompanyLocked(input.companyId)) throw new TRPCError({ code: "FORBIDDEN", message: "Kontot är låst — teckna avtal för att låsa upp." });
        const c = await getCompanyById(input.companyId);
        if (!c) throw new TRPCError({ code: "NOT_FOUND", message: "Company not found" });
        const [cs, ss] = await Promise.all([
          getContactsByCompanyId(input.companyId), getSignalsByCompanyId(input.companyId),
        ]);
        const company = dbRowToCompany(c, cs, ss);
        const pack = await getLatestPack(input.companyId);
        const langName = input.language === "no" ? "norska (bokmål)" : input.language === "en" ? "engelska" : "svenska";

        const systemPrompt = `Du är Ravemas Discovery-motor. Givet ett INFO-PACK (hypoteser/signaler) och Ravemas data om bolaget, generera SPAR-Discovery-frågor som säljaren ställer på mötet för att VALIDERA hypoteserna och KVANTIFIERA smärtan.

SPAR:
- Situation: kartlägg nuläget (fakta, miljö, system, volymer) — affärsmässigt före tekniskt.
- Pain: hitta gapet — få kunden att SJÄLV artikulera vad som inte fungerar.
- Affect: KVANTIFIERA kostnaden — ekonomiskt OCH emotionellt (individ/team/bolag). Detta är hjärtat.
- Resolve: låt kunden äga visionen och mäta motivationen.

Frågorna ska vara ÖPPNA och ICKE-LEDANDE — kunden ska artikulera gapet, inte säljaren. Per fråga: 'why' = vad frågan ska avslöja för säljaren. 3–4 frågor per fas. Skriv på ${langName}. Returnera ENBART giltig JSON enligt schemat.`;

        const userPrompt = `INFO-PACK (om genererat):
${pack ? JSON.stringify({ headline: pack.headline_hypothesis, hypothesis: pack.hypothesis, signals: pack.buying_signals, competitors: pack.competitors }).slice(0, 4000) : "(inget pack genererat än — utgå från bolagsdata)"}

RAVEMA-DATA om bolaget:
${JSON.stringify({ name: company.name, segment: company.segment, description: company.description, triggers: company.triggers, entryAngles: company.entryAngles, lis: company.lis }).slice(0, 4000)}

Generera SPAR-Discovery-frågorna nu, på ${langName}.`;

        const response = await invokeLLM({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          max_tokens: 6000,
          response_format: { type: "json_schema", json_schema: { name: "discovery_spar", strict: true, schema: DISCOVERY_SCHEMA as any } },
        });
        return JSON.parse(response.choices[0].message.content);
      }),

    submit: publicProcedure
      .input(z.object({
        companyId: z.number(),
        role: z.string().optional(),
        answers: z.array(z.object({ phase: z.string(), question: z.string(), answer: z.string() })),
      }))
      .mutation(async ({ input }) => {
        await saveDiscoverySession({
          companyId: input.companyId, role: input.role,
          payload: { answers: input.answers }, createdBy: input.role,
        });
        // Reinforcement: bekräftade smärtor (pain/affect med svar) → LIS-signaler
        let signalsCreated = 0;
        for (const a of input.answers) {
          const ans = (a.answer || "").trim();
          if (!ans) continue;
          if (a.phase === "pain" || a.phase === "affect") {
            await addSignal({
              companyId: input.companyId, signalType: "engagement",
              lisType: `DISCOVERY_${a.phase.toUpperCase()}`, source: "discovery",
              title: a.question.slice(0, 200), detail: ans,
            });
            signalsCreated++;
          }
        }
        return { saved: true, signalsCreated };
      }),
  }),

  emails: router({
    count: publicProcedure.query(async () => ({ count: await getGeneratedEmailCount() })),

    byCompany: publicProcedure
      .input(z.object({ companyId: z.number() }))
      .query(async ({ input }) => getEmailsByCompanyId(input.companyId)),

    generate: publicProcedure
      .input(z.object({
        companyId: z.number(),
        contactId: z.number().optional(),
        contactName: z.string(),
        contactTitle: z.string(),
        companyName: z.string(),
        companyCategory: z.string().optional(),
        companyFocus: z.string().optional(),
        companyDescription: z.string().optional(),
        language: z.enum(["sv", "no", "en"]).default("sv"),
        painTheme: z.enum(["auto", "stillestand", "omstallning", "volym"]).default("auto"),
        // ─── LIS intelligence — the actual VALUE: ground the email in the
        // prospect's PAIN, not Ravema's product catalogue. ───────────────
        segment: z.string().optional(),                 // ICP-segment (t.ex. SE-DEF-AERO)
        signals: z.array(z.string()).optional(),         // köpsignaler/triggers + evidens
        entryAngle: z.string().optional(),               // curerad ingångsvinkel
        competitorIncumbent: z.string().optional(),      // befintlig konkurrent (displacement)
        painHypothesis: z.string().optional(),           // explicit smärt-hypotes om curerad
      }))
      .mutation(async ({ input }) => {
        if (await isCompanyLocked(input.companyId)) throw new TRPCError({ code: "FORBIDDEN", message: "Kontot är låst — teckna avtal för att låsa upp." });
        const focusLabel = input.companyFocus === "AAA" ? "högsta prioritet (AAA)" :
          input.companyFocus === "AA" ? "hög prioritet (AA)" :
          input.companyFocus === "A" ? "prioritet (A)" : "prospekt";

        const categoryContext = input.companyCategory || "avancerad industriell tillverkning";

        // Pain-first metodik. Modellen ska resonera kring mottagarens SITUATION
        // och vad smärtan KOSTAR — och först därefter koppla EN relevant förmåga.
        const systemPrompt = input.language === "sv"
          ? `Du är en erfaren B2B-säljare för Ravema AB. Du skriver korta, vassa prospekteringsmejl på svenska som utgår från MOTTAGARENS situation och smärta — aldrig från Ravemas produktkatalog.

Ravema är teknisk partner inom avancerad skärande bearbetning, automation och mätteknik (Mazak, PAMA, Fastems, Erowa, Wenzel m.fl.) — men detta är BAKGRUND, inte mejlets innehåll.

Skriv mejlet i denna ordning:
1. SMÄRTA/SIGNAL: Utgå från en konkret köpsignal eller en sannolik produktionssmärta hos mottagaren (t.ex. ny produktionschef, kapacitetstak, kvalitetskrav som cylindricitet/rundhet/toleranser, utbyggnad, ledtider, kassation, kompetensbrist).
2. KONSEKVENS: Formulera en hypotes om vad smärtan KOSTAR dem — ledtid, kassation, missad kapacitet, kvalitetsavvikelser.
3. KOPPLING: Knyt EN enda relevant förmåga som löser just den smärtan. Nämn produkt/varumärke bara om det stärker hypotesen. ALDRIG en lista av produkter.
4. CTA: En tydlig, låg-friktions-uppmaning (kort samtal eller besök).

Hårda regler:
- Adressera med förnamn; nämn roll och bransch konkret.
- Max 150–180 ord. INGA produktlistor. Ingen generisk "vi erbjuder…"-pitch.
- Ska låta som en människa som gjort sin hemläxa på just detta bolag — inte ett massutskick.
- Om en konkurrent är incumbent: positionera kring en specifik teknisk fördel, inte nedsättande.
- Avsluta med "Med vänliga hälsningar,\\n[Ditt namn]\\nRavema AB".
Returnera JSON: {"subject": "...", "body": "..."}`
          : `You are an experienced B2B sales professional for Ravema AB. You write short, sharp prospecting emails in English that start from the RECIPIENT's situation and pain — never from Ravema's product catalogue.

Ravema is a technical partner in advanced machining, automation and metrology (Mazak, PAMA, Fastems, Erowa, Wenzel, etc.) — but this is BACKGROUND, not the content of the email.

Write the email in this order:
1. PAIN/SIGNAL: Start from a concrete buying signal or a likely production pain (e.g. new production manager, capacity ceiling, quality demands such as cylindricity/roundness/tolerances, expansion, lead times, scrap, skills shortage).
2. CONSEQUENCE: Hypothesise what that pain COSTS them — lead time, scrap, missed capacity, quality deviations.
3. CONNECTION: Tie in ONE single relevant capability that solves that specific pain. Mention a product/brand only if it strengthens the hypothesis. NEVER a list of products.
4. CTA: A clear, low-friction ask (a brief call or visit).

Hard rules:
- Address by first name; name their role and industry concretely.
- Max 150–180 words. NO product lists. No generic "we offer…" pitch.
- Must sound like a human who did their homework on this specific company — not a mass mailing.
- If a competitor is incumbent: position around a specific technical advantage, never disparaging.
- End with "Best regards,\\n[Your name]\\nRavema AB".
Return JSON: {"subject": "...", "body": "..."}`;

        const PAIN_THEMES: Record<string, string> = {
          stillestand: "Oplanerat stillestånd / spindeltid som står stilla — kapacitet de betalar för men inte får ut. Koppla obemannad drift / automation.",
          omstallning: "Omställningstid mellan korta serier — manuell omrigg äter dyrbar spindeltid. Koppla snabbfäste / pallsystem (Erowa/Fastems).",
          volym: "Kapacitetstaket när prototyp ska bli serie — volym och ledtid blir flaskhals. Koppla kapacitet / automation.",
        };
        const themeBlock = input.painTheme && input.painTheme !== "auto"
          ? `Smärt-tema att utgå från: ${PAIN_THEMES[input.painTheme]}`
          : "";

        const signalBlock = input.signals?.length
          ? `Köpsignaler / triggers (GRUNDA MEJLET I DESSA):\n${input.signals.map(s => `- ${s}`).join("\n")}`
          : "";

        const userPrompt = `Skriv ett prospekteringsmejl till:
Mottagarens roll/titel: ${input.contactTitle}
Företag: ${input.companyName}
Bransch/Kategori: ${categoryContext}
${input.segment ? `ICP-segment: ${input.segment}` : ""}
Prioritet: ${focusLabel}
${input.companyDescription ? `Företagsbeskrivning: ${input.companyDescription.substring(0, 400)}` : ""}
${signalBlock}
${themeBlock}
${input.painHypothesis ? `Smärt-hypotes att utgå från: ${input.painHypothesis}` : ""}
${input.entryAngle ? `Curerad ingångsvinkel: ${input.entryAngle}` : ""}
${input.competitorIncumbent ? `Befintlig konkurrent (displacement-läge): ${input.competitorIncumbent}` : ""}

Skriv mejlet pain-first enligt metoden. Inga produktlistor.
Adressera mottagaren med EXAKT platshållaren [FÖRNAMN] (skicka inget riktigt namn — jag fyller i det själv).`;

        const response = await invokeLLM({
          messages: [
            { role: "system", content: systemPrompt + (input.language === "no" ? "\n\nVIKTIG: Skriv HELE e-posten på norsk (bokmål) — ikke svensk eller engelsk." : "") },
            { role: "user", content: userPrompt },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "email_output",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  subject: { type: "string" },
                  body: { type: "string" },
                },
                required: ["subject", "body"],
                additionalProperties: false,
              },
            },
          },
        });

        const content = response.choices[0].message.content;
        const parsed = JSON.parse(typeof content === "string" ? content : JSON.stringify(content));

        // De-tokenisera lokalt: [FÖRNAMN] → riktigt förnamn (namnet nådde aldrig LLM:en).
        const firstName = firstNameOf(input.contactName);
        const subject = (parsed.subject || "").replace(/\[FÖRNAMN\]/g, firstName);
        const body = (parsed.body || "").replace(/\[FÖRNAMN\]/g, firstName);

        const emailId = await saveGeneratedEmail({
          companyId: input.companyId,
          contactId: input.contactId,
          subject,
          body,
          contactName: input.contactName,
          contactTitle: input.contactTitle,
          companyName: input.companyName,
          companyCategory: input.companyCategory,
          companyFocus: input.companyFocus,
          status: "draft",
        });

        return { id: emailId, subject, body };
      }),

    updateStatus: publicProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(["draft", "sent", "opened", "replied"]),
        editedBody: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        await updateEmailStatus(input.id, input.status, input.editedBody);
        return { success: true };
      }),
  }),

  // ─── Activities ───────────────────────────────────────────────────────────
  activities: router({
    byCompany: publicProcedure
      .input(z.object({ companyId: z.number() }))
      .query(async ({ input }) => getActivitiesByCompanyId(input.companyId)),

    add: publicProcedure
      .input(z.object({
        companyId: z.number(),
        contactId: z.number().optional(),
        type: z.enum(["email_sent", "email_opened", "email_replied", "meeting_booked", "call", "note"]),
        description: z.string().optional(),
        performedBy: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        await addActivity(input);
        return { success: true };
      }),
  }),

  // ─── Signals (LIS buying-signal timeline per company) ─────────────────────
  signals: router({
    byCompany: publicProcedure
      .input(z.object({ companyId: z.number() }))
      .query(async ({ input }) => getSignalsByCompanyId(input.companyId)),
  }),

  // ─── Dashboard ────────────────────────────────────────────────────────────
  dashboard: router({
    stats: publicProcedure.query(async () => getDashboardStats()),
  }),

  // ─── Weekly Assignments (admin only) ──────────────────────────────────────
  assignments: router({
    list: adminProcedure.query(async () => getWeeklyAssignments()),

    create: adminProcedure
      .input(z.object({
        assignedToUserId: z.number(),
        assignedToName: z.string(),
        weekLabel: z.string(),
        companyIds: z.array(z.number()),
      }))
      .mutation(async ({ ctx, input }) => {
        const weeklyId = await createWeeklyAssignment({
          ...input,
          createdByUserId: ctx.user.id,
        });
        return { success: true, weeklyId };
      }),

    companiesByList: adminProcedure
      .input(z.object({ weeklyListId: z.number() }))
      .query(async ({ input }) => getCompaniesByWeeklyList(input.weeklyListId)),
  }),

  // ─── Webhook (Clay HTTP API) ───────────────────────────────────────────────
  webhook: router({
    clay: publicProcedure
      .input(z.object({
        company_name: z.string().optional(),
        company_domain: z.string().optional(),
        category: z.string().optional(),
        city: z.string().optional(),
        country: z.string().optional(),
        focus: z.string().optional(),
        source: z.string().optional(),
        Name: z.string().optional(),
        Website: z.string().optional(),
        "Employee Count": z.union([z.string(), z.number()]).optional(),
        Size: z.string().optional(),
        Industry: z.string().optional(),
        Description: z.string().optional(),
        Url: z.string().optional(),
        Founded: z.union([z.string(), z.number()]).optional(),
        "First Name": z.string().optional(),
        "Last Name": z.string().optional(),
        "Full Name": z.string().optional(),
        "Job Title": z.string().optional(),
        Location: z.string().optional(),
        "Company Domain": z.string().optional(),
        "LinkedIn Profile": z.string().optional(),
        "Work Email": z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        try {
          const domain = input.company_domain || input["Company Domain"] || "";
          const companyName = input.company_name || input.Name || "";

          if (!companyName && !domain) {
            return { success: false, message: "No company identifier provided" };
          }

          const companyId = await upsertCompany({
            name: companyName,
            domain: domain || undefined,
            category: input.category || undefined,
            focus: input.focus || undefined,
            source: input.source || undefined,
            city: input.city || undefined,
            country: input.country || undefined,
            description: input.Description || undefined,
            industry: input.Industry || undefined,
            employeeCount: input["Employee Count"] ? Number(input["Employee Count"]) : undefined,
            employeeRange: input.Size || undefined,
            linkedinUrl: input.Url || undefined,
            websiteUrl: input.Website || undefined,
            enrichedAt: new Date(),
          });

          let contactId: number | undefined;
          if (input["Full Name"] || input["First Name"]) {
            contactId = await upsertContact({
              companyId,
              firstName: input["First Name"] || undefined,
              lastName: input["Last Name"] || undefined,
              fullName: input["Full Name"] || `${input["First Name"] || ""} ${input["Last Name"] || ""}`.trim() || undefined,
              title: input["Job Title"] || undefined,
              email: input["Work Email"] || undefined,
              emailVerified: !!(input["Work Email"]),
              linkedinUrl: input["LinkedIn Profile"] || undefined,
              location: input.Location || undefined,
            });
          }

          await logWebhook({
            source: "clay",
            payload: JSON.stringify(input).substring(0, 5000),
            status: "success",
            companiesCreated: 1,
            contactsCreated: contactId ? 1 : 0,
          });

          return { success: true, companyId, contactId };
        } catch (error: any) {
          await logWebhook({
            source: "clay",
            payload: JSON.stringify(input).substring(0, 5000),
            status: "error",
            errorMessage: error.message,
          });
          throw error;
        }
      }),
  }),
});

export type AppRouter = typeof appRouter;
