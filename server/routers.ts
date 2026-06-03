import { COOKIE_NAME } from "@shared/const";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";
import { TRPCError } from "@trpc/server";
import {
  getAllCompanies, getCompanyById, searchCompanies, upsertCompany, updateCompanyStatus,
  assignCompanyToUser, getCompaniesByAssignedUser, getUnassignedCompanies,
  getContactsByCompanyId, getContactById, upsertContact, getAllContacts, updateContactPhone,
  getEmailsByCompanyId, saveGeneratedEmail, updateEmailStatus,
  getActivitiesByCompanyId, addActivity,
  getDashboardStats, logWebhook,
  getAllUsers, getUserById, updateUserRole,
  createWeeklyAssignment, getWeeklyAssignments, getCompaniesByWeeklyList,
  getSignalsByCompanyId, updateCompanyTier, getIcpChangesByCompanyId,
} from "./db";

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
    list: publicProcedure.query(async () => getAllCompanies()),

    search: publicProcedure
      .input(z.object({ query: z.string() }))
      .query(async ({ input }) => searchCompanies(input.query)),

    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => getCompanyById(input.id)),

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
  }),

  // ─── Emails ───────────────────────────────────────────────────────────────
  emails: router({
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
        language: z.enum(["sv", "en"]).default("sv"),
        // ─── LIS intelligence — the actual VALUE: ground the email in the
        // prospect's PAIN, not Ravema's product catalogue. ───────────────
        segment: z.string().optional(),                 // ICP-segment (t.ex. SE-DEF-AERO)
        signals: z.array(z.string()).optional(),         // köpsignaler/triggers + evidens
        entryAngle: z.string().optional(),               // curerad ingångsvinkel
        competitorIncumbent: z.string().optional(),      // befintlig konkurrent (displacement)
        painHypothesis: z.string().optional(),           // explicit smärt-hypotes om curerad
      }))
      .mutation(async ({ input }) => {
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

        const signalBlock = input.signals?.length
          ? `Köpsignaler / triggers (GRUNDA MEJLET I DESSA):\n${input.signals.map(s => `- ${s}`).join("\n")}`
          : "";

        const userPrompt = `Skriv ett prospekteringsmejl till:
Namn: ${input.contactName}
Titel: ${input.contactTitle}
Företag: ${input.companyName}
Bransch/Kategori: ${categoryContext}
${input.segment ? `ICP-segment: ${input.segment}` : ""}
Prioritet: ${focusLabel}
${input.companyDescription ? `Företagsbeskrivning: ${input.companyDescription.substring(0, 400)}` : ""}
${signalBlock}
${input.painHypothesis ? `Smärt-hypotes att utgå från: ${input.painHypothesis}` : ""}
${input.entryAngle ? `Curerad ingångsvinkel: ${input.entryAngle}` : ""}
${input.competitorIncumbent ? `Befintlig konkurrent (displacement-läge): ${input.competitorIncumbent}` : ""}

Skriv mejlet pain-first enligt metoden. Inga produktlistor.`;

        const response = await invokeLLM({
          messages: [
            { role: "system", content: systemPrompt },
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

        const emailId = await saveGeneratedEmail({
          companyId: input.companyId,
          contactId: input.contactId,
          subject: parsed.subject,
          body: parsed.body,
          contactName: input.contactName,
          contactTitle: input.contactTitle,
          companyName: input.companyName,
          companyCategory: input.companyCategory,
          companyFocus: input.companyFocus,
          status: "draft",
        });

        return { id: emailId, subject: parsed.subject, body: parsed.body };
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
