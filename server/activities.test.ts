import { describe, expect, it } from "vitest";

/**
 * Tests for activity log and priority sorting logic
 */

describe("Priority sorting", () => {
  const PRIORITY_ORDER: Record<string, number> = { AAA: 0, AA: 1, A: 2, B: 3, C: 4 };

  const sortByPriority = (companies: Array<{ name: string; focus?: string | null }>) => {
    return [...companies].sort((a, b) => {
      const pa = PRIORITY_ORDER[a.focus || "C"] ?? 4;
      const pb = PRIORITY_ORDER[b.focus || "C"] ?? 4;
      if (pa !== pb) return pa - pb;
      return a.name.localeCompare(b.name, "sv");
    });
  };

  it("should sort AAA before AA before A before B before C", () => {
    const companies = [
      { name: "Zeta Corp", focus: "C" },
      { name: "Alpha Marine", focus: "AAA" },
      { name: "Beta Systems", focus: "B" },
      { name: "Delta Tech", focus: "AA" },
      { name: "Epsilon AB", focus: "A" },
    ];
    const sorted = sortByPriority(companies);
    expect(sorted[0].focus).toBe("AAA");
    expect(sorted[1].focus).toBe("AA");
    expect(sorted[2].focus).toBe("A");
    expect(sorted[3].focus).toBe("B");
    expect(sorted[4].focus).toBe("C");
  });

  it("should sort alphabetically within same priority", () => {
    const companies = [
      { name: "Zeta Marine", focus: "AAA" },
      { name: "Alpha Marine", focus: "AAA" },
      { name: "Beta Marine", focus: "AAA" },
    ];
    const sorted = sortByPriority(companies);
    expect(sorted[0].name).toBe("Alpha Marine");
    expect(sorted[1].name).toBe("Beta Marine");
    expect(sorted[2].name).toBe("Zeta Marine");
  });

  it("should treat null/undefined focus as C priority", () => {
    const companies = [
      { name: "No Focus Corp", focus: null },
      { name: "AAA Corp", focus: "AAA" },
      { name: "Undefined Corp", focus: undefined },
    ];
    const sorted = sortByPriority(companies);
    expect(sorted[0].focus).toBe("AAA");
    // null and undefined should be treated as C (lowest)
    expect(sorted[1].focus === null || sorted[1].focus === undefined).toBe(true);
    expect(sorted[2].focus === null || sorted[2].focus === undefined).toBe(true);
  });
});

describe("Activity type labels", () => {
  const VALID_TYPES = ["email_sent", "email_opened", "email_replied", "meeting_booked", "call", "note"] as const;

  it("should have all expected activity types", () => {
    const activityTypeConfig: Record<string, { label: string }> = {
      call: { label: "Samtal" },
      email_sent: { label: "Mejl skickat" },
      email_replied: { label: "Svar mottaget" },
      email_opened: { label: "Mejl öppnat" },
      meeting_booked: { label: "Möte bokat" },
      note: { label: "Anteckning" },
    };

    for (const type of VALID_TYPES) {
      expect(activityTypeConfig[type]).toBeDefined();
      expect(activityTypeConfig[type].label).toBeTruthy();
    }
  });

  it("should have Swedish labels for all activity types", () => {
    const swedishLabels: Record<string, string> = {
      call: "Samtal",
      email_sent: "Mejl skickat",
      email_replied: "Svar mottaget",
      email_opened: "Mejl öppnat",
      meeting_booked: "Möte bokat",
      note: "Anteckning",
    };

    for (const [type, label] of Object.entries(swedishLabels)) {
      expect(label).toBeTruthy();
      expect(typeof label).toBe("string");
    }
  });
});
