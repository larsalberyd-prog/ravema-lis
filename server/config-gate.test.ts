import { describe, it, expect } from "vitest";
import { phaseTransitionError } from "./db";

describe("Config-granskningsgrind (Order 2)", () => {
  it("blockerar test-fas på draft-config med tydligt fel", () => {
    const err = phaseTransitionError("test", "draft");
    expect(err).toBeTruthy();
    expect(err).toMatch(/draft/i);
    expect(err).toMatch(/test-fas/i);
  });

  it("tillåter test-fas när config är reviewed eller live", () => {
    expect(phaseTransitionError("test", "reviewed")).toBeNull();
    expect(phaseTransitionError("test", "live")).toBeNull();
  });

  it("pilot/normal påverkas inte av config-status", () => {
    expect(phaseTransitionError("pilot", "draft")).toBeNull();
    expect(phaseTransitionError("normal", "draft")).toBeNull();
  });
});
