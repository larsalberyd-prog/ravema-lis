import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import {
  ArrowRight, CheckCircle2, XCircle, Shield, Users, Zap,
  Brain, Target, Mail, Search, RefreshCw, TrendingUp, ChevronRight,
} from "lucide-react";

const LOOP = [
  { n: 1, label: "Intelligence", sub: "signaler & triggers", Icon: Search },
  { n: 2, label: "Analys", sub: "ICP-score & pain", Icon: Brain },
  { n: 3, label: "Plan", sub: "rätt roll & vinkel", Icon: Target },
  { n: 4, label: "Attack", sub: "mejl sv/no/en", Icon: Mail },
  { n: 5, label: "Scouting", sub: "Discovery (SPAR)", Icon: Search },
  { n: 6, label: "Uppföljning", sub: "20–26 touch points", Icon: RefreshCw },
  { n: 7, label: "Förstärkning", sub: "learnings → loopen", Icon: TrendingUp },
];

const STEPS = [
  { t: "FC prioriterar portföljen", d: "Bolagen poängsätts mot ICP:n och sorteras AAA → C automatiskt. FC trafikleder och tilldelar SDR/säljare." },
  { t: "LIS bygger intelligensen", d: "AI (Claude) läser signaler, kartlägger beslutsfattarna och genererar ett roll-anpassat info-pack på sekunder." },
  { t: "SDR förbereder Discovery — säljaren kör den", d: "SDR genererar SPAR-frågorna (Situation · Pain · Affect · Resolve) ur info-packet. Säljaren kör dialogen i samtalet; svaren återförs till LIS." },
  { t: "Ägt, personligt budskap", d: "Mejlgeneratorn skriver på svenska, norska eller engelska — pain-first, personifierat och ägt. Aldrig massutskick." },
  { t: "Loopen förstärker sig själv", d: "Varje varv gör score, vinklar och budskap vassare för nästa konto. Intelligensen ackumuleras — det är vallgraven." },
];

export default function Landing() {
  const [, setLocation] = useLocation();
  const go = () => setLocation("/dashboard");

  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* ── Top bar ───────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div className="leading-tight">
              <p className="font-bold tracking-tight">LIS</p>
              <p className="text-[10px] text-slate-400 -mt-0.5">av Polnova</p>
            </div>
          </div>
          <Button size="sm" onClick={go} className="bg-red-600 hover:bg-red-700 text-white gap-1">
            Logga in <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </header>

      {/* ── Hero ──────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-white">
        <div className="absolute inset-0 opacity-[0.07]"
          style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "28px 28px" }} />
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-red-600/20 rounded-full blur-3xl" />
        <div className="relative max-w-6xl mx-auto px-5 py-24 md:py-28">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-slate-300 mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
              Ravema AB · LIS-pilot · pre-sales-lagret
            </div>
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight leading-[1.05]">
              Lead Intelligence System
              <span className="block mt-2 text-transparent bg-clip-text bg-gradient-to-r from-red-400 via-orange-300 to-amber-200">
                kvalificerade samtal, systematiskt.
              </span>
            </h1>
            <p className="mt-6 text-lg text-slate-300 max-w-2xl leading-relaxed">
              LIS förvandlar en kall målgruppslista till varma, kvalificerade affärssamtal — för FC,
              SDR och säljare. Den hittar köpsignaler, förklarar varför varje konto är prio, genererar
              info-pack och pain-first-mejl (sv/no/en) med Claude och förbereder Discovery (SPAR) som
              säljaren kör i samtalet — svaren matas tillbaka i loopen. Research på sekunder, vassare för varje varv.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" onClick={go} className="bg-red-600 hover:bg-red-700 text-white gap-2">
                Kom igång <ArrowRight className="w-4 h-4" />
              </Button>
              <Button size="lg" variant="outline"
                onClick={() => document.getElementById("loop")?.scrollIntoView({ behavior: "smooth" })}
                className="border-white/20 bg-white/5 text-white hover:bg-white/10">
                Se hur det fungerar
              </Button>
            </div>
          </div>

          {/* stat strip */}
          <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-px rounded-2xl overflow-hidden border border-white/10 bg-white/5">
            {[
              ["10–15 % → 50 %", "offert→affär (mål)"],
              ["20–26", "touch points / konto"],
              ["3 språk", "sv · no · en"],
              ["1 loop", "som blir vassare"],
            ].map(([big, small], i) => (
              <div key={i} className="bg-slate-900/40 px-5 py-6">
                <p className="text-2xl font-bold">{big}</p>
                <p className="text-xs text-slate-400 mt-1">{small}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Problem / Lösning ─────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-5 py-20">
        <div className="grid md:grid-cols-2 gap-6">
          <div className="rounded-2xl border border-slate-200 p-7">
            <div className="flex items-center gap-2 text-slate-900 font-semibold mb-4">
              <XCircle className="w-5 h-5 text-slate-400" /> Problemet idag
            </div>
            <ul className="space-y-3 text-sm text-slate-600">
              {[
                ["Service-drivna AM, inte hunters", "tekniska SME-säljare prospekterar sällan systematiskt"],
                ["Manuell research stjäl tiden", "timmar på att gräva istället för att sälja"],
                ["Fel person, fel budskap", "kontakten når inte rätt beslutsfattare med rätt smärta"],
                ["Låg träffsäkerhet", "offert→affär fastnar på 10–15 %"],
              ].map(([h, d], i) => (
                <li key={i} className="flex gap-3">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-slate-300 flex-shrink-0" />
                  <span><strong className="text-slate-800">{h}</strong> — {d}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border-2 border-red-100 bg-red-50/40 p-7">
            <div className="flex items-center gap-2 text-red-700 font-semibold mb-4">
              <CheckCircle2 className="w-5 h-5" /> Vad LIS gör
            </div>
            <ul className="space-y-3 text-sm text-slate-700">
              {[
                ["Rätt bolag, rätt beslutsfattare", "ICP-score + kartlagda roller per konto"],
                ["Info-pack på sekunder", "signaler, vinklar och SPAR-frågor med Claude"],
                ["Ägt, personligt budskap", "pain-first-mejl på sv/no/en — inte massutskick"],
                ["Mätbar effekt", "allt mäts mot CRM-baslinjen mot målet 50 %"],
              ].map(([h, d], i) => (
                <li key={i} className="flex gap-3">
                  <CheckCircle2 className="mt-0.5 w-4 h-4 text-red-500 flex-shrink-0" />
                  <span><strong className="text-slate-900">{h}</strong> — {d}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── Loopen (moat) ─────────────────────────────────────── */}
      <section id="loop" className="bg-slate-50 border-y border-slate-100">
        <div className="max-w-6xl mx-auto px-5 py-20">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <p className="text-xs font-semibold tracking-widest text-red-600 uppercase mb-2">Vallgraven</p>
            <h2 className="text-3xl font-bold tracking-tight">Den självförstärkande loopen</h2>
            <p className="mt-3 text-slate-600">
              Ett klassiskt CRM lagrar — LIS lär. För varje konto som passerar loopen blir nästa
              skarpare. Styrkan är inte koden, utan den växande intelligensen och den tränade säljmotionen.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {LOOP.map(({ n, label, sub, Icon }, i) => (
              <div key={n} className="relative rounded-xl bg-white border border-slate-200 p-4 hover:border-red-200 hover:shadow-sm transition">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-6 h-6 rounded-full bg-slate-900 text-white text-xs font-bold flex items-center justify-center">{n}</span>
                  <Icon className="w-4 h-4 text-red-600" />
                </div>
                <p className="font-semibold text-sm">{label}</p>
                <p className="text-xs text-slate-500">{sub}</p>
                {i < LOOP.length - 1 && (
                  <ChevronRight className="hidden lg:block absolute -right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                )}
              </div>
            ))}
            <div className="rounded-xl bg-gradient-to-br from-red-600 to-red-700 text-white p-4 flex flex-col justify-center">
              <RefreshCw className="w-5 h-5 mb-2" />
              <p className="font-semibold text-sm">↻ Ackumulerad intelligens</p>
              <p className="text-xs text-red-100">moat — växer för varje varv</p>
            </div>
          </div>

          <div className="mt-8 rounded-xl bg-white border border-slate-200 p-5 text-center">
            <p className="text-sm text-slate-600">
              <strong className="text-slate-900">SPAR-doktrin (förtroende först):</strong>{" "}
              Situation · Pain · Affect <span className="text-slate-400">(hjärtat)</span> · Resolve —
              varje varv tränas mot doktrinen, inte mot volym.
            </p>
          </div>
        </div>
      </section>

      {/* ── Roller ────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-5 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold tracking-tight">Tre roller, en motion</h2>
          <p className="mt-3 text-slate-600">LIS är pre-sales-lagret — den nya säljmotionen bredvid account managementen.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { Icon: Shield, role: "FC / Säljledning", color: "text-red-600",
              points: ["Överblick över hela portföljen", "Prioritering AAA → C", "Tilldelar SDR/säljare", "Mäter mot CRM-baslinjen"] },
            { Icon: Zap, role: "SDR / Intelligence", color: "text-blue-600",
              points: ["Dagens drag — nästa bästa konto", "Genererar info-pack & Discovery", "Mejl sv/no/en, ägt budskap", "Trimmar loopen på learnings"] },
            { Icon: Users, role: "Säljare", color: "text-emerald-600",
              points: ["Tar vid på kvalificerade samtal", "Personlig kontakt (LinkedIn/möte)", "Loggar aktivitet & status", "Driver mot affär"] },
          ].map(({ Icon, role, color, points }, i) => (
            <div key={i} className="rounded-2xl border border-slate-200 p-7 hover:shadow-md transition">
              <Icon className={`w-10 h-10 ${color} mb-4`} />
              <h3 className="font-semibold text-lg mb-3">{role}</h3>
              <ul className="space-y-2 text-sm text-slate-600">
                {points.map((p, j) => (
                  <li key={j} className="flex gap-2"><ChevronRight className="w-4 h-4 text-slate-300 mt-0.5 flex-shrink-0" />{p}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* ── Hur det fungerar ──────────────────────────────────── */}
      <section className="bg-slate-50 border-y border-slate-100">
        <div className="max-w-3xl mx-auto px-5 py-20">
          <h2 className="text-3xl font-bold tracking-tight text-center mb-12">Hur det fungerar</h2>
          <div className="relative space-y-8">
            <div className="absolute left-[19px] top-2 bottom-2 w-px bg-slate-200" />
            {STEPS.map((s, i) => (
              <div key={i} className="relative flex gap-5">
                <div className="relative z-10 flex-shrink-0 w-10 h-10 rounded-full bg-red-600 text-white flex items-center justify-center font-bold">
                  {i + 1}
                </div>
                <div className="pt-1">
                  <h3 className="font-semibold">{s.t}</h3>
                  <p className="text-sm text-slate-600 mt-1">{s.d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Idag / Roadmap ────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-5 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold tracking-tight">Vad systemet gör — och vad som kommer</h2>
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="rounded-2xl border border-slate-200 p-7">
            <div className="flex items-center gap-2 text-emerald-600 font-semibold mb-4">
              <CheckCircle2 className="w-5 h-5" /> Live idag
            </div>
            <div className="space-y-2 text-sm text-slate-700">
              {[
                "Roll-styrda vyer — FC, SDR, säljare",
                "ICP-score & prioritering AAA → C",
                "AI info-pack per konto (Claude)",
                "Discovery (SPAR) — svar återförs till LIS",
                "Mejlgenerator på sv/no/en, pain-first",
                "Manuell komplettering av kontaktuppgifter",
                "Beslutsfattare: mejl · mobil · LinkedIn",
                "Driftlägen: test · pilot · normal",
              ].map((t, i) => <p key={i}>✅ {t}</p>)}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 p-7 bg-slate-50/60">
            <div className="flex items-center gap-2 text-slate-500 font-semibold mb-4">
              <RefreshCw className="w-5 h-5" /> På väg
            </div>
            <div className="space-y-2 text-sm text-slate-600">
              {[
                "Skicka mejl från seniora specialisters konton (A/B-avsändare)",
                "SDR-cockpit: kadens & Diagnos & Trim",
                "Verifierade mejladresser & direkta LinkedIn-profiler",
                "Dynamics-koppling (PoE — mid-sales)",
                "AGE — account growth (post-sales)",
                "Veckorapport & teamöversikt",
              ].map((t, i) => <p key={i}>⚠️ {t}</p>)}
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────────── */}
      <section className="bg-gradient-to-br from-slate-950 to-slate-800 text-white">
        <div className="max-w-3xl mx-auto px-5 py-20 text-center">
          <h2 className="text-3xl font-bold tracking-tight">Inte ännu ett verktyg.</h2>
          <p className="mt-3 text-lg text-slate-300">
            En säljmotion som blir vassare för varje konto. Bygg listan en gång — loopen gör resten.
          </p>
          <Button size="lg" onClick={go} className="mt-8 bg-red-600 hover:bg-red-700 text-white gap-2">
            Öppna LIS <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────── */}
      <footer className="border-t border-slate-100">
        <div className="max-w-6xl mx-auto px-5 py-8 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-400">
          <p className="font-semibold text-slate-500">Polnova · LIS — Lead Intelligence System</p>
          <p>Lagerlogik: LIS (pre-sales) → PoE (i Dynamics) → AGE (account growth)</p>
        </div>
      </footer>
    </div>
  );
}
