import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { type Company } from "@/hooks/useCompanies";
import { trpc } from "@/lib/trpc";
import { Copy, Mail, Sparkles, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface EmailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  company: Company;
}

type Lang = "sv" | "no" | "en";
type PainTheme = "auto" | "stillestand" | "omstallning" | "volym";

const PAIN_TABS: Array<{ key: PainTheme; label: string }> = [
  { key: "auto", label: "Auto" },
  { key: "stillestand", label: "Stillestånd" },
  { key: "omstallning", label: "Omställningstid" },
  { key: "volym", label: "Volym" },
];

function defaultLang(country?: string): Lang {
  const c = (country || "").toLowerCase();
  if (c.includes("norge") || c.includes("norway")) return "no";
  return "sv";
}

export default function EmailModal({ open, onOpenChange, company }: EmailModalProps) {
  const dms = (company.decisionMakers || []).filter((d) => d.name && !d.name.startsWith("Sök:"));
  const [contactIdx, setContactIdx] = useState(0);
  const [language, setLanguage] = useState<Lang>(defaultLang(company.country));
  const [painTheme, setPainTheme] = useState<PainTheme>("auto");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const gen = trpc.emails.generate.useMutation();
  const contact = dms[contactIdx];

  const handleGenerate = async () => {
    if (!company.dbId) {
      toast.error("Bolaget saknar DB-id");
      return;
    }
    try {
      const res = await gen.mutateAsync({
        companyId: company.dbId,
        contactName: contact?.name || "där",
        contactTitle: contact?.title || "Beslutsfattare",
        companyName: company.name,
        companyCategory: company.segment,
        companyFocus: company.priority,
        companyDescription: company.description,
        language,
        painTheme,
        segment: company.segment,
        signals: company.lis?.signals?.slice(0, 5).map((s) => `${s.type}: ${s.detail}`),
        entryAngle: company.entryAngles?.[0],
        competitorIncumbent: company.lis?.competitorIncumbent ?? undefined,
      });
      setSubject(res.subject);
      setBody(res.body);
      toast.success("Mejl genererat");
    } catch (e: any) {
      toast.error("Kunde inte generera mejl", { description: e?.message });
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(body);
    toast.success("Mejltext kopierad!");
  };

  const handleOpenEmail = () => {
    const to = contact?.email || "";
    window.location.href = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-red-600" />
            AI Mejlgenerator — {company.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Kontakt (egen rad, full bredd — undviker överlapp med språk) */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500">Kontakt</label>
            <Select value={String(contactIdx)} onValueChange={(v) => setContactIdx(Number(v))}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Välj kontakt" /></SelectTrigger>
              <SelectContent>
                {dms.length === 0 && <SelectItem value="0">— ingen kontakt —</SelectItem>}
                {dms.map((d, i) => (
                  <SelectItem key={i} value={String(i)}>{d.name} · {d.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Språk (egen rad) */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500">Språk</label>
            <Select value={language} onValueChange={(v) => setLanguage(v as Lang)}>
              <SelectTrigger className="w-full sm:w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="sv">Svenska</SelectItem>
                <SelectItem value="no">Norsk</SelectItem>
                <SelectItem value="en">English</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Pain-tema */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500">Smärt-tema</label>
            <div className="flex flex-wrap gap-2">
              {PAIN_TABS.map((t) => (
                <Button
                  key={t.key}
                  type="button"
                  size="sm"
                  variant={painTheme === t.key ? "default" : "outline"}
                  className={painTheme === t.key ? "bg-red-600 hover:bg-red-700" : ""}
                  onClick={() => setPainTheme(t.key)}
                >
                  {t.label}
                </Button>
              ))}
            </div>
          </div>

          <p className="text-[11px] text-gray-500 leading-relaxed">
            <strong className="text-gray-700">Inte massutskick — tvärtom.</strong> Utkastet är en startpunkt:
            personifiera och äg innehållet innan du skickar. Läs igenom, justera tonen, gör det till ditt.
          </p>

          <Button onClick={handleGenerate} disabled={gen.isPending} className="w-full bg-red-600 hover:bg-red-700 gap-2">
            {gen.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {gen.isPending ? "Genererar…" : "Generera mejl"}
          </Button>

          {(subject || body) && (
            <>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-500">Ämne</label>
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-500">Mejltext</label>
                <Textarea value={body} onChange={(e) => setBody(e.target.value)} className="min-h-[260px] text-sm" />
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCopy} disabled={!body}>
            <Copy className="w-4 h-4 mr-2" />
            Kopiera
          </Button>
          <Button onClick={handleOpenEmail} disabled={!body}>
            <Mail className="w-4 h-4 mr-2" />
            Öppna i Mejl
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
