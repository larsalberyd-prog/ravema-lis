import { Link } from "wouter";
import { useCompanies } from "@/hooks/useCompanies";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity as ActivityIcon } from "lucide-react";

const statusConfig: Record<string, { label: string; color: string }> = {
  contacted: { label: "Kontaktad", color: "bg-blue-500" },
  meeting: { label: "Möte bokat", color: "bg-purple-500" },
  qualified: { label: "Kvalificerad", color: "bg-green-500" },
};

export default function Activity() {
  const { companies } = useCompanies();
  const inMotion = companies.filter((c) => c.status && c.status !== "new");

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <ActivityIcon className="w-5 h-5 text-gray-500" /> Aktivitet
          </h1>
          <p className="text-sm text-gray-500">Lagets aktivitet — konton i rörelse (kontaktade, möten, kvalificerade). Flygledartornet.</p>
        </div>
        {inMotion.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-gray-400">
              Ingen aktivitet ännu — kontakter, möten och kvalificeringar dyker upp här.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {inMotion.map((c) => {
              const cfg = statusConfig[c.status] || { label: c.status, color: "bg-gray-400" };
              return (
                <Link key={c.id} href={`/company/${c.id}`}>
                  <Card className="hover:border-gray-300 transition-colors cursor-pointer">
                    <CardContent className="p-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-sm text-gray-900 truncate">{c.name}</p>
                        <p className="text-xs text-gray-500 truncate">{c.assignedTo || "—"} · {c.segment}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Badge variant="outline" className="text-[10px]">{c.priority}</Badge>
                        <span className="flex items-center gap-1.5 text-xs text-gray-600">
                          <span className={`w-2 h-2 rounded-full ${cfg.color}`} /> {cfg.label}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
