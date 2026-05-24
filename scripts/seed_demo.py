"""Seedar ravema_lis-DB med anchor-fixtures + Mattias prospekt-lista.

Demo-syfte: en realistisk uppsättning företag inför Ravema-ledningsdemo 2026-05-28.
Real scoring körs av lis-core/agents/scoring (kopplas in i nästa steg) — det här
scriptet sätter bara en initial placeholder-score baserad på golden expected_tier,
så UI:t har något att visa direkt.
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import pymysql
import yaml

ROOT = Path("/home/lab/workspace/Projects/Ravema LIS System ")
FIXTURES = ROOT / "lis-core/evals/fixtures"
GOLDEN = ROOT / "lis-core/evals/golden"
PROSPECTS = ROOT / "spec/prospects_seed.yaml"

SEGMENT_TO_INDUSTRY = {
    "SE-DEF-AERO": "Försvar/Flyg",
    "SE-HEAVY": "Tunga industri",
    "SE-MEDTECH": "Medtech/Dental",
    "SE-AUTO-EV": "Auto/EV",
    "SE-JOBSHOP-GGVV": "Mekanik (GGVV)",
    "NO-DEF": "Försvar (NO)",
    "NO-MARINE": "Maritim",
    "NO-OG": "Olja/Gas",
}

TIER_TO_SCORE = {"AAA": 92, "AA": 78, "A": 62, "B": 45, "C": 28}


def classify_signal(sig_type: str) -> tuple[str, str]:
    """Map free-form signal type strings to (signalType-enum, source-label)."""
    t = (sig_type or "").upper()
    if "HIRE" in t or "MANAGER" in t or "RECRUIT" in t:
        return ("job", "salesperson-input")
    if "EXPAN" in t or "PLANT" in t or "FACILITY" in t:
        return ("news", "salesperson-input")
    if "OWNER" in t or "MERGER" in t or "ACQUISITION" in t:
        return ("ownership", "salesperson-input")
    if "FUND" in t or "INVEST" in t:
        return ("funding", "salesperson-input")
    if "PROCUREMENT" in t or "TENDER" in t:
        return ("procurement", "salesperson-input")
    return ("news", "salesperson-input")


def load_fixture_companies():
    """Read all 40 fixture+golden pairs, produce company dicts."""
    out = []
    for fp in sorted(FIXTURES.glob("anchor-*.json")):
        fixture = json.loads(fp.read_text())
        gp = GOLDEN / fp.name
        golden = json.loads(gp.read_text()) if gp.exists() else {}
        tier = golden.get("expected_tier", "B")
        segment = fixture.get("segment")
        signals_raw = fixture.get("signals_at_capture") or []
        out.append({
            "name": fixture["name"],
            "country": fixture.get("country"),
            "city": fixture.get("geo"),
            "icp_segment": segment,
            "industry": SEGMENT_TO_INDUSTRY.get(segment, segment),
            "focus": tier,
            "score_total": TIER_TO_SCORE.get(tier, 50),
            "score_breakdown": {
                "placeholder": True,
                "tier": tier,
                "reasons": [
                    f"Initial placeholder från golden expected_tier={tier}",
                    f"Anchor i {segment} per ICP.md",
                ] + ([gp.read_text() and json.loads(gp.read_text()).get("calibration_note") or ""] if golden.get("calibration_note") else []),
                "dimensions": {},
                "source": "seed_demo_placeholder",
            },
            "description": fixture.get("salesperson_rationale") or f"Anchor i {segment} per ICP.md anchors-lista.",
            "source": "icp-md-anchors",
            "category": "anchor",
            "signals_at_capture": signals_raw,
            "notes": (golden.get("calibration_note") or "")[:1000] or None,
        })
    return out


def load_prospects_seed():
    """Read Mattias prospekt-lista, only those with signals_at_capture (most useful for demo)."""
    data = yaml.safe_load(PROSPECTS.read_text())
    out = []
    for p in data.get("prospects", []):
        if not p.get("signals_at_capture"):
            continue
        tier = p.get("expected_tier", "B")
        segment = p.get("segment")
        out.append({
            "name": p["name"],
            "country": p.get("country"),
            "city": p.get("geo"),
            "icp_segment": segment,
            "industry": SEGMENT_TO_INDUSTRY.get(segment, segment or "Mekanik"),
            "focus": tier,
            "score_total": TIER_TO_SCORE.get(tier, 50),
            "score_breakdown": {
                "placeholder": True,
                "tier": tier,
                "reasons": [f"Säljarens bedömning: {p.get('salesperson_rationale','(ingen)')[:120]}"],
                "dimensions": {},
                "source": "seed_demo_placeholder",
            },
            "description": p.get("salesperson_rationale"),
            "source": p.get("sources", ["unknown"])[0] if p.get("sources") else "unknown",
            "category": "salesperson-input",
            "signals_at_capture": p["signals_at_capture"],
            "notes": p.get("notes_for_eval"),
        })
    return out


def main():
    fixtures = load_fixture_companies()
    prospects = load_prospects_seed()
    all_rows = fixtures + prospects
    print(f"Loaded: {len(fixtures)} fixtures + {len(prospects)} prospects = {len(all_rows)} companies")

    conn = pymysql.connect(
        host="127.0.0.1", port=3309, user="ravema", password="ravema_dev_local",
        database="ravema_lis", autocommit=False,
    )
    cur = conn.cursor()

    # Wipe demo data (idempotent)
    cur.execute("DELETE FROM signals")
    cur.execute("DELETE FROM companies WHERE source IN ('icp-md-anchors','nejra-email-2026-05-20','klas-excel-2026-05-20','unknown') OR category IN ('anchor','salesperson-input')")
    conn.commit()

    inserted = 0
    sig_inserted = 0
    for row in all_rows:
        cur.execute(
            """INSERT INTO companies
               (name, country, city, icpSegment, industry, focus,
                scoreTotal, scoreBreakdown, description, source, category,
                status, notes, scoredAt)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                       'new', %s, NOW())""",
            (
                row["name"], row["country"], row["city"], row["icp_segment"],
                row["industry"], row["focus"], row["score_total"],
                json.dumps(row["score_breakdown"], ensure_ascii=False),
                row["description"], row["source"], row["category"], row["notes"],
            ),
        )
        cid = cur.lastrowid
        inserted += 1

        for sig in row["signals_at_capture"]:
            sig_type, source = classify_signal(sig.get("type", ""))
            detail = sig.get("detail", "")
            cur.execute(
                """INSERT INTO signals
                   (companyId, signalType, source, title, payload, pointsAwarded)
                   VALUES (%s, %s, %s, %s, %s, %s)""",
                (
                    cid, sig_type, source,
                    f"{sig.get('type','')}: {detail}"[:500],
                    json.dumps(sig, ensure_ascii=False),
                    {"AAA": 25, "AA": 18, "A": 10, "B": 5, "C": 2}.get(row["focus"], 5),
                ),
            )
            sig_inserted += 1

    conn.commit()
    print(f"Inserted: {inserted} companies, {sig_inserted} signals")

    cur.execute("SELECT focus, COUNT(*) FROM companies GROUP BY focus ORDER BY FIELD(focus,'AAA','AA','A','B','C')")
    print("Tier distribution:")
    for tier, n in cur.fetchall():
        print(f"  {tier}: {n}")

    cur.execute("SELECT icpSegment, COUNT(*) FROM companies WHERE icpSegment IS NOT NULL GROUP BY icpSegment ORDER BY 2 DESC")
    print("Segment distribution:")
    for seg, n in cur.fetchall():
        print(f"  {seg}: {n}")

    conn.close()


if __name__ == "__main__":
    main()
