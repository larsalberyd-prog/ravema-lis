import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { type Company } from "@/hooks/useCompanies";
import { Copy, Mail } from "lucide-react";
import { toast } from "sonner";

interface EmailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  company: Company;
}

export default function EmailModal({ open, onOpenChange, company }: EmailModalProps) {
  const subject = `Möjlighet för samarbete - ${company.name}`;
  
  const body = `Hej,

Jag hoppas att detta mejl finner dig väl. Jag kontaktar dig från Ravema AB angående en konkret möjlighet för ${company.name}.

Vi har identifierat flera områden där Ravemas portfölj — Mazak CNC, PAMA boring mills, automation (Fastems/Erowa) och Wenzel metrology — kan stötta er produktion:

${company.triggers.slice(0, 2).map(t => `• ${t}`).join('\n')}

${company.entryAngles[0]}

Jag skulle gärna boka ett kort möte för att diskutera hur vi kan stödja er produktionsutveckling. Passar det att prata inom de närmaste veckorna?

Med vänliga hälsningar,
[Ditt namn]
Ravema AB`;

  const handleCopy = () => {
    navigator.clipboard.writeText(body);
    toast.success("Mejltext kopierad!");
  };

  const handleOpenEmail = () => {
    const mailto = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailto;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Genererat Mejl - {company.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Ämne</label>
            <div className="p-3 bg-muted rounded-md text-sm">{subject}</div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Mejltext</label>
            <Textarea
              value={body}
              readOnly
              className="min-h-[300px] font-mono text-sm"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleCopy}>
            <Copy className="w-4 h-4 mr-2" />
            Kopiera
          </Button>
          <Button onClick={handleOpenEmail}>
            <Mail className="w-4 h-4 mr-2" />
            Öppna i Mejl
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
