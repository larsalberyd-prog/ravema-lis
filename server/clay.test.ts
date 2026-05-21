import { describe, it, expect } from "vitest";
import { testClayConnection } from "./clay";

describe("Clay API Integration", () => {
  it("should successfully connect to Clay API with provided credentials", async () => {
    const isConnected = await testClayConnection();
    expect(isConnected).toBe(true);
  }, 10000); // 10 second timeout for API call
});
