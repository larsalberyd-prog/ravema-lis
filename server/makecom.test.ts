import { describe, it, expect } from "vitest";
import { ENV } from "./_core/env";

describe("Make.com Integration", () => {
  it("should have MAKE_WEBHOOK_URL configured", () => {
    expect(ENV.makeWebhookUrl).toBeTruthy();
    expect(ENV.makeWebhookUrl).toContain("hook.eu1.make.com");
  });

  it("should be able to send test data to Make.com webhook", async () => {
    const testData = {
      company_domain: "test.com",
      company_name: "Test Company",
      country: "Sverige",
      city: "Stockholm",
      segment: "Test Segment",
    };

    const response = await fetch(ENV.makeWebhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(testData),
    });

    // Make.com webhook should accept the request
    expect(response.ok).toBe(true);
    
    const data = await response.json();
    expect(data).toHaveProperty("success");
  }, 90000); // 90 second timeout for Clay enrichment
});
