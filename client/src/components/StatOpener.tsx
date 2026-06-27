import { Card, CardContent } from "@/components/ui/card";
import { Building2, Users, TrendingUp, Mail } from "lucide-react";
import { trpc } from "@/lib/trpc";
import type { Company } from "@/hooks/useCompanies";

/**
 * Fyrkorts-opener: Företag · Kontakter · AAA+AA · Mejl producerade.
 * Roll-scopad genom vilka `companies` som skickas in (FC=portfölj, SDR/Säljare=egna).
 * Sista kortet (mejl producerade) växer när loopen körs.
 */
export default function StatOpener({ companies, scopeLabel }: { companies: Company[]; scopeLabel?: string }) {
  const emailCount = trpc.emails.count.useQuery();
  const bolag = companies.length;
  const kontakter = companies.reduce(
    (a, c) => a + (c.decisionMakers?.filter((d) => !d.name?.startsWith("Sök:")).length || 0), 0);
  const aaaaa = companies.filter((c) => c.priority === "AAA" || c.priority === "AA").length;
  const mejl = emailCount.data?.count ?? 0;

  const cards = [
    { v: bolag, label: scopeLabel ? `Företag · ${scopeLabel}` : "Företag aktiva", Icon: Building2, box: "bg-blue-50", ic: "text-blue-600" },
    { v: kontakter, label: "Kontakter", Icon: Users, box: "bg-green-50", ic: "text-green-600" },
    { v: aaaaa, label: "AAA + AA", Icon: TrendingUp, box: "bg-red-50", ic: "text-red-600" },
    { v: mejl, label: "Mejl producerade", Icon: Mail, box: "bg-purple-50", ic: "text-purple-600" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
      {cards.map(({ v, label, Icon, box, ic }, i) => (
        <Card key={i}>
          <CardContent className="p-3 sm:p-4 flex items-center gap-3">
            <div className={`p-2 rounded-lg ${box}`}><Icon className={`w-5 h-5 ${ic}`} /></div>
            <div>
              <p className="text-xl sm:text-2xl font-bold">{v}</p>
              <p className="text-xs text-gray-500">{label}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
