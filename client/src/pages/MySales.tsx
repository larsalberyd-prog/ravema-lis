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
  Building2, Search, MapPin, ChevronRight, Zap, User, Activity, Crown, Shield,
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

export default function MySales() {
  const { companies, loading } = useCompanies();
  const [search, setSearch] = useState("");
  const [salesperson, setSalesperson] = useState<string>("nejra-queue");

  const salespeople = useMemo(() => {
    const names = new Set<string>();
    companies.forEach(c => {
      if (c.assignedTo) names.add(c.assignedTo);
    });
    return Array.from(names).sort();
  }, [companies]);

  const mine = useMemo(() => {
    if (salesperson === "nejra-queue") {
      return companies.filter(c => c.status === "new" && c.priority !== "C");
    }
    return companies.filter(c => c.assignedTo === salesperson);
  }, [companies, salesperson]);

  const filtered = useMemo(() => {
    const list = !search
      ? mine
      : mine.filter(c => {
          const q = search.toLowerCase();
          return (
            c.name.toLowerCase().includes(q) ||
            (c.city || "").toLowerCase().includes(q) ||
            (c.segment || "").toLowerCase().includes(q)
          );
        });
    return [...list].sort((a, b) => {
      const pa = PRIORITY_ORDER[a.priority || "C"] ?? 4;
      const pb = PRIORITY_ORDER[b.priority || "C"] ?? 4;
      if (pa !== pb) return pa - pb;
      return a.name.localeCompare(b.name, "sv");
    });
  }, [mine, search]);

  const newCount = mine.filter(c => c.status === "new").length;
  const contactedCount = mine.filter(c => c.status === "contacted").length;
  const meetingCount = mine.filter(c => c.status === "meeting").length;

  const heading = salesperson === "nejra-queue" ? "Nejras Research-kö" : `Tilldelade konton — ${salesperson}`;
  const subheading = salesperson === "nejra-queue"
    ? "Nya konton från LIS · Nejra SDR-kvalificerar innan Klas tilldelar"
    : "Tilldelade av Klas · Sorterat AAA → C";

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold text-gray-900">{heading}</h1>
              <p className="text-xs text-gray-500">{subheading}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/dashboard">
              <Button variant="ghost" size="sm" className="hidden sm:flex">Pilot Board</Button>
            </Link>
            <Link href="/admin">
              <Button variant="outline" size="sm" className="hidden sm:flex gap-1 border-red-200 text-red-700 hover:bg-red-50">
                <Shield className="w-4 h-4" />Klas (Leadership)
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-gray-100 rounded-full flex items-center justify-center">
                <User className="w-4 h-4 text-gray-500" />
              </div>
              <div className="hidden sm:flex flex-col">
                <span className="text-sm font-medium text-gray-700 leading-tight">Nejra</span>
                <span className="text-xs text-gray-400">Commercial Intelligence (SDR)</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <Card>
            <CardContent className="p-3 sm:p-4 text-center">
              <p className="text-2xl font-bold text-gray-900">{mine.length}</p>
              <p className="text-xs text-gray-500 mt-0.5">I kö</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 sm:p-4 text-center">
              <p className="text-2xl font-bold text-blue-600">{contactedCount}</p>
              <p className="text-xs text-gray-500 mt-0.5">Kontaktade</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 sm:p-4 text-center">
              <p className="text-2xl font-bold text-purple-600">{meetingCount}</p>
              <p className="text-xs text-gray-500 mt-0.5">Möten</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Sök bland konton..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={salesperson} onValueChange={setSalesperson}>
            <SelectTrigger className="w-full sm:w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="nejra-queue">Nejras research-kö (alla nya)</SelectItem>
              {salespeople.map(p => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="space-y-3">
            {Array(5).fill(0).map((_, i) => (
              <Card key={i}><CardContent className="p-4"><Skeleton className="h-16 w-full" /></CardContent></Card>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">Inga konton i denna vy</p>
              <p className="text-sm text-gray-400 mt-1">
                Prova att byta säljare eller söka på något annat.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filtered.map(company => (
              <Link key={company.id} href={`/company/${company.id}`}>
                <Card className="hover:shadow-md transition-all cursor-pointer border hover:border-red-200 group">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h3 className="font-semibold text-gray-900 truncate group-hover:text-red-700 transition-colors">
                            {company.name}
                          </h3>
                          {company.priority && (
                            <Badge className={`text-xs border flex-shrink-0 ${focusBadge[company.priority] || focusBadge.C}`}>
                              {company.priority}
                            </Badge>
                          )}
                          {company.lis?.managementPriority && (
                            <Badge variant="outline" className="text-[10px] border-red-200 text-red-700">
                              <Crown className="w-2.5 h-2.5 mr-0.5" />CEO
                            </Badge>
                          )}
                          {company.lis && company.lis.signals.length > 0 && (
                            <Badge variant="outline" className="text-[10px] border-blue-200 text-blue-700">
                              <Activity className="w-2.5 h-2.5 mr-0.5" />{company.lis.signals.length} signal{company.lis.signals.length !== 1 ? "er" : ""}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
                          {(company.city || company.country) && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {[company.city, company.country].filter(Boolean).join(", ")}
                            </span>
                          )}
                          {company.segment && <span className="truncate">{company.segment}</span>}
                          {company.lis?.competitorIncumbent && (
                            <span className="text-purple-700">vs {company.lis.competitorIncumbent}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <div className="flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full ${statusConfig[company.status]?.color || "bg-gray-400"}`} />
                          <span className="text-xs text-gray-600 hidden sm:block">{statusConfig[company.status]?.label}</span>
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-red-400 transition-colors" />
                      </div>
                    </div>
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
