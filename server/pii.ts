/**
 * PII-anonymisering före LLM (Order 1, multi-tenant-säkerhet).
 *
 * Persondata (namn, e-post, mobilnummer) får ALDRIG skickas till språkmodellen.
 * - Anroparna skickar roll/titel + platshållare (t.ex. [FÖRNAMN]) — inte riktiga namn.
 * - Beslutsfattare saneras till titel/roll innan de serialiseras i en prompt;
 *   riktiga kontaktuppgifter återförs i svaret EFTER generering.
 * - invokeLLM kör scrubText som sista skyddsnät på allt utgående innehåll.
 *
 * Invarianten (inga persondatafält i LLM-payloaden) bevisas i pii.test.ts.
 */

// E-post: hög precision, säkert att maska.
const EMAIL_RE = () => /[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/g;
// Telefon: konservativ — internationellt (+/00) eller nordiskt 0-prefix, 8+ siffror.
const PHONE_RE = () => /(?:\+|00)\d[\d\s\-]{6,}\d|\b0\d[\d\s\-]{6,}\d\b/g;

/** Maska e-post + telefonnummer i fri text (skyddsnät vid LLM-gränsen). */
export function scrubText(s: string): string {
  if (!s) return s;
  return s.replace(EMAIL_RE(), "[REDACTED-EMAIL]").replace(PHONE_RE(), "[REDACTED-PHONE]");
}

/** Finns e-post eller telefon i texten? (för test/assertion) */
export function containsPII(s: string): boolean {
  return EMAIL_RE().test(s || "") || PHONE_RE().test(s || "");
}

/**
 * Sanera beslutsfattare för LLM: behåll endast roll/titel/senioritet —
 * släng namn, e-post, mobil, linkedin. AI:n analyserar bolag och roll,
 * aldrig individen.
 */
export function sanitizeDecisionMakers(dms: any[]): Array<{ title: string | null; role: string | null; seniority: string | null; priority: string | null }> {
  return (dms || []).map((d) => ({
    title: d?.title ?? null,
    role: d?.role ?? null,
    seniority: d?.seniority ?? null,
    priority: d?.priority ?? null,
  }));
}

/** Förnamn ur ett fullständigt namn (för lokal de-tokenisering av [FÖRNAMN]). */
export function firstNameOf(fullName?: string | null): string {
  const n = (fullName || "").trim().split(/\s+/)[0];
  return n && !n.startsWith("Sök:") ? n : "där";
}
