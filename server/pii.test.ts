import { describe, it, expect } from "vitest";
import { scrubText, containsPII, sanitizeDecisionMakers, firstNameOf } from "./pii";

describe("PII-anonymisering före LLM (Order 1)", () => {
  it("scrubText maskar e-post och telefon", () => {
    const s = "Kontakta mattias.eriksson@ateknik.se på 0934-397 10 eller +46 70 203 26 12.";
    const out = scrubText(s);
    expect(out).not.toContain("@ateknik.se");
    expect(out).not.toMatch(/0934/);
    expect(out).not.toMatch(/\+46 70 203/);
    expect(containsPII(out)).toBe(false);
  });

  it("containsPII känner igen e-post och telefon men inte bolagsdata", () => {
    expect(containsPII("a@b.se")).toBe(true);
    expect(containsPII("ring 0709-221516")).toBe(true);
    expect(containsPII("Bolag X, VD-roll, 125 MSEK nyemission dec 2025")).toBe(false);
  });

  it("sanitizeDecisionMakers tar bort namn/e-post/mobil/linkedin (behåller roll/titel)", () => {
    const dms = [{
      name: "Mattias Eriksson", title: "VD", role: "Ledning", seniority: "c-level",
      email: "mattias.eriksson@ateknik.se", phone: "0934-397 10",
      linkedin: "https://linkedin.com/in/x", priority: "high",
    }];
    const json = JSON.stringify(sanitizeDecisionMakers(dms));
    expect(json).not.toContain("Mattias");
    expect(json).not.toContain("@");
    expect(json).not.toContain("0934");
    expect(json.toLowerCase()).not.toContain("linkedin");
    expect(containsPII(json)).toBe(false);
    expect(sanitizeDecisionMakers(dms)[0].title).toBe("VD");
  });

  it("INVARIANT: en LLM-payload byggd av PII-data innehåller ingen PII", () => {
    const company = {
      name: "ACC Innovation",
      description: "Ring VD på 0709-221516, mail vd@acc.se",
      decisionMakers: [{ name: "Max Drougge", title: "CTO", email: "max@acc.se", phone: "+46 76 161 86 43" }],
    };
    const payload = scrubText(JSON.stringify({
      name: company.name,
      description: company.description,
      decisionMakers: sanitizeDecisionMakers(company.decisionMakers),
    }));
    expect(containsPII(payload)).toBe(false);
    expect(payload).not.toContain("Max Drougge");
    expect(payload).not.toContain("@acc.se");
  });

  it("firstNameOf ger förnamn och hanterar Sök:-platshållare", () => {
    expect(firstNameOf("Mattias Eriksson")).toBe("Mattias");
    expect(firstNameOf("Sök: VD")).toBe("där");
    expect(firstNameOf("")).toBe("där");
  });
});
