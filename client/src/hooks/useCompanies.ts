import { useState, useEffect } from "react";
import companiesData from "@/data/companies.json";

export interface DecisionMaker {
  name: string;
  title: string;
  role: "Executive" | "Technical" | "Buyer" | "Gatekeeper" | "Other";
  email: string | null;
  phone: string | null;
  linkedin: string | null;
  linkedin_search?: string;
  email_patterns?: string[];
  email_alternatives?: string[];
  priority: "high" | "medium" | "low";
}

export interface QualifierAnswer {
  question: string;
  answer: string | null;
  answeredAt: string | null;
}

export interface LisSignal {
  type: string;
  detail: string;
  date?: string | null;
  evidenceSource?: string | null;
}

export interface LisScoreBreakdown {
  firmographic: number;
  capacity: number;
  signals: number;
  engagement: number;
  strategic: number;
}

export interface LisMeta {
  tier: "AAA" | "AA" | "A" | "B" | "C";
  scoreTotal: number;
  scoreBreakdown: LisScoreBreakdown;
  reasons: string[];
  overrides: string[];
  confidence: "high" | "medium" | "low";
  signals: LisSignal[];
  district?: string | null;
  competitorIncumbent?: string | null;
  managementPriority: boolean;
  rationaleKlas?: string;
}

export interface Company {
  id: string;
  name: string;
  country: string;
  city: string;
  segment: string;
  priority: "AAA" | "AA" | "A" | "B" | "C";
  status: "new" | "contacted" | "meeting" | "qualified";
  assignedTo: string | null;
  deadline: string | null;
  description: string;
  sowPotential: string;
  triggers: string[];
  decisionMakers: DecisionMaker[];
  entryAngles: string[];
  qualifyingQuestions: string[];
  qualifierAnswers?: QualifierAnswer[];
  nextSteps: string | null;
  notes: string | null;
  lis?: LisMeta;
}

const STORAGE_KEY = "ravema-lis-companies-v2";

export function useCompanies() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setCompanies(JSON.parse(stored));
      } catch (e) {
        console.error("Failed to parse stored companies:", e);
        setCompanies(companiesData as Company[]);
      }
    } else {
      setCompanies(companiesData as Company[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!loading && companies.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(companies));
    }
  }, [companies, loading]);

  const updateCompany = (id: string, updates: Partial<Company>) => {
    setCompanies((prev) =>
      prev.map((company) =>
        company.id === id ? { ...company, ...updates } : company
      )
    );
  };

  const assignCompany = (id: string, assignedTo: string, deadline: string) => {
    updateCompany(id, { assignedTo, deadline, status: "contacted" });
  };

  const updateStatus = (id: string, status: "new" | "contacted" | "meeting" | "qualified") => {
    updateCompany(id, { status });
  };

  const addCompany = (company: Company) => {
    setCompanies((prev) => [...prev, company]);
  };

  return { companies, loading, updateCompany, assignCompany, updateStatus, addCompany };
}
