"""
ingest_definitions.py

Fetches 45 CFR 160.103 (Definitions) from the eCFR API, splits it into
individual term -> definition pairs, and upserts them into a Supabase table
called `hipaa_definitions`.

This is separate from ingest_hipaa.py because the parsing shape is different:
one row per defined TERM here, vs. one row per SECTION there.

Usage:
    python ingest_definitions.py
"""

import os
import re
import sys
import requests
import xml.etree.ElementTree as ET
from dotenv import load_dotenv
from supabase import create_client, Client

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

load_dotenv()

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    sys.exit("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in scripts/.env")

TITLE = 45
PART = 160
TARGET_SECTION = "160.103"  # Definitions

TITLES_ENDPOINT = "https://www.ecfr.gov/api/versioner/v1/titles.json"
SOURCE_URL = (
    "https://www.ecfr.gov/current/title-45/subtitle-A/subchapter-C/part-160/section-160.103"
)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


# ---------------------------------------------------------------------------
# Fetch
# ---------------------------------------------------------------------------

def get_latest_date_for_title(title: int) -> str:
    print(f"Looking up latest available date for Title {title} ...")
    resp = requests.get(TITLES_ENDPOINT, timeout=30)
    resp.raise_for_status()
    data = resp.json()
    for t in data.get("titles", []):
        if t.get("number") == title:
            latest = t.get("up_to_date_as_of") or t.get("latest_issue_date")
            print(f"  using date: {latest}")
            return latest
    sys.exit(f"Could not find Title {title} in eCFR titles list.")


def fetch_ecfr_xml(snapshot_date: str) -> str:
    url = f"https://www.ecfr.gov/api/versioner/v1/full/{snapshot_date}/title-{TITLE}.xml"
    params = {"part": PART}
    print(f"Fetching {url} with params {params} ...")
    resp = requests.get(url, params=params, timeout=60)
    resp.raise_for_status()
    return resp.text


# ---------------------------------------------------------------------------
# Parse
# ---------------------------------------------------------------------------

def clean_text(elem: ET.Element) -> str:
    text = "".join(elem.itertext())
    return " ".join(text.split())


def find_definitions_section(root: ET.Element):
    """Walk the tree to find the DIV8 SECTION matching TARGET_SECTION."""
    for elem in root.iter("DIV8"):
        if elem.attrib.get("TYPE") == "SECTION" and elem.attrib.get("N", "").strip() == TARGET_SECTION:
            return elem
    return None


def parse_definitions(xml_text: str):
    root = ET.fromstring(xml_text)
    section = find_definitions_section(root)
    if section is None:
        print(f"Could not find section {TARGET_SECTION} in the fetched XML.")
        return []

    rows = []

    # eCFR definitions sections typically render each defined term in italics
    # (an <I> tag) as the first thing in its <P>, followed by "means ...".
    # e.g. <P><I>Access</I> means the ability or means necessary to read...</P>
    for p in section.findall("P"):
        italic = p.find("I")
        full_text = clean_text(p)

        term = None
        definition = full_text

        if italic is not None and italic.text:
            term = clean_text(italic).strip().rstrip(".")
            # Remove the term from the front of the full text, then strip a
            # leading "means" if present.
            remainder = full_text
            if remainder.startswith(term):
                remainder = remainder[len(term):].strip()
            remainder = re.sub(r"^means\b:?\s*", "", remainder, flags=re.IGNORECASE)
            definition = remainder
        else:
            # Fallback: try to split on the first " means " occurrence,
            # e.g. "Business associate means a person who..."
            match = re.match(r"^([A-Z][A-Za-z0-9 ,'\-/]{1,60}?) means\b:?\s*(.*)$", full_text)
            if match:
                term = match.group(1).strip()
                definition = match.group(2).strip()

        if term and definition:
            rows.append({
                "term": term,
                "definition": definition,
                "citation": f"45 CFR {TARGET_SECTION}",
                "source_url": SOURCE_URL,
            })

    return rows


# ---------------------------------------------------------------------------
# Load
# ---------------------------------------------------------------------------

def upsert_rows(rows):
    if not rows:
        print("No definitions parsed — nothing to insert. Check the XML structure.")
        return

    # Dedupe by term (case-insensitive), keeping the first occurrence.
    # ON CONFLICT DO UPDATE fails if the same key appears twice in one batch,
    # which can happen if a term is referenced/defined more than once in the
    # source text.
    seen = set()
    deduped = []
    dropped = []
    for row in rows:
        key = row["term"].strip().lower()
        if key in seen:
            dropped.append(row["term"])
            continue
        seen.add(key)
        deduped.append(row)

    if dropped:
        print(f"Dropped {len(dropped)} duplicate term(s): {dropped}")

    print(f"Upserting {len(deduped)} definitions into Supabase...")
    batch_size = 50
    for i in range(0, len(deduped), batch_size):
        batch = deduped[i:i + batch_size]
        supabase.table("hipaa_definitions").upsert(
            batch, on_conflict="term"
        ).execute()
        print(f"  inserted batch {i // batch_size + 1} ({len(batch)} rows)")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    snapshot_date = get_latest_date_for_title(TITLE)
    xml_text = fetch_ecfr_xml(snapshot_date)
    rows = parse_definitions(xml_text)
    print(f"Parsed {len(rows)} definitions from {TARGET_SECTION}.")
    if rows:
        print("Sample row:", rows[0])
    upsert_rows(rows)
    print("Done.")