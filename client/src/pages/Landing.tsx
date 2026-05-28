import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "wouter";
import {
  ArrowRight,
  CheckCircle2,
  XCircle,
  Shield,
  Users,
} from "lucide-react";

export default function Landing() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      {/* Hero */}
      <div className="container py-16">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          <Badge variant="outline" className="text-sm px-4 py-1">
            Ravema AB · Pilot
          </Badge>
          <h1 className="text-5xl font-bold tracking-tight">
            Lead Intelligence System
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Pilot för Klas (säljchef) och Nejra (SDR). Hittar köpsignaler innan
            konkurrenten, förklarar varför varje konto är prio, och gör research-jobbet
            på sekunder istället för timmar.
          </p>
          <div className="flex gap-4 justify-center pt-4">
            <Button size="lg" onClick={() => setLocation("/dashboard")}>
              Kom igång
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => {
                document.getElementById("features")?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              Läs mer
            </Button>
          </div>
        </div>
      </div>

      {/* Problem & Lösning */}
      <div className="container py-16">
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-8">
          <Card className="border-destructive/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <XCircle className="w-5 h-5" />
                Problemet
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                • <strong>Tidiga köpsignaler missas</strong> — capex-pressmeddelanden,
                prodchef-rekryteringar och ägarskiften syns inte i prospektlistan.
              </p>
              <p className="text-sm text-muted-foreground">
                • <strong>Prioritering är magkänsla</strong> — AAA blir en gut feel-tag
                utan algoritm bakom.
              </p>
              <p className="text-sm text-muted-foreground">
                • <strong>Konkurrent-incumbent är osynlig</strong> — vi vet inte vilka
                konton som är DMG- eller Okuma-kunder förrän vi ringer dem.
              </p>
              <p className="text-sm text-muted-foreground">
                • <strong>Researchen tar 3–5 h per säljare och vecka</strong> — som annars
                hade gått till samtal.
              </p>
            </CardContent>
          </Card>

          <Card className="border-primary/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-primary">
                <CheckCircle2 className="w-5 h-5" />
                Lösningen
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                • <strong>Scoring med tydlig förklaring</strong> — AAA→C med reasons-lista
                per konto. Ingen svart box.
              </p>
              <p className="text-sm text-muted-foreground">
                • <strong>Köpsignal-detektion</strong> — CAPEX, expansioner, nyckelrekryteringar
                (typ Mazak-bakgrund hos ny prodchef), aktiva affärer.
              </p>
              <p className="text-sm text-muted-foreground">
                • <strong>Anti-fit-flaggor</strong> — appen pekar också ut vilka konton vi
                <em> inte</em> ska jaga (ex-EMAG-säljare, blockerande inköp).
              </p>
              <p className="text-sm text-muted-foreground">
                • <strong>Konkurrent + displacement-vinkel</strong> — DMG, Okuma, Hermle,
                Nakamura. Vi vet vart vi attackerar.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Pilotskedet */}
      <div className="container py-16 bg-muted/30">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-3">Pilotskedet</h2>
          <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
            Pilot 3–6 mån, juni 2026 → . Två operativa användare — Klas och Nejra —
            driver hela outreach-flödet tillsammans.
          </p>
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <Shield className="w-10 h-10 text-primary mb-2" />
                <CardTitle>Klas — Säljchef</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">
                  Klas mejlar intelligenta och utmanande mejl till ICP från dag 1 —
                  minst 10 utskick per vecka. Driver outreach-strategin.
                </p>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li>→ Ser översikt av samtliga konton, sorterat AAA→C</li>
                  <li>→ Granskar reasons + signaler innan första kontakt</li>
                  <li>→ Skickar AI-genererat utkast via sin egen mejlklient</li>
                  <li>→ Äger dialogen när ett konto blir aktivt</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Users className="w-10 h-10 text-primary mb-2" />
                <CardTitle>Nejra — SDR</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">
                  Nejra mejlar både intelligenta ICP-mejl och bredare produkt-, event-
                  och kampanj-spår. Skickar från sitt eget konto eller via Klas.
                </p>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li>→ Skickar utgående mejl från sitt eget konto eller via Klas</li>
                  <li>→ Driver intelligenta ICP-mejl, kampanjer kring produkter och events (t.ex. Elmia)</li>
                  <li>→ Fyller på köpsignaler och konkurrent-information</li>
                  <li>→ Lägger upp Intelligence Pack-briefer för AAA-konton</li>
                </ul>
              </CardContent>
            </Card>
          </div>
          <p className="text-center text-sm text-muted-foreground mt-8 max-w-3xl mx-auto">
            Säljteamet involveras case-by-case när Klas är klar med första kontakten — vi
            rullar inte ut brett ännu. Tilldelnings- och säljarvyer finns i appen men
            aktiveras inte förrän efter pilot.
          </p>
        </div>
      </div>

      {/* Vad är live idag */}
      <div className="container py-16" id="features">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">Vad är live idag</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-primary">
                  <CheckCircle2 className="w-5 h-5" />
                  Aktivt i piloten
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm">✓ 8 demo-konton med komplett LIS-data (5 AAA, 1 AA, 1 B)</p>
                <p className="text-sm">✓ Scoring med 5 dimensioner: Företagsdata, Köpkapacitet, Köpsignaler, Engagemang, Strategisk fit</p>
                <p className="text-sm">✓ Reasons + overrides per konto (säkerhet: hög/medel/låg)</p>
                <p className="text-sm">✓ Signaler & Evidence-tidslinje per företag</p>
                <p className="text-sm">✓ Intelligence Pack — 1-sida brief per AAA-konto</p>
                <p className="text-sm">✓ Decision Makers från Apollo+Lusha (titel, mejl, LinkedIn, telefon)</p>
                <p className="text-sm">✓ Aktivitetslogg per konto (samtal, mejl, möten)</p>
                <p className="text-sm">✓ AI-genererade mejlutkast (svenska/engelska, Mazak-anpassade)</p>
                <p className="text-sm">✓ Konkurrent-incumbent + displacement-vinkel</p>
                <p className="text-sm">✓ Anti-fit-flaggor (blocker-signaler)</p>
                <p className="text-sm">✓ SE + NO i samma vy med samma scoring</p>
                <p className="text-sm">✓ HTTPS + basic auth (Klas/Nejra-credentials)</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-muted-foreground">
                  <XCircle className="w-5 h-5" />
                  Planeras post-pilot
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm">→ Autonom signal-ingestion (JobTech, Brreg, Cision)</p>
                <p className="text-sm">→ STAR-formaterade kvalificeringsfrågor unikt per Intelligence Pack</p>
                <p className="text-sm">→ Alternativa teman för mejlutkast (tekniska/affärsmässiga/relationsbyggande)</p>
                <p className="text-sm">→ Outcome tracking (sent/opened/replied/möte/won/lost)</p>
                <p className="text-sm">→ Konvertering-analytics per segment + trigger</p>
                <p className="text-sm">→ Mejl-utskick direkt från appen (i pilot: copy/paste)</p>
                <p className="text-sm">→ Lusha mobile-lookup direkt i decision-maker-kortet</p>
                <p className="text-sm">→ HubSpot/Dynamics-sync</p>
                <p className="text-sm">→ Geo-karta SE + NO</p>
                <p className="text-sm">→ Säljarrullning + veckotilldelning aktiveras</p>
                <p className="text-sm">→ Kalenderintegration för mötesbokningar</p>
                <p className="text-sm">→ Veckorapport-export (CSV/PDF)</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Roadmap */}
      <div className="container py-16 bg-muted/30">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-3">Roadmap — från 50 till 200 leads</h2>
          <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
            Idag 50 ICP-curaterade konton (7 AAA · 9 AA · 22 A · 12 anti-patterns).
            Tre faser bygger ut listan till 200 över pilotens 3 månader.
          </p>
          <div className="grid md:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <Badge variant="outline" className="w-fit mb-2">Fas 1 · nu → 1 mån</Badge>
                <CardTitle className="text-lg">Scoring &amp; status</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1.5 text-sm text-muted-foreground">
                  <li>→ Live ICP-scoring 0–100 per konto med 8-kriteriers breakdown</li>
                  <li>→ Status-tracking: Ny → Kontaktad → Discovery → Diskvalificerad</li>
                  <li>→ Decision Makers per AAA-konto (VD/COO/Fabrikschef/Teknikchef)</li>
                  <li>→ Diskval med skäl + auto-rehab-datum</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Badge variant="outline" className="w-fit mb-2">Fas 2 · 1–2 mån</Badge>
                <CardTitle className="text-lg">Skalning &amp; intel</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1.5 text-sm text-muted-foreground">
                  <li>→ AI-lookalikes: ICP-DNA genererar nya nordiska SME-kandidater</li>
                  <li>→ Tier 2 → Tier 1-promotion när fit bekräftas</li>
                  <li>→ Intelligence Pack v2 per konto</li>
                  <li>→ STAR-frågor + entry angle per beslutsfattare</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Badge variant="outline" className="w-fit mb-2">Fas 3 · 2–3 mån</Badge>
                <CardTitle className="text-lg">Full aktivering</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1.5 text-sm text-muted-foreground">
                  <li>→ 200 leads med komplett aktiveringsstack</li>
                  <li>→ Live köpsignaler (RSS: Verkstäderna, NyTeknik, Maskinaktuellt, Defence24, FOI)</li>
                  <li>→ Autonom signal-ingestion (JobTech, Brreg)</li>
                  <li>→ Alternativa mejl-teman per konto + segment</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="container py-16">
        <div className="max-w-3xl mx-auto text-center space-y-6">
          <h2 className="text-3xl font-bold">Redo att börja titta?</h2>
          <p className="text-xl text-muted-foreground">
            Öppna dashboarden och klicka in på ett AAA-konto (t.ex. ACC Innovation
            eller Axido) för att se scoring + reasons + signaler i aktion.
          </p>
          <Button size="lg" onClick={() => setLocation("/dashboard")}>
            Öppna Dashboard
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
}
