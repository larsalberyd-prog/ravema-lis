import { Link, useLocation } from "wouter";
import { useRole } from "@/contexts/RoleContext";
import { Target, Settings, Building2, LayoutGrid, Activity, Zap } from "lucide-react";

type RoleKey = "fc" | "sdr" | "salesperson";

const ITEMS: Array<{ icon: any; label: string; path: string; roles: RoleKey[] }> = [
  { icon: Building2, label: "Bolag", path: "/dashboard", roles: ["fc", "sdr"] },
  { icon: Target, label: "Mina prospekt", path: "/my-sales", roles: ["fc", "sdr", "salesperson"] },
  { icon: LayoutGrid, label: "Growth Grid", path: "/growth-grid", roles: ["fc"] },
  { icon: Activity, label: "Aktivitet", path: "/activity", roles: ["fc", "sdr", "salesperson"] },
  { icon: Settings, label: "Admin", path: "/admin", roles: ["fc"] },
];

const ROLE_LABELS: Array<[RoleKey, string]> = [["fc", "FC"], ["sdr", "SDR"], ["salesperson", "Säljare"]];

export default function TopNav() {
  const [location] = useLocation();
  const { role, setRole } = useRole();
  const items = ITEMS.filter((i) => i.roles.includes(role));

  return (
    <div className="bg-[#0f172a] text-white sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
        <div className="flex items-center gap-6 min-w-0">
          <Link href="/dashboard" className="flex items-center gap-2 flex-shrink-0">
            <div className="w-7 h-7 bg-red-600 rounded-lg flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold tracking-tight hidden sm:inline">Ravema LIS</span>
          </Link>
          <nav className="flex items-center gap-1 overflow-x-auto">
            {items.map((i) => {
              const active = location === i.path || (i.path !== "/dashboard" && location.startsWith(i.path));
              return (
                <Link
                  key={i.path}
                  href={i.path}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm whitespace-nowrap transition-colors ${
                    active ? "bg-white/15 text-white" : "text-white/70 hover:text-white hover:bg-white/10"
                  }`}
                >
                  <i.icon className="w-4 h-4" />
                  {i.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Roll-växlare + badge (motsvarar FC-badgen i originalet) */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {ROLE_LABELS.map(([r, lbl]) => (
            <button
              key={r}
              onClick={() => setRole(r)}
              title={`Byt till ${lbl}`}
              className={`text-[11px] font-medium rounded px-2 py-1 transition-colors ${
                role === r ? "bg-red-600 text-white" : "bg-white/10 text-white/70 hover:bg-white/20"
              }`}
            >
              {lbl}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
