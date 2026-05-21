import { useState, useMemo } from "react";
import { useParams, Link } from "wouter";
import { useCompanies, type Company } from "@/hooks/useCompanies";
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
  TrendingUp, Crown, Lightbulb, HelpCircle, AlertTriangle, Target,
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
        {/* LIS Score panel */}
        {lis && (
          <Card className="border-red-100 bg-gradient-to-br from-red-50/40 to-white">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="w-5 h-5 text-red-600" />
                LIS Score · Klas-vy
                <Badge variant="outline" className="ml-auto text-xs">
                  Confidence: {lis.confidence}
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
                  { label: "Firmographic", value: lis.scoreBreakdown.firmographic, max: 30 },
                  { label: "Capacity", value: lis.scoreBreakdown.capacity, max: 20 },
                  { label: "Signals", value: lis.scoreBreakdown.signals, max: 30 },
                  { label: "Engagement", value: lis.scoreBreakdown.engagement, max: 10 },
                  { label: "Strategic", value: lis.scoreBreakdown.strategic, max: 10 },
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

        {/* Description + Klas rationale */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Beskrivning</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
              {company.description || "Ingen beskrivning."}
            </p>
            {lis?.rationaleKlas && lis.rationaleKlas !== company.description.trim() && (
              <div className="pt-3 border-t">
                <p className="text-xs text-gray-400 mb-1">Klas rationale</p>
                <p className="text-sm text-gray-700 leading-relaxed italic whitespace-pre-wrap">{lis.rationaleKlas}</p>
              </div>
            )}
          </CardContent>
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

        {/* Decision makers */}
        {company.decisionMakers.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Users className="w-4 h-4 text-gray-600" />
                Beslutsfattare ({company.decisionMakers.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {company.decisionMakers.map((dm, idx) => {
                  const isPlaceholder = dm.name.startsWith("Sök:");
                  const isSelected = idx === selectedContactIdx;
                  return (
                    <div
                      key={idx}
                      onClick={() => setSelectedContactIdx(idx)}
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                        isSelected ? "border-red-300 bg-red-50" : "border-gray-200 hover:border-gray-300 bg-white"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className={`font-medium text-sm ${isPlaceholder ? "text-gray-500 italic" : "text-gray-900"}`}>
                            {dm.name}
                          </p>
                          <p className="text-xs text-gray-500 truncate">{dm.title || "—"}</p>
                          {dm.email && <p className="text-xs text-blue-600 truncate mt-0.5">{dm.email}</p>}
                          {(dm as any).note && (
                            <p className="text-xs text-orange-700 mt-1">{(dm as any).note}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <Badge variant="outline" className="text-[10px]">{dm.priority}</Badge>
                          {dm.linkedin_search && (
                            <a href={dm.linkedin_search} target="_blank" rel="noopener noreferrer"
                              onClick={e => e.stopPropagation()}
                              className="p-1 hover:bg-blue-100 rounded">
                              <Linkedin className="w-3.5 h-3.5 text-blue-600" />
                            </a>
                          )}
                          {dm.email && (
                            <button onClick={e => { e.stopPropagation(); copyToClipboard(dm.email!); }}
                              className="p-1 hover:bg-gray-100 rounded">
                              <Copy className="w-3.5 h-3.5 text-gray-400" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* AI Email draft */}
        {emailDraft && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Mail className="w-4 h-4 text-purple-600" />
                AI Mejl-utkast {selectedContact && <span className="text-xs text-gray-400 font-normal">— {selectedContact.name}</span>}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!showEmail ? (
                <Button variant="outline" onClick={() => setShowEmail(true)} className="gap-2">
                  <Mail className="w-4 h-4" />Visa utkast
                </Button>
              ) : (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="bg-gray-50 px-4 py-2 border-b flex items-center justify-between">
                    <div className="flex-1">
                      <p className="text-xs text-gray-400">Ämne</p>
                      <p className="font-medium text-sm">{emailDraft.subject}</p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => copyToClipboard(emailDraft.subject)}>
                      <Copy className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                  <div className="p-4">
                    <Textarea
                      value={emailDraft.body}
                      readOnly
                      className="min-h-[280px] text-sm border-0 p-0 resize-none focus-visible:ring-0 font-mono"
                    />
                  </div>
                  <div className="bg-gray-50 px-4 py-2 border-t flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => copyToClipboard(`Ämne: ${emailDraft.subject}\n\n${emailDraft.body}`)}>
                      <Copy className="w-3.5 h-3.5 mr-1" />Kopiera allt
                    </Button>
                    <Button size="sm" className="bg-green-600 hover:bg-green-700"
                      onClick={() => {
                        window.open(`mailto:?subject=${encodeURIComponent(emailDraft.subject)}&body=${encodeURIComponent(emailDraft.body)}`);
                      }}>
                      <Send className="w-3.5 h-3.5 mr-1" />Öppna i mejlklient
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

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
