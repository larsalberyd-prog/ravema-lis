import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

interface AddCompanyModalProps {
  open: boolean;
  onClose: () => void;
  onAdd?: () => void;
}

export default function AddCompanyModal({ open, onClose, onAdd }: AddCompanyModalProps) {
  const [formData, setFormData] = useState({
    name: "",
    domain: "",
    country: "",
    city: "",
    category: "",
    focus: "A" as "AAA" | "AA" | "A" | "B" | "C",
  });

  const utils = trpc.useUtils();

  const webhookMutation = trpc.webhook.clay.useMutation({
    onSuccess: () => {
      utils.companies.list.invalidate();
      utils.dashboard.stats.invalidate();
      toast.success(`${formData.name} har lagts till!`);
      setFormData({ name: "", domain: "", country: "", city: "", category: "", focus: "A" });
      onAdd?.();
      onClose();
    },
    onError: (err) => {
      toast.error("Kunde inte lägga till företag: " + err.message);
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) {
      toast.error("Vänligen fyll i företagsnamn");
      return;
    }
    webhookMutation.mutate({
      company_name: formData.name,
      company_domain: formData.domain || undefined,
      category: formData.category || undefined,
      city: formData.city || undefined,
      country: formData.country || undefined,
      focus: formData.focus,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Lägg till nytt företag</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Företagsnamn *</Label>
            <Input id="name" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="t.ex. Rolls-Royce Marine" disabled={webhookMutation.isPending} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="domain">Domän</Label>
            <Input id="domain" value={formData.domain} onChange={e => setFormData({ ...formData, domain: e.target.value })} placeholder="t.ex. rolls-royce.com" disabled={webhookMutation.isPending} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="country">Land</Label>
              <Input id="country" value={formData.country} onChange={e => setFormData({ ...formData, country: e.target.value })} placeholder="t.ex. Norge" disabled={webhookMutation.isPending} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="city">Stad</Label>
              <Input id="city" value={formData.city} onChange={e => setFormData({ ...formData, city: e.target.value })} placeholder="t.ex. Bergen" disabled={webhookMutation.isPending} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="category">Kategori</Label>
            <Input id="category" value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })} placeholder="t.ex. Marine Propulsion" disabled={webhookMutation.isPending} />
          </div>
          <div className="space-y-2">
            <Label>Prioritet</Label>
            <Select value={formData.focus} onValueChange={(v: any) => setFormData({ ...formData, focus: v })} disabled={webhookMutation.isPending}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="AAA">AAA - Högsta prioritet</SelectItem>
                <SelectItem value="AA">AA - Hög prioritet</SelectItem>
                <SelectItem value="A">A - Normal prioritet</SelectItem>
                <SelectItem value="B">B - Lägre prioritet</SelectItem>
                <SelectItem value="C">C - Bevakningslista</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={webhookMutation.isPending}>Avbryt</Button>
            <Button type="submit" disabled={webhookMutation.isPending} className="bg-red-600 hover:bg-red-700">
              {webhookMutation.isPending ? "Lägger till..." : "Lägg till företag"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
