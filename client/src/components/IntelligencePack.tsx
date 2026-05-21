import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Brain, RefreshCw, Target, BookOpen, Users, TrendingUp, Activity,
  ClipboardList, HelpCircle, Swords, AlertTriangle, Flame, Snowflake,
  Mail, Phone, Linkedin, Copy,
} from "lucide-react";
import { toast } from "sonner";

// Brief schema — matches lis-core/agents/brief/schema.py
export interface BriefSource {
  label: string;
  detail?: string | null;
  url?: string | null;
}

export interface BriefSignal {
  headline: string;
  detail?: string | null;
  date?: string | null;
  impact: "high" | "medium" | "low";
  linked_decision_maker?: string | null;
}

export interface BriefDecisionMaker {
  role_label: string;
  role_category: "Executive" | "Technical";
  name?: string | null;
  title?: string | null;
  email?: string | null;
  mobile?: string | null;
  linkedin?: string | null;
  why_relevant?: string | null;
}

export interface BriefCompetitor {
  name: string;
  incumbent_machines?: string | null;
  displacement_angle?: string | null;
}

export interface IntelligencePackData {
  account_id: string;
  account_name: string;
  headline_hypothesis: string;
  subtitle?: string | null;
  urgency: "sälj_nu" | "varma_ledet" | "långsiktig" | "monitor";
  urgency_reason: string;
  hypothesis: string;
  sources: BriefSource[];
  decision_makers: BriefDecisionMaker[];
  market_trend?: string | null;
  buying_signals: BriefSignal[];
  prospecting_plan: string[];
  qualifying_questions: string[];
  competitors: BriefCompetitor[];
  generated_at?: string | null;
  model_used?: string | null;
  cost_credits?: number;
}

// Load all briefs at build time via Vite's glob import
const briefModules = import.meta.glob("@/data/briefs/*.json", { eager: true, import: "default" }) as Record<string, IntelligencePackData>;
const briefsById: Record<string, IntelligencePackData> = {};
for (const path in briefModules) {
  const id = path.split("/").pop()!.replace(".json", "");
  briefsById[id] = briefModules[path];
}

export function getBrief(accountId: string): IntelligencePackData | null {
  return briefsById[accountId] || null;
}

const urgencyStyles: Record<string, { label: string; bg: string; text: string; icon: React.ReactNode }> = {
  sälj_nu: { label: "SÄLJ NU — VARMT FÖNSTER", bg: "bg-red-50 border-red-300", text: "text-red-900", icon: <Flame className="w-5 h-5" /> },
  varma_ledet: { label: "VARMA LEDET — 1-6 MÅNADERS-FÖNSTER", bg: "bg-orange-50 border-orange-300", text: "text-orange-900", icon: <TrendingUp className="w-5 h-5" /> },
  långsiktig: { label: "LÅNGSIKTIG — STRATEGISK", bg: "bg-blue-50 border-blue-300", text: "text-blue-900", icon: <BookOpen className="w-5 h-5" /> },
  monitor: { label: "MONITOR — INGEN AFFÄR NU", bg: "bg-gray-100 border-gray-300", text: "text-gray-700", icon: <Snowflake className="w-5 h-5" /> },
};

const impactColor: Record<string, string> = {
  high: "border-red-300 text-red-700 bg-red-50",
  medium: "border-orange-300 text-orange-700 bg-orange-50",
  low: "border-gray-300 text-gray-600 bg-gray-50",
};

const ROLE_ORDER = ["Ägare", "VD / CEO", "COO / Produktionschef", "Teknikchef", "Fabrikschef"];

interface Props {
  brief: IntelligencePackData;
  onRegenerate?: () => void;
}

export default function IntelligencePack({ brief, onRegenerate }: Props) {
  const [regenerating, setRegenerating] = useState(false);

  const handleRegenerate = () => {
    setRegenerating(true);
    toast.info("Genererar om Intelligence Pack...", {
      description: "Live LLM-call kräver Anthropic API-nyckel + backend (kommer i v2.1)",
    });
    setTimeout(() => {
      setRegenerating(false);
      onRegenerate?.();
    }, 1500);
  };

  const copyAll = () => {
    const text = formatBriefAsText(brief);
    navigator.clipboard.writeText(text);
    toast.success("Hela briefen kopierad till urklipp!");
  };

  const urgency = urgencyStyles[brief.urgency] || urgencyStyles.varma_ledet;

  // Sort decision makers by Ravema's 5-role priority order
  const sortedDMs = [...brief.decision_makers].sort((a, b) => {
    const ai = ROLE_ORDER.indexOf(a.role_label);
    const bi = ROLE_ORDER.indexOf(b.role_label);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  return (
    <Card className="border-2 border-red-200 bg-gradient-to-br from-white via-red-50/20 to-orange-50/20">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-red-600 flex items-center justify-center flex-shrink-0">
              <Brain className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <CardTitle className="text-lg flex items-center gap-2 flex-wrap">
                Intelligence Pack
                <Badge variant="outline" className="text-[10px]">{brief.model_used || "auto"}</Badge>
              </CardTitle>
              <p className="text-base font-semibold text-gray-900 mt-1">{brief.headline_hypothesis}</p>
              {brief.subtitle && <p className="text-sm text-gray-600 mt-0.5">{brief.subtitle}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button variant="outline" size="sm" onClick={copyAll} className="gap-1">
              <Copy className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Kopiera</span>
            </Button>
            <Button
              size="sm"
              onClick={handleRegenerate}
              disabled={regenerating}
              className="bg-red-600 hover:bg-red-700 gap-1"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${regenerating ? "animate-spin" : ""}`} />
              Generera om
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Urgency banner */}
        <div className={`border-2 rounded-lg p-3 ${urgency.bg}`}>
          <div className={`flex items-center gap-2 font-bold text-sm ${urgency.text} mb-1`}>
            {urgency.icon}
            {urgency.label}
          </div>
          <p className={`text-sm ${urgency.text}`}>{brief.urgency_reason}</p>
        </div>

        {/* Grid: 2-col on lg+, 1-col on smaller */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">

          {/* Hypotes (full width on lg) */}
          <Card className="lg:col-span-2 border-red-100">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Target className="w-4 h-4 text-red-600" />
                🎯 Hypotes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{brief.hypothesis}</p>
            </CardContent>
          </Card>

          {/* Källor */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <BookOpen className="w-4 h-4 text-blue-600" />
                📚 Källor ({brief.sources.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {brief.sources.map((s, i) => (
                  <li key={i} className="text-xs border-l-2 border-blue-200 pl-2">
                    <span className="font-medium text-gray-900">{s.label}</span>
                    {s.detail && <span className="text-gray-600"> — {s.detail}</span>}
                    {s.url && (
                      <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 ml-1 hover:underline">↗</a>
                    )}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Köpsignaler */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Activity className="w-4 h-4 text-green-600" />
                🧭 Köpsignaler ({brief.buying_signals.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {brief.buying_signals.map((sig, i) => (
                  <li key={i} className="text-xs space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className={`text-[10px] ${impactColor[sig.impact]}`}>
                        {sig.impact}
                      </Badge>
                      {sig.date && <span className="text-gray-400">{sig.date}</span>}
                    </div>
                    <p className="font-medium text-gray-900">{sig.headline}</p>
                    {sig.detail && <p className="text-gray-600">{sig.detail}</p>}
                    {sig.linked_decision_maker && (
                      <p className="text-purple-700 text-[11px]">→ kopplad till: {sig.linked_decision_maker}</p>
                    )}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Beslutsfattare (full width on lg) */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Users className="w-4 h-4 text-gray-700" />
                🛍 Nuvarande beslutsfattare ({sortedDMs.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {sortedDMs.map((dm, i) => (
                  <div key={i} className="border border-gray-200 rounded-lg p-2.5 bg-white hover:border-red-200 transition-colors">
                    <div className="flex items-center justify-between mb-1">
                      <Badge variant="outline" className="text-[10px]">{dm.role_label}</Badge>
                      <Badge variant="outline" className={`text-[10px] ${dm.role_category === "Executive" ? "border-red-200 text-red-700" : "border-blue-200 text-blue-700"}`}>
                        {dm.role_category}
                      </Badge>
                    </div>
                    <p className={`font-medium text-sm ${dm.name?.startsWith("Sök:") ? "text-gray-500 italic" : "text-gray-900"}`}>
                      {dm.name || "—"}
                    </p>
                    {dm.title && <p className="text-xs text-gray-500 truncate">{dm.title}</p>}
                    <div className="flex flex-wrap items-center gap-1.5 mt-2">
                      {dm.email && (
                        <a href={`mailto:${dm.email}`} className="text-[10px] text-blue-600 hover:underline flex items-center gap-0.5">
                          <Mail className="w-3 h-3" />{dm.email.length > 24 ? dm.email.slice(0, 22) + "…" : dm.email}
                        </a>
                      )}
                      {dm.mobile && (
                        <a href={`tel:${dm.mobile}`} className="text-[10px] text-green-700 hover:underline flex items-center gap-0.5">
                          <Phone className="w-3 h-3" />{dm.mobile}
                        </a>
                      )}
                      {dm.linkedin && (
                        <a href={dm.linkedin} target="_blank" rel="noopener noreferrer" className="hover:bg-blue-100 rounded p-0.5">
                          <Linkedin className="w-3 h-3 text-blue-600" />
                        </a>
                      )}
                    </div>
                    {dm.why_relevant && (
                      <p className="text-[11px] text-gray-600 italic mt-1.5 border-t pt-1">{dm.why_relevant}</p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Pristrend */}
          {brief.market_trend && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <TrendingUp className="w-4 h-4 text-purple-600" />
                  📈 Pristrend / marknadssignaler
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-gray-700">{brief.market_trend}</p>
              </CardContent>
            </Card>
          )}

          {/* Konkurrenter */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Swords className="w-4 h-4 text-orange-700" />
                🎁 Konkurrenter ({brief.competitors.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {brief.competitors.map((c, i) => (
                  <div key={i} className="border-l-2 border-orange-200 pl-2 text-xs">
                    <p className="font-medium text-gray-900">{c.name}</p>
                    {c.incumbent_machines && <p className="text-gray-500 italic">{c.incumbent_machines}</p>}
                    {c.displacement_angle && <p className="text-gray-700 mt-0.5">→ {c.displacement_angle}</p>}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Prospekteringsplan */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <ClipboardList className="w-4 h-4 text-emerald-700" />
                🛍 Prospekteringsplan ({brief.prospecting_plan.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-1.5">
                {brief.prospecting_plan.map((step, i) => (
                  <li key={i} className="text-xs text-gray-800 flex items-start gap-2">
                    <span className="flex-shrink-0 w-4 h-4 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>

          {/* Kvalificeringsfrågor */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <HelpCircle className="w-4 h-4 text-blue-600" />
                🔍 Kvalificeringsfrågor ({brief.qualifying_questions.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1.5">
                {brief.qualifying_questions.map((q, i) => (
                  <li key={i} className="text-xs text-gray-800 flex items-start gap-2">
                    <span className="text-blue-600 font-mono text-[10px] mt-0.5">{i + 1}.</span>
                    <span>{q}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

        </div>

        {/* Footer meta */}
        <div className="text-[11px] text-gray-400 pt-2 border-t flex items-center justify-between flex-wrap gap-2">
          <span>
            {brief.generated_at && `Genererad ${new Date(brief.generated_at).toLocaleString("sv-SE")} · `}
            {brief.cost_credits !== undefined && `${brief.cost_credits} credits`}
          </span>
          {brief.urgency === "monitor" && (
            <span className="flex items-center gap-1 text-orange-700">
              <AlertTriangle className="w-3 h-3" />
              Detta konto är anti-fit — skip för aktiv pipeline
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function formatBriefAsText(b: IntelligencePackData): string {
  const lines: string[] = [];
  lines.push(`Intelligence Pack — ${b.account_name}`);
  lines.push(b.headline_hypothesis);
  if (b.subtitle) lines.push(b.subtitle);
  lines.push("");
  lines.push(`URGENCY: ${b.urgency.toUpperCase()} — ${b.urgency_reason}`);
  lines.push("");
  lines.push("HYPOTES:");
  lines.push(b.hypothesis);
  lines.push("");
  lines.push("KÄLLOR:");
  b.sources.forEach(s => lines.push(`  • ${s.label}${s.detail ? " — " + s.detail : ""}`));
  lines.push("");
  lines.push("BESLUTSFATTARE:");
  b.decision_makers.forEach(dm => {
    lines.push(`  [${dm.role_label}] ${dm.name || "—"}`);
    if (dm.title) lines.push(`    ${dm.title}`);
    if (dm.email) lines.push(`    email: ${dm.email}`);
    if (dm.mobile) lines.push(`    mobil: ${dm.mobile}`);
    if (dm.why_relevant) lines.push(`    → ${dm.why_relevant}`);
  });
  lines.push("");
  lines.push("KÖPSIGNALER:");
  b.buying_signals.forEach(s => lines.push(`  [${s.impact}] ${s.headline} (${s.date || "—"})`));
  lines.push("");
  lines.push("PROSPEKTERINGSPLAN:");
  b.prospecting_plan.forEach((s, i) => lines.push(`  ${i + 1}. ${s}`));
  lines.push("");
  lines.push("KVALIFICERINGSFRÅGOR:");
  b.qualifying_questions.forEach((q, i) => lines.push(`  ${i + 1}. ${q}`));
  lines.push("");
  lines.push("KONKURRENTER:");
  b.competitors.forEach(c => {
    lines.push(`  ${c.name}${c.incumbent_machines ? " — " + c.incumbent_machines : ""}`);
    if (c.displacement_angle) lines.push(`    → ${c.displacement_angle}`);
  });
  return lines.join("\n");
}
