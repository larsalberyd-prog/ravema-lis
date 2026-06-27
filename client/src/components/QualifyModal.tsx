import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { X, CheckCircle2, ArrowRight, UserCheck } from "lucide-react";
import type { Company } from "@/hooks/useCompanies";

/**
 * SDR:s LÄTTA kvalificerings-steg — INTE djup SPAR-Discovery (det är säljarens).
 * SDR bekräftar att samtalet är varmt nog (rätt person, intresse, antydd smärta,
 * nästa steg) och överlämnar kontot till en säljare. Sätter status → "qualified"
 * + assignedTo via befintlig updateStatus. Checklistan + noteringen sparas i notes.
 */
const CHECKS = [
  { key: "person", label: "Rätt beslutsfattare nådd" },
  { key: "interest", label: "Uttryckt intresse / rätt timing" },
  { key: "pain", label: "Behov eller smärta antydd" },
  { key: "next", label: "Nästa steg överenskommet (samtal/möte)" },
] as const;

export default function QualifyModal({
  company,
  salespeople,
  onClose,
}: {
  company: Company;
  salespeople: string[];
  onClose: () => void;
}) {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [handover, setHandover] = useState("");
  const [note, setNote] = useState("");

  const utils = trpc.useUtils();
  const mutation = trpc.companies.updateStatus.useMutation({
    onSuccess: () => {
      utils.companies.list.invalidate();
      toast.success(`${company.name} kvalificerad & överlämnad till ${handover.trim()}`);
      onClose();
    },
    onError: (e) => toast.error("Kunde inte spara", { description: e.message }),
  });

  const count = CHECKS.filter((c) => checked[c.key]).length;

  const submit = () => {
    if (count < 3) {
      toast.error("Minst 3 av 4 punkter måste bekräftas innan överlämning");
      return;
    }
    if (!handover.trim()) {
      toast.error("Ange vilken säljare kontot överlämnas till");
      return;
    }
    const today = new Date().toLocaleDateString("sv-SE");
    const summary =
      `— Kvalificering (SDR, ${today}) → ${handover.trim()} —\n` +
      CHECKS.map((c) => `${checked[c.key] ? "✓" : "✗"} ${c.label}`).join("\n") +
      (note.trim() ? `\nNotering: ${note.trim()}` : "");
    const combined = company.notes ? `${company.notes}\n\n${summary}` : summary;

    mutation.mutate({
      id: company.dbId!,
      status: "qualified",
      assignedTo: handover.trim(),
      notes: combined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-red-600" />
              Lätt kvalificering
            </h3>
            <p className="text-xs text-gray-500">{company.name} · SDR öppnar → överlämnar till säljare</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="space-y-1.5">
            {CHECKS.map((c) => (
              <button
                key={c.key}
                onClick={() => setChecked((p) => ({ ...p, [c.key]: !p[c.key] }))}
                className={`w-full flex items-center gap-2.5 rounded-lg border px-3 py-2 text-sm text-left transition ${
                  checked[c.key]
                    ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                    : "border-gray-200 hover:bg-gray-50 text-gray-600"
                }`}
              >
                <CheckCircle2 className={`w-4 h-4 flex-shrink-0 ${checked[c.key] ? "text-emerald-600" : "text-gray-300"}`} />
                {c.label}
              </button>
            ))}
            <p className={`text-[11px] pt-1 ${count < 3 ? "text-amber-600" : "text-gray-400"}`}>
              {count}/4 bekräftade — minst 3 krävs för överlämning. Snabbkoll; den djupa SPAR-Discoveryn kör säljaren i samtalet.
            </p>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Överlämna till säljare</label>
            <Input
              value={handover}
              onChange={(e) => setHandover(e.target.value)}
              placeholder="Säljarens namn"
              list="qualify-salespeople"
            />
            <datalist id="qualify-salespeople">
              {salespeople.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Vad säljaren behöver veta</label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Kort överlämningsnotering — kontext, signaler, nästa steg…"
              rows={3}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Avbryt
          </Button>
          <Button
            size="sm"
            onClick={submit}
            disabled={mutation.isPending || count < 3 || !handover.trim()}
            className="bg-red-600 hover:bg-red-700 text-white gap-1 disabled:opacity-50"
          >
            {mutation.isPending ? "Sparar…" : "Kvalificera & överlämna"}
            {!mutation.isPending && <ArrowRight className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
