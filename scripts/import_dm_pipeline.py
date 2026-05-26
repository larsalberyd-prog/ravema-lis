"""Importerar DM-pipeline-resultat från stack-sessionens JSON-output.

Förväntad input: en JSON enligt LOCKED-schema (se docs/dm-pipeline/README.md i
stack-repot). Top-level har `companies: CompanyDM[]`, varje med 4 DMs i rollerna
CEO/COO/FACTORY_MANAGER/TECH.

Mapping till vår client/src/data/companies.json:
- Match på companyId (kebab-case). Skapar entry om saknas (Rototilt, Kockum Sonics).
- DM:erna mappas till vår DecisionMaker-typ (role enum, priority).
- PII-filtrering: behåller bara work-email, telefon (E.164), titel, LinkedIn.
  Filtrerar bort personnummer (\\b\\d{6}[-\\s]?\\d{4}\\b) och bostadsadress
  (om providern råkat returnera).

Kör:
    python3 scripts/import_dm_pipeline.py <path-to-results.json>
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path("/home/lab/workspace/Projects/Ravema LIS System ")
COMPANIES_JSON = ROOT / "ravema-lis/client/src/data/companies.json"

# Alias-mapping: stack-pipeline använder ICP-seed-namn (kebab-case),
# vår companies.json kan ha annat huvudnamn. Mappa stack → vårt.
NAME_ALIASES = {
    "rz gruppen": "zampart",
    "rz-gruppen": "zampart",
}

# DM-roll-mapping: stack-schema → vår DecisionMaker.role-enum + priority
ROLE_MAP = {
    "CEO": ("Executive", "high"),
    "COO": ("Executive", "high"),
    "FACTORY_MANAGER": ("Technical", "high"),  # operativ köpare = high
    "TECH": ("Technical", "medium"),
}

# Roll-etikett som visas (för UI / brief)
ROLE_LABEL = {
    "CEO": "VD",
    "COO": "Operationschef",
    "FACTORY_MANAGER": "Fabrikschef",
    "TECH": "Teknikchef",
}

# emailVerified-mapping: stack-string → bool
VERIFIED_MAP = {"valid": True, "catchall": False, "unverified": False, None: False}

# PII-mönster att filtrera bort
PII_PATTERNS = [
    re.compile(r"\b\d{6}[-\s]?\d{4}\b"),       # personnummer
    re.compile(r"\b\d{4}\d{2}\d{2}[-\s]?\d{4}\b"),  # 12-siffrigt
]


def sanitize(text):
    """Skriv över ev. PII-strängar med [REDACTED]."""
    if not isinstance(text, str):
        return text
    for pat in PII_PATTERNS:
        text = pat.sub("[REDACTED]", text)
    return text


def find_company(companies, company_id, company_name):
    """Match på id (slug), name, aliases, eller description-aka."""
    cid = (company_id or "").lower()
    cname = (company_name or "").lower()

    # Resolv via hardcoded alias
    alias_target = NAME_ALIASES.get(cid) or NAME_ALIASES.get(cname)

    for c in companies:
        c_id = c.get("id", "").lower()
        c_name = c.get("name", "").lower()
        if alias_target and (c_id == alias_target or c_name == alias_target):
            return c
        if c_id == cid:
            return c
        if c_name == cname:
            return c
        desc = (c.get("description") or "").lower()
        if cname and f"även känt som: {cname}" in desc:
            return c
    return None


def slugify(name):
    s = name.lower().replace("&", "och").replace("/", "-")
    s = re.sub(r"[åä]", "a", s)
    s = re.sub(r"[ö]", "o", s)
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s


def map_dm(stack_dm):
    """Map stack-schema DM → vår DecisionMaker-typ."""
    role = stack_dm.get("role")
    our_role, priority = ROLE_MAP.get(role, ("Other", "medium"))
    return {
        "name": sanitize(stack_dm.get("name", "")),
        "title": sanitize(stack_dm.get("title", ROLE_LABEL.get(role, role))),
        "role": our_role,
        "email": sanitize(stack_dm.get("email")),
        "phone": sanitize(stack_dm.get("phone")),
        "linkedin": stack_dm.get("linkedin"),
        "priority": priority,
        # extra metadata för spårbarhet
        "_role_raw": role,
        "_role_label": ROLE_LABEL.get(role, role),
        "_seniority": stack_dm.get("seniority"),
        "_email_verified": VERIFIED_MAP.get(stack_dm.get("emailVerified"), False),
        "_source": stack_dm.get("source", "unknown"),
        "_confidence": stack_dm.get("confidence", "low"),
        "_discovered_at": stack_dm.get("discoveredAt"),
    }


def make_base_company(cdm):
    """Skapa ny company-entry för bolag som saknas i companies.json."""
    name = cdm["companyName"]
    return {
        "id": cdm.get("companyId") or slugify(name),
        "name": name,
        "country": "Norge" if cdm.get("country") in ("Norge", "Norway", "NO") else "Sverige",
        "city": cdm.get("city") or "",
        "segment": "SE-PRECISION",  # default — uppdateras post-ICP-DNA
        "priority": "A",  # default tills scoring körs
        "status": "new",
        "assignedTo": None,
        "deadline": None,
        "description": f"Lookalike-kandidat från DM-pipeline {cdm.get('pipelineVersion','v1')}.",
        "sowPotential": "",
        "triggers": [],
        "decisionMakers": [],
        "entryAngles": [],
        "qualifyingQuestions": [],
        "nextSteps": None,
        "notes": None,
        "lis": {
            "tier": "A",
            "scoreTotal": cdm.get("icpScore", 18),
            "scoreBreakdown": {"firmographic": 12, "capacity": 3, "signals": 0, "engagement": 0, "strategic": 3},
            "reasons": [
                f"+lookalike-kandidat från DM-pipeline (ICP tier: {cdm.get('icpTier','unknown')})",
            ],
            "overrides": [],
            "confidence": "låg",
            "signals": [],
            "district": None,
            "competitorIncumbent": None,
            "managementPriority": False,
            "rationaleKlas": "Lookalike via stack-DM-pipeline",
            "icpFlaggedBy": ["Stack DM-pipeline v1"],
            "hasBrief": False,
        },
    }


def main(json_path):
    payload = json.loads(Path(json_path).read_text())
    print(f"Pipeline version: {payload.get('pipelineVersion')}")
    print(f"Generated at:     {payload.get('generatedAt')}")
    print(f"Providers used:   {payload.get('providersUsed')}")
    print(f"Companies:        {len(payload.get('companies', []))}")
    print()

    companies = json.loads(COMPANIES_JSON.read_text())
    print(f"Befintliga companies.json: {len(companies)}")
    print()

    added = 0
    merged = 0
    dm_added = 0
    for cdm in payload.get("companies", []):
        existing = find_company(companies, cdm.get("companyId"), cdm.get("companyName"))
        if existing:
            target = existing
            merged += 1
        else:
            target = make_base_company(cdm)
            companies.append(target)
            added += 1
            print(f"  + nytt bolag: {target['name']} ({target['id']})")

        # Mappa DMs
        new_dms = [map_dm(dm) for dm in cdm.get("decisionMakers", [])]
        existing_dms = target.get("decisionMakers") or []
        # Behåll hand-curated DMs som inte krockar på namn
        existing_names = {dm.get("name", "").lower() for dm in existing_dms}
        for new_dm in new_dms:
            if new_dm["name"].lower() not in existing_names:
                existing_dms.append(new_dm)
                dm_added += 1
            else:
                # Berika existerande DM med pipeline-data
                for ex in existing_dms:
                    if ex.get("name", "").lower() == new_dm["name"].lower():
                        # bevara ev. hand-curated email/phone om pipeline-data är None
                        for k in ["email", "phone", "linkedin", "title", "_seniority", "_email_verified", "_source", "_confidence"]:
                            if new_dm.get(k) and not ex.get(k):
                                ex[k] = new_dm[k]
                        break
        target["decisionMakers"] = existing_dms

        # Pipeline-notes till företaget
        notes = cdm.get("pipelineNotes")
        if notes:
            target["notes"] = ((target.get("notes") or "") + f"\n[DM-pipeline] {notes}").strip()

    print(f"\nResultat: +{added} nya bolag, {merged} merged. {dm_added} nya DM-rader.")

    # Sanity: tier-fördelning efter import
    tier_dist = {}
    for c in companies:
        t = c.get("lis", {}).get("tier", c.get("priority", "?"))
        tier_dist[t] = tier_dist.get(t, 0) + 1
    print(f"Tier-fördelning: {dict(sorted(tier_dist.items()))}")

    COMPANIES_JSON.write_text(json.dumps(companies, ensure_ascii=False, indent=2) + "\n")
    print(f"→ skrivet: {COMPANIES_JSON}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 import_dm_pipeline.py <path-to-results.json>")
        sys.exit(1)
    main(sys.argv[1])
