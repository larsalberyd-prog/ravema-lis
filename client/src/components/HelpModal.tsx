import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

interface HelpModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function HelpModal({ open, onOpenChange }: HelpModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Hjälp & Vägledning</DialogTitle>
        </DialogHeader>
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="item-1">
            <AccordionTrigger>Vad är ett Decision-Maker Pack?</AccordionTrigger>
            <AccordionContent>
              Ett Decision-Maker Pack är ett komplett underrättelsepaket för ett målkonto. Det innehåller:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Företagsinformation och strategisk relevans</li>
                <li>Triggers (varför kontakta NU)</li>
                <li>Identifierade beslutsfattare med kontaktinfo</li>
                <li>Entry Angles (hur inleda samtalet)</li>
                <li>Kvalificerande frågor att ställa</li>
              </ul>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="item-2">
            <AccordionTrigger>Hur tilldelar jag ett lead till en säljare?</AccordionTrigger>
            <AccordionContent>
              <ol className="list-decimal list-inside space-y-1">
                <li>Öppna ett företag från dashboarden</li>
                <li>Klicka på "Tilldela Säljare" i högerkolumnen</li>
                <li>Välj säljare och sätt en deadline</li>
                <li>Klicka "Tilldela"</li>
              </ol>
              Säljaren kommer nu att synas på företagskortet och status uppdateras automatiskt till "Kontaktad".
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="item-3">
            <AccordionTrigger>Hur genererar jag ett mejl?</AccordionTrigger>
            <AccordionContent>
              <ol className="list-decimal list-inside space-y-1">
                <li>Öppna ett företag från dashboarden</li>
                <li>Klicka på "Generera Mejl"</li>
                <li>Granska den genererade mejltexten</li>
                <li>Klicka "Kopiera" för att kopiera texten, eller "Öppna i Mejl" för att öppna din mejlklient</li>
              </ol>
              Mejlet är baserat på företagets triggers och entry angles.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="item-4">
            <AccordionTrigger>Vad betyder prioriteringarna (AAA, AA, A)?</AccordionTrigger>
            <AccordionContent>
              <ul className="list-disc list-inside space-y-1">
                <li><strong>AAA:</strong> Högsta prioritet - stora strategiska konton med hög potential</li>
                <li><strong>AA:</strong> Hög prioritet - viktiga konton med god potential</li>
                <li><strong>A:</strong> Medelhög prioritet - intressanta konton att följa upp</li>
              </ul>
              Prioriteringen baseras på företagets storlek, marknadspotential och strategiska relevans.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="item-5">
            <AccordionTrigger>Hur uppdaterar jag status på ett lead?</AccordionTrigger>
            <AccordionContent>
              <ol className="list-decimal list-inside space-y-1">
                <li>Öppna ett företag från dashboarden</li>
                <li>I högerkolumnen under "Åtgärder", se "Uppdatera Status"</li>
                <li>Klicka på önskad status:</li>
              </ol>
              <ul className="list-disc list-inside mt-2 ml-6 space-y-1">
                <li><strong>Ny:</strong> Ingen kontakt etablerad än</li>
                <li><strong>Kontaktad:</strong> Första kontakten är gjord</li>
                <li><strong>Möte bokat:</strong> Ett möte är schemalagt</li>
                <li><strong>Kvalificerad:</strong> Leadet är kvalificerat och går vidare i säljprocessen</li>
              </ul>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="item-6">
            <AccordionTrigger>Varför hjälper detta verktyg mig?</AccordionTrigger>
            <AccordionContent>
              <strong>Tid sparad:</strong> Istället för att spendera 5-10 timmar per vecka på manuell research får du färdiga Decision-Maker Packs.
              <br /><br />
              <strong>Högre träffsäkerhet:</strong> AI-driven analys identifierar rätt beslutsfattare och triggers med 70%+ noggrannhet.
              <br /><br />
              <strong>Snabbare säljcykel:</strong> Genom att kontakta rätt person från början med rätt budskap förkortas säljcykeln.
              <br /><br />
              <strong>Actionable insights:</strong> Varje pack innehåller konkreta entry angles och frågor - inte bara information.
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </DialogContent>
    </Dialog>
  );
}
