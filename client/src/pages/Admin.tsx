import { useState, useMemo } from "react";
import { Link } from "wouter";
import { useCompanies, type Company } from "@/hooks/useCompanies";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Users, Zap, Calendar, UserCheck, ArrowLeft, CheckSquare, Square,
  Shield, BarChart3, Sliders,
} from "lucide-react";

const focusBadge: Record<string, string> = {
  AAA: "bg-red-100 text-red-800 border-red-200",
  AA: "bg-orange-100 text-orange-800 border-orange-200",
  A: "bg-yellow-100 text-yellow-800 border-yellow-200",
  B: "bg-blue-100 text-blue-800 border-blue-200",
  C: "bg-gray-100 text-gray-700 border-gray-200",
};

const statusConfig: Record<string, { label: string; color: string }> = {
  new: { label: "Ny", color: "bg-gray-400" },
  contacted: { label: "Kontaktad", color: "bg-blue-500" },
  meeting: { label: "Möte bokat", color: "bg-purple-500" },
  qualified: { label: "Kvalificerad", color: "bg-green-500" },
};

const TIERS = ["AAA", "AA", "A", "B", "C"] as const;

// Hardcoded for demo — i prod hämtas från Dynamics 365 user-list
const DEFAULT_SALESPEOPLE = [
  "Per-Ola Karlsson",
  "Per Gabrielsson",
  "Mattias Banelind",
  "Tomas Wilson",
  "NO-Sales-1",
];

// Scoring-vikter — speglar lis-core/agents/scoring (read-only första iteration)
const SCORING_WEIGHTS = [
  { label: "Firmographic", max: 30, desc: "Storlek, segment, geografi, ICP-match" },
  { label: "Capacity", max: 20, desc: "Maskinpark, antal CNC-celler, OEE-indikatorer" },
  { label: "Signals", max: 30, desc: "Capex, hire, expansion, displacement-fönster" },
  { label: "Engagement", max: 10, desc: "Aktiva dialoger, möten, mejlsvar" },
  { label: "Strategic", max: 10, desc: "Management-priority, cross-sell, koncerntillhörighet" },
];

function getWeekLabel() {
  const now = new Date();
  const year = now.getFullYear();
  const start = new Date(year, 0, 1);
  const week = Math.ceil(((now.getTime() - start.getTime()) / 86400000 + start.getDay() + 1) / 7);
  return `${year}-V${String(week).padStart(2, "0")}`;
}

export default function Admin() {
  const { companies, loading, assignCompany } = useCompanies();
  const [activeTab, setActiveTab] = useState<"assign" | "pipeline" | "weights">("assign");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedSalesperson, setSelectedSalesperson] = useState<string>("");
  const [weekLabel, setWeekLabel] = useState(getWeekLabel());

  const salespeople = useMemo(() => {
    const set = new Set<string>(DEFAULT_SALESPEOPLE);
    companies.forEach(c => { if (c.assignedTo) set.add(c.assignedTo); });
    return Array.from(set).sort();
  }, [companies]);

  const unassignedCount = companies.filter(c => !c.assignedTo).length;
  const sorted = useMemo(() => {
    const order: Record<string, number> = { AAA: 0, AA: 1, A: 2, B: 3, C: 4 };
    return [...companies].sort((a, b) => {
      const pa = order[a.priority] ?? 4;
      const pb = order[b.priority] ?? 4;
      if (pa !== pb) return pa - pb;
      return a.name.localeCompare(b.name, "sv");
    });
  }, [companies]);

  const pipelineMatrix = useMemo(() => {
    const byPerson: Record<string, Record<string, number>> = {};
    companies.forEach(c => {
      const owner = c.assignedTo || "Otilldelad";
      if (!byPerson[owner]) byPerson[owner] = { AAA: 0, AA: 0, A: 0, B: 0, C: 0, total: 0 };
      byPerson[owner][c.priority] = (byPerson[owner][c.priority] || 0) + 1;
      byPerson[owner].total = (byPerson[owner].total || 0) + 1;
    });
    return byPerson;
  }, [companies]);

  const statusBreakdown = useMemo(() => {
    const acc = { new: 0, contacted: 0, meeting: 0, qualified: 0 };
    companies.forEach(c => { acc[c.status] = (acc[c.status] || 0) + 1; });
    return acc;
  }, [companies]);

  const toggle = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedIds(new Set(companies.map(c => c.id)));
  const clearSelection = () => setSelectedIds(new Set());

  const handleAssign = () => {
    if (!selectedSalesperson || selectedIds.size === 0) return;
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + 7);
    selectedIds.forEach(id => {
      assignCompany(id, selectedSalesperson, deadline.toISOString());
    });
    toast.success(`Tilldelade ${selectedIds.size} konton till ${selectedSalesperson} (${weekLabel})`);
    setAssignDialogOpen(false);
    setSelectedIds(new Set());
    setSelectedSalesperson("");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard">
              <Button variant="ghost" size="sm" className="gap-1">
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Pilot Board</span>
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900">Klas — Commercial Leadership</h1>
                <p className="text-xs text-gray-500">Ravema LIS</p>
              </div>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-sm text-gray-500">
            <Zap className="w-4 h-4 text-red-500" />
            <span className="font-medium text-gray-900">{companies.length}</span>
            <span>pilot-konton ·</span>
            <span className="font-medium text-orange-600">{unassignedCount}</span>
            <span>otilldelade</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto flex gap-1">
          {[
            { key: "assign", label: "Tilldela veckolista", icon: Calendar },
            { key: "pipeline", label: "Pipeline-överblick", icon: BarChart3 },
            { key: "weights", label: "Scoring-vikter", icon: Sliders },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as typeof activeTab)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? "border-red-600 text-red-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* ── Tab: Assign ── */}
        {activeTab === "assign" && (
          <div>
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Tilldela veckolista</h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  Välj konton (AAA först), tilldela till säljare och sätt vecka. Tilldelade konton
                  syns i säljarens "Mina prospekt"-vy och pushas till Dynamics 365.
                </p>
              </div>
              <div className="flex items-center gap-2">
                {selectedIds.size > 0 && (
                  <Button
                    onClick={() => setAssignDialogOpen(true)}
                    className="bg-red-600 hover:bg-red-700 gap-1"
                    size="sm"
                  >
                    <UserCheck className="w-4 h-4" />
                    Tilldela {selectedIds.size} st
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={selectAll}>Välj alla</Button>
                {selectedIds.size > 0 && (
                  <Button variant="ghost" size="sm" onClick={clearSelection}>Rensa</Button>
                )}
              </div>
            </div>

            {loading ? (
              <p className="text-gray-400 text-sm">Laddar...</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {sorted.map(company => {
                  const selected = selectedIds.has(company.id);
                  return (
                    <Card
                      key={company.id}
                      onClick={() => toggle(company.id)}
                      className={`cursor-pointer transition-all border-2 ${
                        selected
                          ? "border-red-500 bg-red-50"
                          : "border-transparent hover:border-gray-200"
                      }`}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-start gap-2">
                          <div className="mt-0.5 flex-shrink-0">
                            {selected
                              ? <CheckSquare className="w-4 h-4 text-red-600" />
                              : <Square className="w-4 h-4 text-gray-300" />
                            }
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                              <p className="font-medium text-sm truncate">{company.name}</p>
                              {company.priority && (
                                <Badge className={`text-xs border flex-shrink-0 ${focusBadge[company.priority] || focusBadge.C}`}>
                                  {company.priority}
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 truncate">{company.segment || "—"}</p>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <span className={`w-1.5 h-1.5 rounded-full ${statusConfig[company.status]?.color || "bg-gray-400"}`} />
                              <span className="text-xs text-gray-500">{statusConfig[company.status]?.label || company.status}</span>
                              {company.assignedTo && (
                                <span className="text-xs text-blue-600 ml-auto truncate">→ {company.assignedTo}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Tab: Pipeline ── */}
        {activeTab === "pipeline" && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-1">Pipeline-överblick</h2>
            <p className="text-sm text-gray-500 mb-6">
              Tier-fördelning per säljare + status-aggregering. Snabb syn på var pipen är tunn
              och var Nejra behöver fylla på från LIS-kön.
            </p>

            {/* Status breakdown */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              {(["new", "contacted", "meeting", "qualified"] as const).map(s => (
                <Card key={s}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-1">
                      <span className={`w-2 h-2 rounded-full ${statusConfig[s].color}`} />
                      <span className="text-2xl font-bold text-gray-900">{statusBreakdown[s]}</span>
                    </div>
                    <p className="text-xs text-gray-500">{statusConfig[s].label}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Tier matrix */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Konton per säljare × tier</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-2 pr-4 font-medium text-gray-500">Säljare</th>
                        {TIERS.map(t => (
                          <th key={t} className="text-center py-2 px-2 font-medium text-gray-500">
                            <Badge className={`border ${focusBadge[t]}`}>{t}</Badge>
                          </th>
                        ))}
                        <th className="text-center py-2 pl-4 font-medium text-gray-500">Totalt</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(pipelineMatrix).map(([person, counts]) => (
                        <tr key={person} className="border-b border-gray-100 last:border-0">
                          <td className="py-3 pr-4 font-medium text-gray-900">{person}</td>
                          {TIERS.map(t => (
                            <td key={t} className="text-center py-3 px-2">
                              {counts[t] ? (
                                <span className="text-gray-900 font-medium">{counts[t]}</span>
                              ) : (
                                <span className="text-gray-300">—</span>
                              )}
                            </td>
                          ))}
                          <td className="text-center py-3 pl-4 font-semibold text-red-700">{counts.total}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── Tab: Scoring-vikter ── */}
        {activeTab === "weights" && (
          <div className="max-w-3xl">
            <h2 className="text-xl font-bold text-gray-900 mb-1">Scoring-vikter</h2>
            <p className="text-sm text-gray-500 mb-6">
              Modellens dimensioner och deras max-bidrag till totalpoängen (0-100). Justering
              kräver att Klas och Nejra granskar fixture-utfallet — eval-suiten har en CI-gate
              på ≥85 % korrekta tier-träffar mot golden-set.
            </p>

            <Card>
              <CardContent className="p-6 space-y-5">
                {SCORING_WEIGHTS.map(w => (
                  <div key={w.label}>
                    <div className="flex items-baseline justify-between mb-1">
                      <span className="font-medium text-gray-900">{w.label}</span>
                      <span className="text-sm font-mono text-gray-500">max {w.max} p</span>
                    </div>
                    <div className="bg-gray-100 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-red-500 h-full rounded-full"
                        style={{ width: `${w.max}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{w.desc}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="mt-4 border-orange-200 bg-orange-50/40">
              <CardContent className="p-4">
                <p className="text-sm font-medium text-orange-900 mb-1">Floor- och ceiling-overrides</p>
                <ul className="text-xs text-orange-800 space-y-1 list-disc list-inside">
                  <li>ACTIVE_SALES_DIALOGUE-signal → tier-floor = AAA (oavsett poäng)</li>
                  <li>CEO/management-priority-flagga → tier-floor = AAA</li>
                  <li>Klas + Nejra dual-validering + displacement-fönster → tier-floor = AAA</li>
                  <li>Disqualification eller anti-Mazak-relation → tier-ceiling = B (oavsett poäng)</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Assign Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tilldela {selectedIds.size} konton</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Säljare</label>
              <Select value={selectedSalesperson} onValueChange={setSelectedSalesperson}>
                <SelectTrigger>
                  <SelectValue placeholder="Välj säljare..." />
                </SelectTrigger>
                <SelectContent>
                  {salespeople.map(p => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Vecka</label>
              <Input
                value={weekLabel}
                onChange={e => setWeekLabel(e.target.value)}
                placeholder="t.ex. 2026-V21"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>Avbryt</Button>
            <Button
              onClick={handleAssign}
              disabled={!selectedSalesperson}
              className="bg-red-600 hover:bg-red-700"
            >
              Tilldela
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
