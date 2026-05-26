"""Importerar 49 ICP-seeds från larsalberyd-stack/ravema-lis till companies.json.

Strategi:
- Bevarar 8 hand-curated bolag (med decision makers, briefs, full LIS-data)
- Berika dem med ICP-status från Tier 1
- Lägger till 41 nya som ICP-seed-light (utan decision makers — kommer i Sprint 2)
- Mappar ICP status → AAA/AA/A/B per regel nedan

Mapping:
- HIGH PRIORITY ICP → AAA
- COMPETITIVE REPLACEMENT ICP → AAA
- LIGHTHOUSE ICP → AAA (men låg frekvens — säkerhet=medel)
- STRATEGIC FUTURE ICP → AA
- HIGH POTENTIAL ICP → AA
- LONG-TERM STRATEGIC ICP → A
- Tier 1 utan status → AA (de 4 lättare-curated)
- Tier 2 → A (validation set)
- Tier 3 → B (anti-pattern, overrides förklarar varför)
"""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path("/home/lab/workspace/Projects/Ravema LIS System ")
ICP_TS = Path("/tmp/icp-import/ravema-lis-stack/server/data/icp-seeds-v1.ts")
COMPANIES_JSON = ROOT / "ravema-lis/client/src/data/companies.json"

# Tier 1 → AAA/AA/A by status
STATUS_TO_TIER = {
    "HIGH PRIORITY ICP": ("AAA", "hög"),
    "COMPETITIVE REPLACEMENT ICP": ("AAA", "hög"),
    "LIGHTHOUSE ICP": ("AAA", "medel"),
    "STRATEGIC FUTURE ICP": ("AA", "hög"),
    "HIGH POTENTIAL ICP": ("AA", "medel"),
    "LONG-TERM STRATEGIC ICP": ("A", "medel"),
}

# Default for Tier 1 entries without status (de 4 lättare)
TIER1_DEFAULT = ("AA", "medel")
TIER2_DEFAULT = ("A", "medel")
TIER3_DEFAULT = ("B", "låg")

# Tier → scoreTotal (approximation för UI; lis-core kan beräkna riktigt sen)
TIER_TO_SCORE = {"AAA": 42, "AA": 28, "A": 18, "B": 8, "C": 3}

# Tier-ordning för max-jämförelse vid merge
TIER_ORDER = {"AAA": 0, "AA": 1, "A": 2, "B": 3, "C": 4}


def max_tier(a: str, b: str) -> str:
    """Returnerar högre av två tiers (AAA > AA > A > B > C)."""
    return a if TIER_ORDER.get(a, 99) < TIER_ORDER.get(b, 99) else b


def parse_tier1(ts: str):
    m = re.search(r'TIER_1_SEEDS:\s*Tier1Seed\[\]\s*=\s*\[(.*?)\];', ts, re.DOTALL)
    block = m.group(1)
    items = []
    depth = 0
    start = -1
    for i, ch in enumerate(block):
        if ch == "{":
            if depth == 0:
                start = i
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                items.append(block[start : i + 1])
    out = []
    for raw in items:
        name = re.search(r'name:\s*"([^"]+)"', raw).group(1)
        aka_m = re.search(r'aka:\s*"([^"]+)"', raw)
        summary = re.search(r'summary:\s*"([^"]+)"', raw).group(1)
        status_m = re.search(r'status:\s*"([^"]+)"', raw)

        drivers_m = re.search(r'drivers:\s*\[([^\]]+)\]', raw)
        signals_m = re.search(r'signals:\s*\[([^\]]+)\]', raw)
        drivers = re.findall(r'"([^"]+)"', drivers_m.group(1)) if drivers_m else []
        signals = re.findall(r'"([^"]+)"', signals_m.group(1)) if signals_m else []

        out.append({
            "name": name,
            "aka": aka_m.group(1) if aka_m else None,
            "summary": summary,
            "status": status_m.group(1) if status_m else None,
            "drivers": drivers,
            "signals": signals,
        })
    return out


def parse_tier2(ts: str):
    m = re.search(r'TIER_2_SEEDS:\s*Tier2Seed\[\]\s*=\s*\[(.*?)\];', ts, re.DOTALL)
    block = m.group(1)
    return [
        {"name": n, "comment": c}
        for n, c in re.findall(r'name:\s*"([^"]+)"[^}]*?comment:\s*"([^"]+)"', block)
    ]


def parse_tier3(ts: str):
    m = re.search(r'TIER_3_ANTI_PATTERNS:\s*Tier3AntiPattern\[\]\s*=\s*\[(.*?)\];', ts, re.DOTALL)
    block = m.group(1)
    return [
        {"name": n, "reason": r}
        for n, r in re.findall(r'name:\s*"([^"]+)"[^}]*?reason:\s*"([^"]+)"', block)
    ]


def slugify(name: str) -> str:
    s = name.lower().replace("&", "och").replace("/", "-")
    s = re.sub(r"[åä]", "a", s)
    s = re.sub(r"[ö]", "o", s)
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s


def find_existing(companies, name, aka=None):
    """Match existing entry by name OR aka."""
    name_lower = name.lower()
    aka_lower = (aka or "").lower()
    for c in companies:
        cn = c.get("name", "").lower()
        if cn == name_lower or (aka_lower and cn == aka_lower):
            return c
    return None


def build_lis_meta_tier1(seed, tier, confidence):
    reasons = [f"+Tier 1 ICP ({seed['status'] or 'Lars-curated'}) — Lars curation"]
    if seed["aka"]:
        reasons.append(f"+aka: {seed['aka']}")
    reasons.append(f"+ICP-logik: {seed['summary']}")
    for d in seed["drivers"][:3]:
        reasons.append(f"+driver: {d}")
    lis_signals = [
        {"type": s.upper().replace(" ", "_"), "detail": s, "date": None, "evidenceSource": "Lars curation"}
        for s in seed["signals"]
    ]
    return {
        "tier": tier,
        "scoreTotal": TIER_TO_SCORE[tier],
        "scoreBreakdown": {
            "firmographic": 22 if tier == "AAA" else 18 if tier == "AA" else 12,
            "capacity": 8 if tier == "AAA" else 5 if tier == "AA" else 3,
            "signals": 10 if seed["signals"] else 5,
            "engagement": 0,
            "strategic": 5 if tier == "AAA" else 3 if tier == "AA" else 2,
        },
        "reasons": reasons,
        "overrides": [],
        "confidence": confidence,
        "signals": lis_signals,
        "district": None,
        "competitorIncumbent": None,
        "managementPriority": seed["status"] == "HIGH PRIORITY ICP",
        "rationaleKlas": seed["summary"],
        "icpFlaggedBy": ["Lars / ICP seed v1"],
        "hasBrief": False,
    }


def build_lis_meta_tier2(seed):
    return {
        "tier": "A",
        "scoreTotal": TIER_TO_SCORE["A"],
        "scoreBreakdown": {"firmographic": 12, "capacity": 3, "signals": 0, "engagement": 0, "strategic": 3},
        "reasons": [
            f"+Tier 2 ICP — validation set (DNA-fit ska bekräftas)",
            f"+kommentar: {seed['comment']}",
        ],
        "overrides": [],
        "confidence": "låg",
        "signals": [],
        "district": None,
        "competitorIncumbent": None,
        "managementPriority": False,
        "rationaleKlas": seed["comment"],
        "icpFlaggedBy": ["Lars / ICP seed v1"],
        "hasBrief": False,
    }


def build_lis_meta_tier3(seed):
    return {
        "tier": "B",
        "scoreTotal": TIER_TO_SCORE["B"],
        "scoreBreakdown": {"firmographic": 5, "capacity": 1, "signals": 0, "engagement": 0, "strategic": 2},
        "reasons": [],
        "overrides": [
            f"CEILING → B: ICP anti-pattern — {seed['reason']}",
            "Looks like ICP men exkluderad av Lars curation — använd DNA för att inse varför",
        ],
        "confidence": "hög",
        "signals": [
            {"type": "DISQUALIFICATION_BLOCKER", "detail": seed["reason"], "date": None, "evidenceSource": "Lars curation"}
        ],
        "district": None,
        "competitorIncumbent": None,
        "managementPriority": False,
        "rationaleKlas": f"ANTI-PATTERN: {seed['reason']}",
        "icpFlaggedBy": ["Lars / ICP anti-pattern v1"],
        "hasBrief": False,
    }


def base_account(name, aka, segment_guess="SE-PRECISION"):
    """Skapa base företags-dict för nya företag (utan decision makers)."""
    return {
        "id": slugify(name),
        "name": name,
        "country": "NO" if any(x in name.lower() for x in ["bergen", "sperre", "finnøy", "stryvo", "kystdesign", "pds mecan", "huddig"]) else "SE",
        "city": "",
        "segment": segment_guess,
        "priority": "AAA",  # sätts av lis.tier nedan
        "status": "new",
        "assignedTo": None,
        "deadline": None,
        "description": (aka and f"Även känt som: {aka}. ") or "",
        "sowPotential": "",
        "triggers": [],
        "decisionMakers": [],
        "entryAngles": [],
        "qualifyingQuestions": [],
        "nextSteps": None,
        "notes": None,
    }


def main():
    ts = ICP_TS.read_text()
    tier1 = parse_tier1(ts)
    tier2 = parse_tier2(ts)
    tier3 = parse_tier3(ts)
    print(f"Parsed: Tier1={len(tier1)}, Tier2={len(tier2)}, Tier3={len(tier3)}")

    companies = json.loads(COMPANIES_JSON.read_text())
    print(f"Befintliga companies.json: {len(companies)}")

    merged_count = 0
    added_count = 0

    # Tier 1 — match/merge eller add new
    for seed in tier1:
        existing = find_existing(companies, seed["name"], seed["aka"])
        tier, confidence = STATUS_TO_TIER.get(seed["status"], TIER1_DEFAULT) if seed["status"] else TIER1_DEFAULT
        new_meta = build_lis_meta_tier1(seed, tier, confidence)
        if existing:
            # behåll deep curation, men berika lis-data
            if not existing.get("lis"):
                existing["lis"] = {}
            ex_lis = existing["lis"]
            # Behåll högre tier (existing kanske är AAA pga CEO-flag, ICP säger AA → AAA wins)
            ex_lis["tier"] = max_tier(ex_lis.get("tier") or "C", new_meta["tier"])
            ex_lis["scoreTotal"] = max(ex_lis.get("scoreTotal") or 0, new_meta["scoreTotal"])
            old_reasons = ex_lis.get("reasons") or []
            ex_lis["reasons"] = new_meta["reasons"] + old_reasons
            ex_lis["managementPriority"] = new_meta["managementPriority"] or ex_lis.get("managementPriority", False)
            # icpFlaggedBy = separat fält som inte krockar med existing flaggedBy (dict-objekt)
            icp_flagged = ex_lis.get("icpFlaggedBy") or []
            if "Lars / ICP seed v1" not in icp_flagged:
                icp_flagged.append("Lars / ICP seed v1")
            ex_lis["icpFlaggedBy"] = icp_flagged
            ex_lis["rationaleKlas"] = new_meta["rationaleKlas"]
            existing_signals = ex_lis.get("signals") or []
            existing_signals.extend([s for s in new_meta["signals"] if not any(es.get("type") == s["type"] for es in existing_signals)])
            ex_lis["signals"] = existing_signals
            existing["priority"] = ex_lis["tier"]
            merged_count += 1
        else:
            new_company = base_account(seed["name"], seed["aka"])
            new_company["priority"] = tier
            new_company["lis"] = new_meta
            companies.append(new_company)
            added_count += 1

    # Tier 2 — add new (få av dem är hand-curated)
    for seed in tier2:
        existing = find_existing(companies, seed["name"])
        if existing:
            merged_count += 1
            continue
        new_company = base_account(seed["name"], None)
        new_company["priority"] = "A"
        new_company["lis"] = build_lis_meta_tier2(seed)
        companies.append(new_company)
        added_count += 1

    # Tier 3 — anti-patterns
    for seed in tier3:
        existing = find_existing(companies, seed["name"])
        new_meta = build_lis_meta_tier3(seed)
        if existing:
            if not existing.get("lis"):
                existing["lis"] = {}
            ex_lis = existing["lis"]
            ex_lis["tier"] = "B"
            ex_lis["overrides"] = new_meta["overrides"] + (ex_lis.get("overrides") or [])
            ex_lis["rationaleKlas"] = new_meta["rationaleKlas"]
            icp_flagged = ex_lis.get("icpFlaggedBy") or []
            if "Lars / ICP anti-pattern v1" not in icp_flagged:
                icp_flagged.append("Lars / ICP anti-pattern v1")
            ex_lis["icpFlaggedBy"] = icp_flagged
            existing["priority"] = "B"
            merged_count += 1
        else:
            new_company = base_account(seed["name"], None)
            new_company["priority"] = "B"
            new_company["lis"] = new_meta
            companies.append(new_company)
            added_count += 1

    print(f"\nResultat: {len(companies)} totalt ({merged_count} merged, {added_count} nya)")
    tier_dist = {}
    for c in companies:
        t = c.get("lis", {}).get("tier", c.get("priority", "?"))
        tier_dist[t] = tier_dist.get(t, 0) + 1
    print(f"Tier-fördelning: {dict(sorted(tier_dist.items()))}")

    COMPANIES_JSON.write_text(json.dumps(companies, ensure_ascii=False, indent=2) + "\n")
    print(f"→ skrivet: {COMPANIES_JSON}")


if __name__ == "__main__":
    main()
