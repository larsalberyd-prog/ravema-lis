import { ENV } from "./_core/env";

const CLAY_API_BASE = "https://api.clay.com/v1";

export interface ClayCompanyInput {
  company_domain: string;
  segment?: string;
}

export interface ClayDecisionMaker {
  name: string;
  title: string;
  email?: string;
  phone?: string;
  linkedin?: string;
  role?: string;
}

export interface ClayTrigger {
  text: string;
  source: string;
  relevance: string;
}

export interface ClayEntryAngle {
  angle: string;
  target: string;
  product?: string;
}

export interface ClayQualifyingQuestion {
  question: string;
  category: string;
  purpose?: string;
}

export interface ClayEnrichedData {
  company_name?: string;
  industry?: string;
  employee_count?: string;
  revenue?: string;
  description?: string;
  decision_makers?: ClayDecisionMaker[];
  triggers?: ClayTrigger[];
  entry_angles?: ClayEntryAngle[];
  qualifying_questions?: ClayQualifyingQuestion[];
}

/**
 * Add a new row to Clay table for enrichment
 */
export async function addCompanyToClay(input: ClayCompanyInput): Promise<{ rowId: string }> {
  const response = await fetch(`${CLAY_API_BASE}/tables/${ENV.clayTableId}/rows`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${ENV.clayApiKey}`,
    },
    body: JSON.stringify({
      fields: {
        company_domain: input.company_domain,
        segment: input.segment || "",
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Clay API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return { rowId: data.id };
}

/**
 * Get enriched data for a company from Clay
 */
export async function getEnrichedDataFromClay(rowId: string): Promise<ClayEnrichedData> {
  const response = await fetch(`${CLAY_API_BASE}/tables/${ENV.clayTableId}/rows/${rowId}`, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${ENV.clayApiKey}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Clay API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  
  // Parse JSON fields from Clay
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
    company_name: data.fields?.company_name || data.fields?.org,
    industry: data.fields?.industry,
    employee_count: data.fields?.employee_count,
    revenue: data.fields?.revenue,
    description: data.fields?.description,
    decision_makers: parseJSON(data.fields?.decision_makers),
    triggers: parseJSON(data.fields?.triggers),
    entry_angles: parseJSON(data.fields?.entry_angles),
    qualifying_questions: parseJSON(data.fields?.qualifying_questions),
  };
}

/**
 * Test Clay API connection
 */
export async function testClayConnection(): Promise<boolean> {
  try {
    const response = await fetch(`${CLAY_API_BASE}/tables/${ENV.clayTableId}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${ENV.clayApiKey}`,
      },
    });
    return response.ok;
  } catch {
    return false;
  }
}
