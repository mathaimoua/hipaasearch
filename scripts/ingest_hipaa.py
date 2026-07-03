"""
ingest_hipaa.py

Fetches 45 CFR Part 164 (Security & Privacy) from the eCFR API, parses it into
one row per section, and inserts the rows into a Supabase table called
`hipaa_sections`.

Usage:
    python ingest_hipaa.py
"""

import os
import sys
import requests
import xml.etree.ElementTree as ET
from datetime import date
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
PART = 164

TITLES_ENDPOINT = "https://www.ecfr.gov/api/versioner/v1/titles.json"

SOURCE_URL_TEMPLATE = (
    "https://www.ecfr.gov/current/title-45/subtitle-A/subchapter-C/part-164/section-{section}"
)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


# ---------------------------------------------------------------------------
# Fetch
# ---------------------------------------------------------------------------

def get_latest_date_for_title(title: int) -> str:
    """eCFR's 'full' endpoint requires a real snapshot date, not an arbitrary
    calendar date. Look up the title's up_to_date_as_of date first."""
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
    """Flatten all text inside an element (including nested tags) into one string."""
    text = "".join(elem.itertext())
    return " ".join(text.split())  # collapse whitespace/newlines


def find_current_subpart(elem_path):
    """Given a list of ancestor DIV6 (subpart) elements seen so far, return the
    most recent subpart letter, e.g. 'C' for Security."""
    for ancestor in reversed(elem_path):
        if ancestor.tag == "DIV6":
            head = ancestor.find("HEAD")
            if head is not None and head.text:
                # HEAD text looks like "Subpart C--Security Standards..."
                return head.text.split("--")[0].replace("Subpart", "").strip()
    return None


def parse_sections(xml_text: str):
    root = ET.fromstring(xml_text)
    rows = []

    # Walk the tree keeping track of ancestors so we know which Subpart (DIV6)
    # each Section (DIV8) belongs to.
    def walk(elem, ancestors):
        current_ancestors = ancestors + [elem]

        if elem.tag == "DIV8" and elem.attrib.get("TYPE") == "SECTION":
            section_number = elem.attrib.get("N", "").strip()  # e.g. "164.502"
            head_elem = elem.find("HEAD")
            heading = clean_text(head_elem) if head_elem is not None else ""
            # Strip the leading "§ 164.502" off the heading text if present
            heading = heading.split(None, 2)
            heading_clean = heading[-1] if len(heading) == 3 else clean_text(head_elem)

            body_parts = [
                clean_text(p) for p in elem.findall("P")
            ]
            body = "\n".join(body_parts).strip()

            if section_number and body:
                subpart = find_current_subpart(current_ancestors)
                rows.append({
                    "citation": f"45 CFR {section_number}",
                    "part": str(PART),
                    "subpart": subpart,
                    "section_number": section_number,
                    "heading": heading_clean,
                    "body": body,
                    "source_url": SOURCE_URL_TEMPLATE.format(section=section_number),
                })

        for child in elem:
            walk(child, current_ancestors)

    walk(root, [])
    return rows


# ---------------------------------------------------------------------------
# Load
# ---------------------------------------------------------------------------

def upsert_rows(rows):
    if not rows:
        print("No rows parsed — nothing to insert. Check the XML structure.")
        return

    print(f"Upserting {len(rows)} sections into Supabase...")
    # Batch in chunks to stay well under request size limits
    batch_size = 50
    for i in range(0, len(rows), batch_size):
        batch = rows[i:i + batch_size]
        result = supabase.table("hipaa_sections").upsert(
            batch, on_conflict="section_number"
        ).execute()
        print(f"  inserted batch {i // batch_size + 1} ({len(batch)} rows)")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    snapshot_date = get_latest_date_for_title(TITLE)
    xml_text = fetch_ecfr_xml(snapshot_date)
    rows = parse_sections(xml_text)
    print(f"Parsed {len(rows)} sections from Part {PART}.")
    if rows:
        print("Sample row:", rows[0])
    upsert_rows(rows)
    print("Done.")