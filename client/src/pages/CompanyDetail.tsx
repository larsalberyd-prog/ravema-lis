import { useState, useMemo } from "react";
import { useParams, Link } from "wouter";
import { useCompanies, type Company, type DecisionMaker } from "@/hooks/useCompanies";
import IntelligencePack, { getBrief, type IntelligencePackData } from "@/components/IntelligencePack";
import EmailModal from "@/components/EmailModal";
import ContactEditModal from "@/components/ContactEditModal";
import { trpc } from "@/lib/trpc";
import { useRole } from "@/contexts/RoleContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  ArrowLeft, MapPin, Users, Mail, Linkedin,
  Building2, Copy, Send, ExternalLink,
  Calendar, MessageSquare, FileText, Clock, Plus, Activity, Phone,
  TrendingUp, Crown, Lightbulb, HelpCircle, AlertTriangle, Target, Brain, RefreshCw,
} from "lucide-react";

const focusBadge: Record<string, string> = {
  AAA: "bg-red-100 text-red-800 border-red-200",
  AA: "bg-orange-100 text-orange-800 border-orange-200",
  A: "bg-yellow-100 text-yellow-800 border-yellow-200",
  B: "bg-blue-100 text-blue-800 border-blue-200",
  C: "bg-gray-100 text-gray-700 border-gray-200",
};

const statusOptions: Array<{ value: Company["status"]; label: string }> = [
  { value: "new", label: "Ny" },
  { value: "contacted", label: "Kontaktad" },
  { value: "meeting", label: "Möte bokat" },
  { value: "qualified", label: "Kvalificerad" },
];

type ActivityType = "call" | "email_sent" | "email_replied" | "meeting_booked" | "note";

interface LoggedActivity {
  id: string;
  type: ActivityType;
  description: string;
  performedBy: string;
  createdAt: string;
}

const activityTypeConfig: Record<ActivityType, { label: string; icon: React.ReactNode; color: string }> = {
  call: { label: "Samtal", icon: <Phone className="w-3.5 h-3.5" />, color: "bg-blue-100 text-blue-700 border-blue-200" },
  email_sent: { label: "Mejl skickat", icon: <Mail className="w-3.5 h-3.5" />, color: "bg-purple-100 text-purple-700 border-purple-200" },
  email_replied: { label: "Svar mottaget", icon: <MessageSquare className="w-3.5 h-3.5" />, color: "bg-green-100 text-green-700 border-green-200" },
  meeting_booked: { label: "Möte bokat", icon: <Calendar className="w-3.5 h-3.5" />, color: "bg-red-100 text-red-700 border-red-200" },
  note: { label: "Anteckning", icon: <FileText className="w-3.5 h-3.5" />, color: "bg-gray-100 text-gray-700 border-gray-200" },
};

const ACTIVITY_STORAGE_PREFIX = "ravema-lis-activities-v2-";

function loadActivities(companyId: string): LoggedActivity[] {
  try {
    const raw = localStorage.getItem(ACTIVITY_STORAGE_PREFIX + companyId);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveActivities(companyId: string, activities: LoggedActivity[]) {
  localStorage.setItem(ACTIVITY_STORAGE_PREFIX + companyId, JSON.stringify(activities));
}

function formatActivityDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  const time = d.toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" });
  if (diffDays === 0) return `Idag ${time}`;
  if (diffDays === 1) return `Igår ${time}`;
  return `${d.toLocaleDateString("sv-SE", { day: "numeric", month: "short" })} ${time}`;
}

export default function CompanyDetail() {
  const { id = "" } = useParams<{ id: string }>();
  const { companies, loading, updateStatus } = useCompanies();
  const company = companies.find(c => c.id === id);

  // ── Live Intelligence Pack (Claude, roll-styrt) ──
  const { role } = useRole();
  const [genPack, setGenPack] = useState<IntelligencePackData | null>(null);
  const latestPackQuery = trpc.intelligence.latest.useQuery(
    { companyId: company?.dbId ?? 0 },
    { enabled: !!company?.dbId },
  );
  const genMutation = trpc.intelligence.generate.useMutation();
  const handleGeneratePack = async () => {
    if (!company?.dbId) { toast.error("Bolaget saknar DB-id"); return; }
    try {
      const res = await genMutation.mutateAsync({ companyId: company.dbId, role, language: "sv" });
      setGenPack(res as IntelligencePackData);
      toast.success("Nytt info-pack genererat");
    } catch (e: any) {
      toast.error("Kunde inte generera info-pack", { description: e?.message });
    }
  };

  // Info-pack är STÄNGT tills man genererar/öppnar
  const [packOpen, setPackOpen] = useState(false);
  const [showAiEmail, setShowAiEmail] = useState(false);

  // Manuell kontakt-inmatning (skapa ny / komplettera befintlig)
  const [contactModal, setContactModal] = useState<{ open: boolean; dm: DecisionMaker | null }>({ open: false, dm: null });

  // Discovery (SPAR) — frågor ur pack + Ravema-data, svar återförs till LIS
  type DiscoQ = { question: string; why: string; answer: string };
  const [discovery, setDiscovery] = useState<Record<string, DiscoQ[]> | null>(null);
  const discoveryGen = trpc.discovery.generate.useMutation();
  const discoverySubmit = trpc.discovery.submit.useMutation();

  const handleGenerateDiscovery = async () => {
    if (!company?.dbId) { toast.error("Bolaget saknar DB-id"); return; }
    try {
      const res: any = await discoveryGen.mutateAsync({ companyId: company.dbId, role, language: "sv" });
      const shaped: Record<string, DiscoQ[]> = {};
      for (const phase of ["situation", "pain", "affect", "resolve"]) {
        shaped[phase] = (res[phase] || []).map((q: any) => ({ question: q.question, why: q.why, answer: "" }));
      }
      setDiscovery(shaped);
      toast.success("Discovery-frågor genererade");
    } catch (e: any) {
      toast.error("Kunde inte generera Discovery", { description: e?.message });
    }
  };

  const setAnswer = (phase: string, idx: number, val: string) => {
    setDiscovery((prev) => {
      if (!prev) return prev;
      return { ...prev, [phase]: prev[phase].map((q, i) => (i === idx ? { ...q, answer: val } : q)) };
    });
  };

  const handleSubmitDiscovery = async () => {
    if (!company?.dbId || !discovery) return;
    const answers: Array<{ phase: string; question: string; answer: string }> = [];
    for (const phase of Object.keys(discovery)) {
      for (const q of discovery[phase]) if (q.answer.trim()) answers.push({ phase, question: q.question, answer: q.answer });
    }
    if (!answers.length) { toast.error("Inga svar att spara ännu"); return; }
    try {
      const res: any = await discoverySubmit.mutateAsync({ companyId: company.dbId, role, answers });
      toast.success(`Discovery sparad — ${res.signalsCreated} signal(er) återförda till LIS`);
    } catch (e: any) {
      toast.error("Kunde inte spara Discovery", { description: e?.message });
    }
  };

  // Activity log — local state, persisted to localStorage per company
  const [activities, setActivities] = useState<LoggedActivity[]>(() => loadActivities(id));
  const [addingActivity, setAddingActivity] = useState(false);
  const [newActivityType, setNewActivityType] = useState<ActivityType>("call");
  const [newActivityNote, setNewActivityNote] = useState("");

  // AI email draft (static template — same shape as EmailModal)
  const [selectedContactIdx, setSelectedContactIdx] = useState(0);
  const [showEmail, setShowEmail] = useState(false);
  const selectedContact = company?.decisionMakers?.[selectedContactIdx];

  const emailDraft = useMemo(() => {
    if (!company || !selectedContact) return null;
    const subject = `Möjlighet för samarbete — ${company.name}`;
    const triggerLines = company.triggers.slice(0, 2).map(t => `• ${t}`).join("\n");
    const angle = company.entryAngles[0] || "";
    const greeting = selectedContact.name.startsWith("Sök:")
      ? "Hej,"
      : `Hej ${selectedContact.name.split(" ")[0]},`;
    const body =
`${greeting}

Jag hoppas att detta mejl finner dig väl. Jag kontaktar dig från Ravema AB angående en konkret möjlighet för ${company.name}.

Vi har identifierat flera områden där Ravemas portfölj — Mazak CNC, PAMA boring mills, automation (Fastems/Erowa) och Wenzel metrology — kan stötta er produktion:

${triggerLines}

${angle}

Jag skulle gärna boka ett kort möte för att diskutera hur vi kan stödja er produktionsutveckling. Passar det att prata inom de närmaste veckorna?

Med vänliga hälsningar,
[Ditt namn]
Ravema AB`;
    return { subject, body };
  }, [company, selectedContact]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto">
          <Skeleton className="h-8 w-48 mb-6" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
        <div className="text-center">
          <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Kontot hittades inte</p>
          <Link href="/dashboard">
            <Button variant="outline" className="mt-4">Tillbaka till pilot board</Button>
          </Link>
        </div>
      </div>
    );
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Kopierat till urklipp!");
  };

  const handleAddActivity = () => {
    const activity: LoggedActivity = {
      id: `act-${Date.now()}`,
      type: newActivityType,
      description: newActivityNote.trim() || activityTypeConfig[newActivityType].label,
      performedBy: "Nejra",
      createdAt: new Date().toISOString(),
    };
    const next = [activity, ...activities];
    setActivities(next);
    saveActivities(id, next);
    setNewActivityNote("");
    setAddingActivity(false);
    toast.success("Aktivitet loggad!");
  };

  const lis = company.lis;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <Link href="/dashboard">
            <Button variant="ghost" size="sm" className="gap-1">
              <ArrowLeft className="w-4 h-4" />
              Tillbaka
            </Button>
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg sm:text-xl font-bold text-gray-900 truncate">{company.name}</h1>
              {company.priority && (
                <Badge className={`border ${focusBadge[company.priority] || focusBadge.C}`}>
                  {company.priority}
                </Badge>
              )}
              {lis?.managementPriority && (
                <Badge variant="outline" className="border-red-200 text-red-700">
                  <Crown className="w-3 h-3 mr-1" />CEO-flaggad
                </Badge>
              )}
            </div>
            <p className="text-sm text-gray-500 flex items-center gap-2 flex-wrap">
              <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />
                {[company.city, company.country].filter(Boolean).join(", ") || "—"}
              </span>
              {company.segment && <span>· {company.segment}</span>}
              {company.assignedTo && <span>· Tilldelad: {company.assignedTo}</span>}
            </p>
          </div>
          <Select
            value={company.status}
            onValueChange={(val) => updateStatus(company.id, val as Company["status"])}
          >
            <SelectTrigger className="w-40 sm:w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              {statusOptions.map(o => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* 1) Generell företagsbeskrivning — alltid synlig baslinje (topp) */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Beskrivning</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
              {company.description || "Ingen beskrivning."}
            </p>
            {lis?.rationaleKlas && lis.rationaleKlas !== (company.description || "").trim() && (
              <div className="pt-3 border-t">
                <p className="text-xs text-gray-400 mb-1">Klas rationale</p>
                <p className="text-sm text-gray-700 leading-relaxed italic whitespace-pre-wrap">{lis.rationaleKlas}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 2) Info-pack — STÄNGT tills man genererar / öppnar */}
        {(() => {
          const activePack =
            genPack ?? (latestPackQuery.data as IntelligencePackData | null) ?? getBrief(company.id);
          if (packOpen && activePack) {
            return (
              <IntelligencePack
                brief={activePack}
                onRegenerate={async () => { await handleGeneratePack(); setPackOpen(true); }}
                generating={genMutation.isPending}
              />
            );
          }
          return (
            <Card className="border-2 border-dashed border-red-200 bg-red-50/20">
              <CardContent className="py-6 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Brain className="w-7 h-7 text-red-500 flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-gray-900">Intelligence Pack</p>
                    <p className="text-sm text-gray-500">
                      {activePack ? "Färdigt att visa — eller generera ett färskt." : "Inget pack än — generera ett färskt."}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {activePack && (
                    <Button variant="outline" onClick={() => setPackOpen(true)}>Visa senaste</Button>
                  )}
                  <Button
                    onClick={async () => { await handleGeneratePack(); setPackOpen(true); }}
                    disabled={genMutation.isPending}
                    className="bg-red-600 hover:bg-red-700 gap-2"
                  >
                    <RefreshCw className={`w-4 h-4 ${genMutation.isPending ? "animate-spin" : ""}`} />
                    {genMutation.isPending ? "Genererar…" : "Generera info-pack"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })()}

        <EmailModal open={showAiEmail} onOpenChange={setShowAiEmail} company={company} />

        {/* LIS Score panel */}
        {lis && (
          <Card className="border-red-100 bg-gradient-to-br from-red-50/40 to-white">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="w-5 h-5 text-red-600" />
                LIS Score · Klas-vy
                <Badge variant="outline" className="ml-auto text-xs">
                  Säkerhet: {({ high: "hög", medium: "medel", low: "låg" } as Record<string, string>)[lis.confidence] ?? lis.confidence}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-baseline gap-3">
                <span className="text-4xl font-bold text-gray-900">{lis.scoreTotal}</span>
                <span className="text-sm text-gray-500">/ 100 poäng</span>
                <Badge className={`ml-auto border ${focusBadge[lis.tier]}`}>{lis.tier}</Badge>
              </div>

              {/* Breakdown bars */}
              <div className="space-y-1.5">
                {[
                  { label: "Företagsdata", value: lis.scoreBreakdown.firmographic, max: 30 },
                  { label: "Köpkapacitet", value: lis.scoreBreakdown.capacity, max: 20 },
                  { label: "Köpsignaler", value: lis.scoreBreakdown.signals, max: 30 },
                  { label: "Engagemang", value: lis.scoreBreakdown.engagement, max: 10 },
                  { label: "Strategisk fit", value: lis.scoreBreakdown.strategic, max: 10 },
                ].map(({ label, value, max }) => (
                  <div key={label} className="flex items-center gap-3 text-xs">
                    <span className="w-24 text-gray-500">{label}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-red-500 h-full rounded-full transition-all"
                        style={{ width: `${(value / max) * 100}%` }}
                      />
                    </div>
                    <span className="w-12 text-right text-gray-700 font-mono">{value}/{max}</span>
                  </div>
                ))}
              </div>

              {/* Reasons + overrides */}
              {(lis.reasons.length > 0 || lis.overrides.length > 0) && (
                <div className="pt-2 border-t space-y-2">
                  {lis.reasons.map((r, i) => (
                    <p key={`r-${i}`} className="text-xs text-gray-700 flex items-start gap-1.5">
                      <span className="text-gray-400 mt-0.5">→</span>{r}
                    </p>
                  ))}
                  {lis.overrides.map((o, i) => (
                    <p key={`o-${i}`} className="text-xs text-orange-700 flex items-start gap-1.5 font-medium">
                      <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />{o}
                    </p>
                  ))}
                </div>
              )}

              {/* Sales-team metadata */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t text-xs">
                {lis.district && <div><p className="text-gray-400">Distrikt</p><p className="font-medium">{lis.district}</p></div>}
                {company.assignedTo && <div><p className="text-gray-400">Säljare</p><p className="font-medium">{company.assignedTo}</p></div>}
                {company.sowPotential && <div><p className="text-gray-400">SOW potential</p><p className="font-medium">{company.sowPotential}</p></div>}
                {lis.competitorIncumbent && (
                  <div><p className="text-gray-400">Konkurrent (incumbent)</p><p className="font-medium text-purple-700">{lis.competitorIncumbent}</p></div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Signals & Evidence */}
        {lis && lis.signals.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Activity className="w-5 h-5 text-blue-600" />
                Signaler & Evidence ({lis.signals.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {lis.signals.map((s, i) => (
                  <div key={i} className="border-l-2 border-blue-300 pl-3 py-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-[10px] border-blue-200 text-blue-700 font-mono">
                        {s.type}
                      </Badge>
                      {s.date && <span className="text-xs text-gray-400">{s.date}</span>}
                    </div>
                    <p className="text-sm text-gray-800 mt-1">{s.detail}</p>
                    {s.evidenceSource && (
                      <p className="text-xs text-gray-400 mt-0.5">Källa: {s.evidenceSource}</p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* 4) Discovery · SPAR — frågor ur info-pack + Ravema-data, svar → LIS */}
        <Card className="border-blue-100">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <HelpCircle className="w-5 h-5 text-blue-600" />
              Discovery · SPAR
              <Button
                size="sm"
                onClick={handleGenerateDiscovery}
                disabled={discoveryGen.isPending}
                className="ml-auto bg-blue-600 hover:bg-blue-700 gap-1"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${discoveryGen.isPending ? "animate-spin" : ""}`} />
                {discoveryGen.isPending ? "Genererar…" : discovery ? "Generera om" : "Generera frågor"}
              </Button>
            </CardTitle>
          </CardHeader>
          {!discovery && (
            <CardContent>
              <p className="text-sm text-gray-500">
                SDR <strong>förbereder</strong> Discovery — generera SPAR-frågorna ur info-packet + Ravema-data.
                Säljaren <strong>kör</strong> dialogen i samtalet och fyller i svaren, som återförs till LIS som signaler (reinforcement).
              </p>
            </CardContent>
          )}
          {discovery && (
            <CardContent className="space-y-4">
              {([
                ["situation", "Situation — kartlägg nuläget"],
                ["pain", "Pain — hitta gapet"],
                ["affect", "Affect — kvantifiera kostnaden"],
                ["resolve", "Resolve — låt dem äga visionen"],
              ] as const).map(([phase, label]) => (
                <div key={phase} className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">{label}</p>
                  {(discovery[phase] || []).map((q, i) => (
                    <div key={i} className="space-y-1">
                      <p className="text-sm text-gray-800">{q.question}</p>
                      <p className="text-[11px] text-gray-400 italic">→ {q.why}</p>
                      <Textarea
                        value={q.answer}
                        onChange={(e) => setAnswer(phase, i, e.target.value)}
                        placeholder="Kundens svar…"
                        className="min-h-[56px] text-sm"
                      />
                    </div>
                  ))}
                </div>
              ))}
              <Button
                onClick={handleSubmitDiscovery}
                disabled={discoverySubmit.isPending}
                className="w-full bg-blue-600 hover:bg-blue-700 gap-2"
              >
                {discoverySubmit.isPending && <RefreshCw className="w-4 h-4 animate-spin" />}
                Spara Discovery → återför till LIS
              </Button>
            </CardContent>
          )}
        </Card>

        {/* Triggers */}
        {company.triggers.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Target className="w-4 h-4 text-red-600" />
                Triggers ({company.triggers.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1.5">
                {company.triggers.map((t, i) => (
                  <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                    <span className="text-red-500 mt-0.5">•</span><span>{t}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Entry angles */}
        {company.entryAngles.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Lightbulb className="w-4 h-4 text-yellow-600" />
                Entry Angles ({company.entryAngles.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {company.entryAngles.map((a, i) => (
                  <li key={i} className="text-sm text-gray-700 border-l-2 border-yellow-300 pl-3">
                    {a}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Qualifying questions */}
        {company.qualifyingQuestions.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <HelpCircle className="w-4 h-4 text-blue-600" />
                Kvalificerande frågor
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1.5">
                {company.qualifyingQuestions.map((q, i) => (
                  <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                    <span className="text-blue-500 font-mono text-xs mt-0.5">{i + 1}.</span><span>{q}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Decision makers — alltid synligt så man kan lägga till manuellt */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Users className="w-4 h-4 text-gray-600" />
                Beslutsfattare ({company.decisionMakers.length})
              </CardTitle>
              <Button size="sm" variant="outline" className="h-7 gap-1 text-xs border-red-200 text-red-700 hover:bg-red-50"
                onClick={() => setContactModal({ open: true, dm: null })}>
                <Plus className="w-3.5 h-3.5" />Lägg till kontakt
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {company.decisionMakers.length === 0 ? (
              <div className="text-center py-6">
                <Users className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">Inga kontakter ännu</p>
                <p className="text-xs text-gray-400 mt-0.5">Lägg till en person du hittat manuellt</p>
              </div>
            ) : (
              <div className="space-y-2">
                {company.decisionMakers.map((dm, idx) => {
                  const isPlaceholder = dm.name.startsWith("Sök:");
                  // Direkt personlig profil om känd, annars en förifylld LinkedIn-personsökning
                  const li = dm.linkedin || dm.linkedin_search ||
                    `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(`${dm.name} ${company.name}`)}`;
                  const liDirect = !!(dm.linkedin || dm.linkedin_search);
                  const missing = !dm.email || !dm.phone;
                  return (
                    <div key={dm.id ?? idx} className="p-3 rounded-lg border border-gray-200 bg-white">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className={`font-medium text-sm ${isPlaceholder ? "text-gray-500 italic" : "text-gray-900"}`}>
                            {dm.name}
                          </p>
                          <p className="text-xs text-gray-500">{dm.title || "—"}</p>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <Badge variant="outline" className="text-[10px]">{dm.priority}</Badge>
                          <button onClick={() => setContactModal({ open: true, dm })}
                            title="Komplettera kontaktuppgifter"
                            className="inline-flex items-center gap-1 text-[11px] text-gray-500 hover:text-red-700 hover:bg-red-50 rounded px-1.5 py-1">
                            <RefreshCw className="w-3 h-3" />Komplettera
                          </button>
                        </div>
                      </div>

                      {/* Direktkontakt: mejl · mobil · personlig LinkedIn */}
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        {dm.email ? (
                          <a href={`mailto:${dm.email}`}
                            className="inline-flex items-center gap-1 text-xs text-blue-700 bg-blue-50 hover:bg-blue-100 rounded px-2 py-1">
                            <Mail className="w-3.5 h-3.5" />{dm.email}
                          </a>
                        ) : (
                          <button onClick={() => setContactModal({ open: true, dm })}
                            className="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-50 hover:bg-amber-100 border border-dashed border-amber-300 rounded px-2 py-1">
                            <Mail className="w-3.5 h-3.5" />+ mejl
                          </button>
                        )}
                        {dm.phone ? (
                          <a href={`tel:${dm.phone.replace(/\s+/g, "")}`}
                            className="inline-flex items-center gap-1 text-xs text-gray-700 bg-gray-100 hover:bg-gray-200 rounded px-2 py-1">
                            <Phone className="w-3.5 h-3.5" />{dm.phone}
                          </a>
                        ) : (
                          <button onClick={() => setContactModal({ open: true, dm })}
                            className="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-50 hover:bg-amber-100 border border-dashed border-amber-300 rounded px-2 py-1">
                            <Phone className="w-3.5 h-3.5" />+ mobil
                          </button>
                        )}
                        <a href={li} target="_blank" rel="noopener noreferrer"
                          title={liDirect ? "Öppna personlig LinkedIn-profil" : "Sök personen på LinkedIn"}
                          className="inline-flex items-center gap-1 text-xs text-white bg-[#0A66C2] hover:bg-[#004182] rounded px-2 py-1">
                          <Linkedin className="w-3.5 h-3.5" />{liDirect ? "LinkedIn" : "LinkedIn ⌕"}
                        </a>
                        {dm.email && (
                          <button onClick={() => copyToClipboard(dm.email!)}
                            className="inline-flex items-center gap-1 text-xs text-gray-500 hover:bg-gray-100 rounded px-2 py-1">
                            <Copy className="w-3.5 h-3.5" />Kopiera
                          </button>
                        )}
                      </div>
                      {missing && !isPlaceholder && (
                        <p className="text-[11px] text-amber-600 mt-2">Saknar {[!dm.email && "mejl", !dm.phone && "mobil"].filter(Boolean).join(" & ")} — fyll i manuellt</p>
                      )}
                      {(dm as any).note && <p className="text-xs text-orange-700 mt-2">{(dm as any).note}</p>}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {contactModal.open && (
          <ContactEditModal
            companyDbId={company.dbId!}
            companyName={company.name}
            contact={contactModal.dm}
            onClose={() => setContactModal({ open: false, dm: null })}
          />
        )}

        {/* AI Mejlgenerator — live (Claude): pain-teman + sv/no/en */}
        <Card className="border-red-100">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Mail className="w-4 h-4 text-red-600" />
              AI Mejlgenerator
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-gray-500 leading-relaxed">
              Generera ett pain-first-utkast — välj kontakt, språk (sv/no/en) och pain-tema.
              {" "}<strong className="text-gray-700">Detta är inte massutskick — tvärtom.</strong>{" "}
              Utkastet är en startpunkt: allt innehåll ska personifieras och ägas av dig innan du skickar.
            </p>
            <Button onClick={() => setShowAiEmail(true)} className="bg-red-600 hover:bg-red-700 gap-2">
              <Mail className="w-4 h-4" /> Öppna mejlgenerator
            </Button>
          </CardContent>
        </Card>

        {/* Activity log */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Activity className="w-4 h-4 text-gray-500" />
                Aktivitetslogg
                {activities.length > 0 && (
                  <span className="text-xs font-normal text-gray-400">({activities.length})</span>
                )}
              </CardTitle>
              <Button size="sm" variant="outline" onClick={() => setAddingActivity(!addingActivity)} className="gap-1">
                <Plus className="w-4 h-4" />Logga aktivitet
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {addingActivity && (
              <div className="border border-gray-200 rounded-lg p-4 bg-gray-50 space-y-3">
                <p className="text-sm font-medium text-gray-700">Ny aktivitet</p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Select value={newActivityType} onValueChange={(v) => setNewActivityType(v as ActivityType)}>
                    <SelectTrigger className="w-full sm:w-52"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="call">📞 Samtal</SelectItem>
                      <SelectItem value="email_sent">📧 Mejl skickat</SelectItem>
                      <SelectItem value="email_replied">💬 Svar mottaget</SelectItem>
                      <SelectItem value="meeting_booked">📅 Möte bokat</SelectItem>
                      <SelectItem value="note">📝 Anteckning</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="Anteckning (valfritt)..."
                    value={newActivityNote}
                    onChange={e => setNewActivityNote(e.target.value)}
                    className="flex-1"
                    onKeyDown={e => { if (e.key === "Enter") handleAddActivity(); }}
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" size="sm" onClick={() => setAddingActivity(false)}>Avbryt</Button>
                  <Button size="sm" className="bg-red-600 hover:bg-red-700" onClick={handleAddActivity}>Spara</Button>
                </div>
              </div>
            )}

            {activities.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <Clock className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">Inga aktiviteter loggade ännu</p>
                <p className="text-xs mt-1">Klicka "Logga aktivitet" för att börja</p>
              </div>
            ) : (
              <div className="space-y-2">
                {activities.map((a) => {
                  const config = activityTypeConfig[a.type];
                  return (
                    <div key={a.id} className="flex items-start gap-3 p-3 rounded-lg border border-gray-100 bg-white hover:bg-gray-50 transition-colors">
                      <div className={`flex items-center gap-1 px-2 py-1 rounded-full border text-xs font-medium whitespace-nowrap ${config.color}`}>
                        {config.icon}
                        <span className="ml-1">{config.label}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-800">{a.description}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-gray-400">{formatActivityDate(a.createdAt)}</span>
                          <span className="text-xs text-gray-400">· {a.performedBy}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Notes (from rationale + disqualification) */}
        {company.notes && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-gray-500">Noteringar</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 whitespace-pre-wrap">{company.notes}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
