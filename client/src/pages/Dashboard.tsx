import { useState, useMemo } from "react";
import { Link } from "wouter";
import { useCompanies } from "@/hooks/useCompanies";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Building2, TrendingUp, Search, Filter,
  MapPin, ChevronRight, Zap, Shield, Activity, AlertTriangle, Crown,
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

const PRIORITY_ORDER: Record<string, number> = { AAA: 0, AA: 1, A: 2, B: 3, C: 4 };

export default function Dashboard() {
  const [search, setSearch] = useState("");
  const [filterFocus, setFilterFocus] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const { companies, loading: loadingCompanies } = useCompanies();

  const stats = useMemo(() => {
    const totalCompanies = companies.length;
    const aaaCount = companies.filter(c => c.priority === "AAA").length;
    const aaCount = companies.filter(c => c.priority === "AA").length;
    const totalContacts = companies.reduce((sum, c) => sum + (c.decisionMakers?.length || 0), 0);
    const activeSignals = companies.reduce((sum, c) => sum + (c.lis?.signals?.length || 0), 0);
    const blocked = companies.filter(c => c.priority === "B" || c.priority === "C").length;
    return { totalCompanies, aaaCount, aaCount, totalContacts, activeSignals, blocked };
  }, [companies]);

  const filtered = useMemo(() => {
    return companies
      .filter(c => {
        const matchSearch = !search ||
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          (c.city || "").toLowerCase().includes(search.toLowerCase()) ||
          (c.country || "").toLowerCase().includes(search.toLowerCase()) ||
          (c.segment || "").toLowerCase().includes(search.toLowerCase());
        const matchFocus = filterFocus === "all" || c.priority === filterFocus;
        const matchStatus = filterStatus === "all" || c.status === filterStatus;
        return matchSearch && matchFocus && matchStatus;
      })
      .sort((a, b) => {
        const pa = PRIORITY_ORDER[a.priority || "C"] ?? 4;
        const pb = PRIORITY_ORDER[b.priority || "C"] ?? 4;
        if (pa !== pb) return pa - pb;
        return a.name.localeCompare(b.name, "sv");
      });
  }, [companies, search, filterFocus, filterStatus]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold text-gray-900">Ravema LIS</h1>
              <p className="text-xs text-gray-500 hidden sm:block">Pilot Board · Sorterat AAA → C · Ravema AB</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/admin">
              <Button variant="outline" size="sm" className="gap-1 hidden sm:flex border-red-200 text-red-700 hover:bg-red-50">
                <Shield className="w-4 h-4" />
                Klas (Leadership)
              </Button>
            </Link>
            <Link href="/my-sales">
              <Button variant="outline" size="sm" className="hidden sm:flex">
                Nejra (SDR)
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6">
          {loadingCompanies ? (
            Array(4).fill(0).map((_, i) => (
              <Card key={i}><CardContent className="p-4"><Skeleton className="h-12 w-full" /></CardContent></Card>
            ))
          ) : (
            <>
              <Card>
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="p-1.5 sm:p-2 bg-blue-50 rounded-lg"><Building2 className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" /></div>
                    <div>
                      <p className="text-xl sm:text-2xl font-bold">{stats.totalCompanies}</p>
                      <p className="text-xs text-gray-500">Pilot-konton</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="p-1.5 sm:p-2 bg-red-50 rounded-lg"><Crown className="w-4 h-4 sm:w-5 sm:h-5 text-red-600" /></div>
                    <div>
                      <p className="text-xl sm:text-2xl font-bold">{stats.aaaCount + stats.aaCount}</p>
                      <p className="text-xs text-gray-500">AAA + AA</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="p-1.5 sm:p-2 bg-green-50 rounded-lg"><Activity className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" /></div>
                    <div>
                      <p className="text-xl sm:text-2xl font-bold">{stats.activeSignals}</p>
                      <p className="text-xs text-gray-500">Aktiva signaler</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="p-1.5 sm:p-2 bg-gray-100 rounded-lg"><AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600" /></div>
                    <div>
                      <p className="text-xl sm:text-2xl font-bold">{stats.blocked}</p>
                      <p className="text-xs text-gray-500">Anti-fit / B-C</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Sök konto, stad, segment..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filterFocus} onValueChange={setFilterFocus}>
            <SelectTrigger className="w-full sm:w-40">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Prioritet" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alla prioriteter</SelectItem>
              <SelectItem value="AAA">AAA</SelectItem>
              <SelectItem value="AA">AA</SelectItem>
              <SelectItem value="A">A</SelectItem>
              <SelectItem value="B">B</SelectItem>
              <SelectItem value="C">C</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alla statusar</SelectItem>
              <SelectItem value="new">Ny</SelectItem>
              <SelectItem value="contacted">Kontaktad</SelectItem>
              <SelectItem value="meeting">Möte bokat</SelectItem>
              <SelectItem value="qualified">Kvalificerad</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <p className="text-sm text-gray-500 mb-4">
          Visar {filtered.length} av {companies.length} konton
        </p>

        {/* Company Grid */}
        {loadingCompanies ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array(6).fill(0).map((_, i) => (
              <Card key={i}><CardContent className="p-4"><Skeleton className="h-32 w-full" /></CardContent></Card>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">Inga konton hittades</p>
              <p className="text-sm text-gray-400 mt-1">Prova att ändra sökning eller filter</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(company => (
              <Link key={company.id} href={`/company/${company.id}`}>
                <Card className="hover:shadow-md transition-all cursor-pointer border hover:border-red-200 group h-full">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 truncate group-hover:text-red-700 transition-colors">
                          {company.name}
                        </h3>
                        <div className="flex items-center gap-1 mt-0.5 text-xs text-gray-500">
                          <MapPin className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">{[company.city, company.country].filter(Boolean).join(", ") || "—"}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 ml-2">
                        {company.priority && (
                          <Badge className={`text-xs border ${focusBadge[company.priority] || focusBadge.C}`}>
                            {company.priority}
                          </Badge>
                        )}
                        <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-red-400 transition-colors" />
                      </div>
                    </div>

                    {company.segment && (
                      <p className="text-xs text-gray-500 mb-2 truncate">{company.segment}</p>
                    )}

                    {company.lis && (
                      <div className="flex flex-wrap items-center gap-1.5 mb-3">
                        {company.lis.managementPriority && (
                          <Badge variant="outline" className="text-[10px] border-red-200 text-red-700">
                            <Crown className="w-2.5 h-2.5 mr-0.5" />CEO-flaggad
                          </Badge>
                        )}
                        {company.lis.signals.slice(0, 2).map((s, i) => (
                          <Badge key={i} variant="outline" className="text-[10px] border-blue-200 text-blue-700">
                            <Activity className="w-2.5 h-2.5 mr-0.5" />
                            {s.type.replace(/_/g, " ").toLowerCase()}
                          </Badge>
                        ))}
                        {company.lis.competitorIncumbent && (
                          <Badge variant="outline" className="text-[10px] border-purple-200 text-purple-700">
                            vs {company.lis.competitorIncumbent}
                          </Badge>
                        )}
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${statusConfig[company.status]?.color || "bg-gray-400"}`} />
                        <span className="text-xs text-gray-600">{statusConfig[company.status]?.label || company.status}</span>
                      </div>
                      {company.lis && (
                        <div className="flex items-center gap-1 text-xs text-gray-400">
                          <TrendingUp className="w-3 h-3" />
                          <span>{company.lis.scoreTotal}p · {company.lis.confidence}</span>
                        </div>
                      )}
                    </div>

                    {company.assignedTo && (
                      <p className="text-[10px] text-gray-400 mt-2 truncate">Tilldelad: {company.assignedTo}</p>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
