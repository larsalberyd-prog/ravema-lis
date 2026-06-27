import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { X, User, Mail, Phone, Linkedin, Briefcase } from "lucide-react";
import type { DecisionMaker } from "@/hooks/useCompanies";

/**
 * Manuell inmatning av kontaktuppgifter — för personer där enrichment inte hittat
 * mejl/mobil/LinkedIn. Skapar ny kontakt (contact=null) eller kompletterar befintlig.
 * Sparar till contacts-tabellen via tRPC och invaliderar bolagslistan så vyn uppdateras.
 */
export default function ContactEditModal({
  companyDbId,
  companyName,
  contact,
  onClose,
}: {
  companyDbId: number;
  companyName: string;
  contact?: DecisionMaker | null;
  onClose: () => void;
}) {
  const isEdit = !!contact?.id;
  const [fullName, setFullName] = useState(contact?.name ?? "");
  const [title, setTitle] = useState(contact?.title ?? "");
  const [email, setEmail] = useState(contact?.email ?? "");
  const [phone, setPhone] = useState(contact?.phone ?? "");
  const [linkedin, setLinkedin] = useState(contact?.linkedin ?? "");

  const utils = trpc.useUtils();
  const onSuccess = () => {
    utils.companies.list.invalidate();
    utils.contacts.byCompany.invalidate();
    toast.success(isEdit ? "Kontakt uppdaterad" : "Kontakt tillagd");
    onClose();
  };
  const createM = trpc.contacts.create.useMutation({ onSuccess });
  const updateM = trpc.contacts.update.useMutation({ onSuccess });
  const saving = createM.isPending || updateM.isPending;

  const save = () => {
    if (!fullName.trim() && !isEdit) {
      toast.error("Ange minst ett namn");
      return;
    }
    const payload = {
      fullName: fullName.trim(),
      title: title.trim(),
      email: email.trim(),
      phone: phone.trim(),
      linkedinUrl: linkedin.trim(),
    };
    if (isEdit && contact?.id) updateM.mutate({ id: contact.id, ...payload });
    else createM.mutate({ companyId: companyDbId, ...payload });
  };

  const field = (
    label: string,
    value: string,
    set: (v: string) => void,
    Icon: any,
    placeholder: string,
    type = "text",
  ) => (
    <div>
      <label className="text-xs font-medium text-gray-600 mb-1 flex items-center gap-1.5">
        <Icon className="w-3.5 h-3.5 text-gray-400" />
        {label}
      </label>
      <Input value={value} onChange={(e) => set(e.target.value)} placeholder={placeholder} type={type} />
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h3 className="font-semibold text-gray-900">
              {isEdit ? "Komplettera kontakt" : "Lägg till kontakt"}
            </h3>
            <p className="text-xs text-gray-500">{companyName}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-3">
          {field("Namn", fullName, setFullName, User, "För- och efternamn")}
          {field("Titel / roll", title, setTitle, Briefcase, "t.ex. Produktionschef")}
          {field("E-post", email, setEmail, Mail, "namn@bolag.se", "email")}
          {field("Mobilnummer", phone, setPhone, Phone, "+46 70 123 45 67", "tel")}
          {field("LinkedIn-URL", linkedin, setLinkedin, Linkedin, "https://www.linkedin.com/in/…")}
          <p className="text-[11px] text-gray-400 leading-snug pt-1">
            Fyll i det du hittat manuellt — lämna tomt det som saknas. Sparas direkt på {companyName}.
          </p>
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Avbryt
          </Button>
          <Button size="sm" onClick={save} disabled={saving} className="bg-red-600 hover:bg-red-700 text-white">
            {saving ? "Sparar…" : isEdit ? "Spara" : "Lägg till"}
          </Button>
        </div>
      </div>
    </div>
  );
}
