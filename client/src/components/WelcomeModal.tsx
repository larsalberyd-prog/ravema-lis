import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Lightbulb, Target, TrendingUp, Users } from "lucide-react";

interface WelcomeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function WelcomeModal({ open, onOpenChange }: WelcomeModalProps) {
  const handleComplete = () => {
    localStorage.setItem("ravema-lis-onboarding-completed", "true");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl">Välkommen till Lead Intelligence</DialogTitle>
        </DialogHeader>
        <div className="space-y-6 py-4">
          <p className="text-muted-foreground">
            Detta verktyg hjälper dig att identifiera och kontakta rätt beslutsfattare på marina målkonton
            med AI-genererade insikter och actionable intelligence.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Target className="w-5 h-5 text-primary" />
                <h3 className="font-semibold">Decision-Maker Packs</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Varje företag har ett komplett pack med triggers, beslutsfattare, entry angles och kvalificerande frågor.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                <h3 className="font-semibold">Triggers & Nyheter</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Se varför det är rätt tidpunkt att kontakta företaget just nu.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                <h3 className="font-semibold">Beslutsfattare</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Identifierade kontaktpersoner med roller, mejl, telefon och LinkedIn.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Lightbulb className="w-5 h-5 text-primary" />
                <h3 className="font-semibold">Entry Angles</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Tre olika sätt att inleda samtalet baserat på företagets situation.
              </p>
            </div>
          </div>

          <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
            <h3 className="font-semibold mb-2">Så här använder du verktyget:</h3>
            <ol className="list-decimal list-inside space-y-1 text-sm">
              <li>Välj ett företag från dashboarden</li>
              <li>Läs igenom Decision-Maker Pack</li>
              <li>Tilldela till en säljare med deadline</li>
              <li>Generera ett mejl baserat på insikterna</li>
              <li>Uppdatera status när kontakt är etablerad</li>
            </ol>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleComplete} className="w-full">
            Kom igång!
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
