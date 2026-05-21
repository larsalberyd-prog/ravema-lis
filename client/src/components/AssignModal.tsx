import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCompanies, type Company } from "@/hooks/useCompanies";
import { toast } from "sonner";

interface AssignModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  company: Company;
}

const salespeople = ["Per Wincent", "Vidar Nilsen", "Lars Alberyd", "Anna Svensson"];

export default function AssignModal({ open, onOpenChange, company }: AssignModalProps) {
  const { assignCompany } = useCompanies();
  const [selectedSalesperson, setSelectedSalesperson] = useState("");
  const [deadline, setDeadline] = useState("");

  const handleAssign = () => {
    if (!selectedSalesperson || !deadline) {
      toast.error("Vänligen fyll i alla fält");
      return;
    }

    assignCompany(company.id, selectedSalesperson, deadline);
    toast.success(`${company.name} tilldelad till ${selectedSalesperson}`);
    onOpenChange(false);
    setSelectedSalesperson("");
    setDeadline("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tilldela Säljare</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Företag</Label>
            <Input value={company.name} disabled />
          </div>
          <div className="space-y-2">
            <Label>Säljare</Label>
            <Select value={selectedSalesperson} onValueChange={setSelectedSalesperson}>
              <SelectTrigger>
                <SelectValue placeholder="Välj säljare" />
              </SelectTrigger>
              <SelectContent>
                {salespeople.map((person) => (
                  <SelectItem key={person} value={person}>
                    {person}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Deadline</Label>
            <Input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Avbryt
          </Button>
          <Button onClick={handleAssign}>Tilldela</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
