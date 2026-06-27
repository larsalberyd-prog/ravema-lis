import { trpc } from "@/lib/trpc";

export interface DecisionMaker {
  id?: number;
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
  id: string;            // stable slug — used for routing + as the public key
  dbId?: number;         // numeric DB id — mutations key on this (set by the backend mapper)
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
  updatedAt?: string | null;
  locked?: boolean;          // test-läge: konton utanför den upplåsta kvoten (12 SE + 6 NO)
  testOpen?: boolean;        // test-läge: konto inom kvoten = öppet
  lis?: LisMeta;
}

/**
 * Live data hook — reads companies from the tRPC/MySQL backend (was: static
 * companies.json + localStorage). The hook API is unchanged so the consuming
 * pages need no edits; mutations persist to the DB and invalidate the query.
 *
 * Slice 1 of the rebuild (APP-STRATEGI: "gör appen levande"). Note: only
 * status/assignment persist for now via `companies.updateStatus`; richer field
 * edits (qualifierAnswers etc.) get their own mutations in a later slice.
 */
export function useCompanies() {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.companies.list.useQuery(undefined, { staleTime: 60_000 });
  const companies = (data ?? []) as Company[];

  const statusMutation = trpc.companies.updateStatus.useMutation({
    onSuccess: () => utils.companies.list.invalidate(),
  });

  const dbIdOf = (id: string) => companies.find((c) => c.id === id)?.dbId;

  const updateStatus = (id: string, status: "new" | "contacted" | "meeting" | "qualified") => {
    const dbId = dbIdOf(id);
    if (dbId != null) statusMutation.mutate({ id: dbId, status });
  };

  const assignCompany = (id: string, assignedTo: string, _deadline: string) => {
    const dbId = dbIdOf(id);
    if (dbId != null) statusMutation.mutate({ id: dbId, status: "contacted", assignedTo });
  };

  const updateCompany = (id: string, updates: Partial<Company>) => {
    const dbId = dbIdOf(id);
    if (dbId == null) return;
    if (updates.status || updates.notes !== undefined) {
      statusMutation.mutate({
        id: dbId,
        status: (updates.status ?? companies.find((c) => c.id === id)?.status ?? "new"),
        ...(updates.notes !== undefined ? { notes: updates.notes ?? undefined } : {}),
      });
    }
  };

  // New companies are created server-side (Clay webhook / import); refresh the list.
  const addCompany = (_company: Company) => {
    utils.companies.list.invalidate();
  };

  return { companies, loading: isLoading, updateCompany, assignCompany, updateStatus, addCompany };
}
