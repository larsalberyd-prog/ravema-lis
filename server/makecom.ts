import { ENV } from "./_core/env";

export interface MakeComCompanyInput {
  company_domain: string;
  company_name: string;
  country: string;
  city: string;
  segment: string;
}

export interface MakeComDecisionMaker {
  name: string;
  title: string;
  email?: string;
  phone?: string;
  linkedin?: string;
  role?: string;
}

export interface MakeComTrigger {
  text: string;
  source: string;
  relevance: string;
}

export interface MakeComEntryAngle {
  angle: string;
  target: string;
  product?: string;
}

export interface MakeComQualifyingQuestion {
  question: string;
  category: string;
  purpose?: string;
}

export interface MakeComEnrichedData {
  success: boolean;
  company_name?: string;
  industry?: string;
  employee_count?: string;
  revenue?: string;
  description?: string;
  decision_makers?: MakeComDecisionMaker[];
  triggers?: MakeComTrigger[];
  entry_angles?: MakeComEntryAngle[];
  qualifying_questions?: MakeComQualifyingQuestion[];
}

/**
 * Send company data to Make.com webhook for enrichment via Clay
 */
export async function enrichCompanyViaMake(input: MakeComCompanyInput): Promise<MakeComEnrichedData> {
  const makeWebhookUrl = ENV.makeWebhookUrl;
  
  if (!makeWebhookUrl) {
    throw new Error("MAKE_WEBHOOK_URL is not configured");
  }

  const response = await fetch(makeWebhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      company_domain: input.company_domain,
      company_name: input.company_name,
      country: input.country,
      city: input.city,
      segment: input.segment,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Make.com webhook error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  
  // Parse JSON strings if needed
  const parseJSON = (field: any) => {
    if (!field) return undefined;
    if (typeof field === "string") {
      try {
        return JSON.parse(field);
      } catch {
        return undefined;
      }
    }
    return field;
  };

  return {
    success: data.success ?? false,
    company_name: data.company_name,
    industry: data.industry,
    employee_count: data.employee_count,
    revenue: data.revenue,
    description: data.description,
    decision_makers: parseJSON(data.decision_makers),
    triggers: parseJSON(data.triggers),
    entry_angles: parseJSON(data.entry_angles),
    qualifying_questions: parseJSON(data.qualifying_questions),
  };
}
