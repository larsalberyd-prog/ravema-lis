import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { UserCog, User } from "lucide-react";
import { useRole } from "@/contexts/RoleContext";

interface RoleSelectorProps {
  open: boolean;
  onComplete: () => void;
}

export default function RoleSelector({ open, onComplete }: RoleSelectorProps) {
  const { setRole, setSalespersonName } = useRole();
  const [selectedRole, setSelectedRole] = useState<"fc" | "salesperson" | null>(null);
  const [name, setName] = useState("");

  const handleComplete = () => {
    if (!selectedRole) return;
    
    setRole(selectedRole);
    if (selectedRole === "salesperson" && name) {
      setSalespersonName(name);
    }
    onComplete();
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-[600px]" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Välj Din Roll</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          <div className="grid md:grid-cols-2 gap-4">
            <Card 
              className={`cursor-pointer transition-all ${
                selectedRole === "fc" 
                  ? "border-primary ring-2 ring-primary" 
                  : "hover:border-primary/50"
              }`}
              onClick={() => setSelectedRole("fc")}
            >
              <CardHeader>
                <UserCog className="w-12 h-12 text-primary mb-2" />
                <CardTitle>Field Coach</CardTitle>
                <CardDescription>
                  Översikt över alla säljare, tilldela målkonton och följa upp status
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="text-sm space-y-1 text-muted-foreground">
                  <li>• Se alla målkonton</li>
                  <li>• Tilldela säljare</li>
                  <li>• Följa upp tasks</li>
                  <li>• Generera rapporter</li>
                </ul>
              </CardContent>
            </Card>

            <Card 
              className={`cursor-pointer transition-all ${
                selectedRole === "salesperson" 
                  ? "border-primary ring-2 ring-primary" 
                  : "hover:border-primary/50"
              }`}
              onClick={() => setSelectedRole("salesperson")}
            >
              <CardHeader>
                <User className="w-12 h-12 text-primary mb-2" />
                <CardTitle>Säljare</CardTitle>
                <CardDescription>
                  Se dina tilldelade målkonton och uppdatera status
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="text-sm space-y-1 text-muted-foreground">
                  <li>• Se tilldelade konton</li>
                  <li>• Läs Decision-Maker Packs</li>
                  <li>• Uppdatera status</li>
                  <li>• Kvalificera leads</li>
                </ul>
              </CardContent>
            </Card>
          </div>

          {selectedRole === "salesperson" && (
            <div className="space-y-2">
              <Label htmlFor="name">Ditt Namn</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="t.ex. Anna Andersson"
              />
            </div>
          )}

          <Button 
            className="w-full" 
            onClick={handleComplete}
            disabled={!selectedRole || (selectedRole === "salesperson" && !name)}
          >
            Fortsätt
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
