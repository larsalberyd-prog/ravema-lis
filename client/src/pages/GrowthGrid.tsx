import { useCompanies } from "@/hooks/useCompanies";
import { Card, CardContent } from "@/components/ui/card";

const TIERS = ["AAA", "AA", "A", "B", "C"] as const;
const STATUSES: Array<[string, string]> = [
  ["new", "Ny"], ["contacted", "Kontaktad"], ["meeting", "Möte"], ["qualified", "Kvalificerad"],
];

export default function GrowthGrid() {
  const { companies } = useCompanies();

  const matrix: Record<string, Record<string, number>> = {};
  for (const t of TIERS) { matrix[t] = {}; for (const [s] of STATUSES) matrix[t][s] = 0; }
  for (const c of companies) {
    const t = c.priority; const s = c.status;
    if (matrix[t] && matrix[t][s] !== undefined) matrix[t][s]++;
  }
  const colTotal = (s: string) => companies.filter((c) => c.status === s).length;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Growth Grid</h1>
          <p className="text-sm text-gray-500">Portföljöversikt — tier × status. FC:s helikoptervy över var konton står och rör sig.</p>
        </div>
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-gray-500">
                  <th className="text-left p-3 font-medium">Tier</th>
                  {STATUSES.map(([s, l]) => <th key={s} className="p-3 text-center font-medium">{l}</th>)}
                  <th className="p-3 text-center font-medium">Totalt</th>
                </tr>
              </thead>
              <tbody>
                {TIERS.map((t) => {
                  const total = STATUSES.reduce((a, [s]) => a + matrix[t][s], 0);
                  if (total === 0) return null;
                  return (
                    <tr key={t} className="border-b hover:bg-gray-50">
                      <td className="p-3 font-semibold text-gray-900">{t}</td>
                      {STATUSES.map(([s]) => (
                        <td key={s} className="p-3 text-center">
                          {matrix[t][s] ? matrix[t][s] : <span className="text-gray-300">·</span>}
                        </td>
                      ))}
                      <td className="p-3 text-center font-semibold">{total}</td>
                    </tr>
                  );
                })}
                <tr className="bg-gray-50 font-semibold text-gray-700">
                  <td className="p-3">Totalt</td>
                  {STATUSES.map(([s]) => <td key={s} className="p-3 text-center">{colTotal(s)}</td>)}
                  <td className="p-3 text-center">{companies.length}</td>
                </tr>
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
