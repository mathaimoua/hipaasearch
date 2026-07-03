// Renders a section's full body text with two things layered on top of the
// plain words:
// 1. Search-highlighted words, the same [[H]]...[[/H]] markers Highlighted
//    (see Highlighted.js) turns into <mark> elements — reused here so a
//    search that's still active stays visible in the full text too.
// 2. Any defined term found in the text becomes a clickable button that
//    opens that term's definition (via onTermClick), so a reader can jump
//    straight to what a term means without leaving the page.
// Both are handled in one component because they can overlap — a
// highlighted word might also be part of a clickable term.

import { useMemo } from 'react';

// Makes a term safe to drop into a regular expression, so punctuation in a
// term like "45 CFR 160.103" (a period, in this case) is treated as a
// literal character instead of regex syntax.
function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// text: the body string, possibly containing [[H]]/[[/H]] markers.
// terms: the full list of defined terms, [{ id, term, definition, ... }].
// onTermClick: called with a term's full definition object when clicked.
export function TermLinkedText({ text, terms, onTermClick }) {
  // Build the term-matching pieces once per "terms" list (not on every
  // keystroke/re-draw) since scanning the whole definitions list is a bit
  // of work we don't need to redo constantly.
  const { termMap, termRegex } = useMemo(() => {
    // A quick way to go from "the exact words that were found in the
    // text" back to "which definition is that" (case doesn't matter).
    const map = new Map();
    for (const definition of terms) {
      map.set(definition.term.toLowerCase(), definition);
    }

    // Longest terms first, so "covered entity" gets matched as a whole
    // phrase instead of just matching the shorter "entity" partway
    // through it (regex alternation tries each option in the order
    // written, so the first one that fits wins).
    const sortedTerms = [...terms].map((d) => d.term).sort((a, b) => b.length - a.length);
    const pattern = sortedTerms.map(escapeRegExp).join('|');
    // \b...\b means "only match whole words/phrases", so a term like
    // "access" doesn't light up inside an unrelated word like
    // "accessibility". No terms yet (still loading) — no regex needed.
    const regex = pattern ? new RegExp(`\\b(${pattern})\\b`, 'gi') : null;

    return { termMap: map, termRegex: regex };
  }, [terms]);

  if (!text) return null;

  // First split on the highlight markers, exactly like Highlighted does —
  // odd positions were inside a [[H]]...[[/H]] pair.
  const markerParts = text.split(/\[\[H\]\]|\[\[\/H\]\]/);

  return markerParts.map((part, partIndex) => {
    const withTermLinks = linkifyTerms(part, termRegex, termMap, onTermClick, partIndex);
    return partIndex % 2 === 1 ? (
      <mark key={partIndex}>{withTermLinks}</mark>
    ) : (
      <span key={partIndex}>{withTermLinks}</span>
    );
  });
}

// Scans one chunk of plain text for defined terms and returns an array
// mixing plain strings with clickable <button> elements in their place.
function linkifyTerms(text, termRegex, termMap, onTermClick, keyPrefix) {
  // Nothing to match against yet (terms haven't loaded), or nothing
  // matched — just show the text as-is.
  if (!termRegex) return text;

  const nodes = [];
  let lastIndex = 0;
  let matchCount = 0;
  // This regex object gets reused across every chunk of text in the
  // section, so its internal search position has to be reset each time —
  // otherwise the second chunk would pick up wherever the first one left
  // off instead of starting fresh.
  termRegex.lastIndex = 0;

  let match;
  while ((match = termRegex.exec(text)) !== null) {
    const matchedText = match[0];
    const start = match.index;

    // Whatever plain text came before this match.
    if (start > lastIndex) {
      nodes.push(text.slice(lastIndex, start));
    }

    // Look up the definition using the matched word's own lowercase form,
    // so "Covered Entity" in the document still finds the "covered
    // entity" entry regardless of how it was capitalized in either place.
    const definition = termMap.get(matchedText.toLowerCase());
    nodes.push(
      <button
        type="button"
        key={`${keyPrefix}-term-${matchCount}`}
        className="term-link"
        onClick={() => onTermClick(definition)}
      >
        {matchedText}
      </button>
    );

    lastIndex = start + matchedText.length;
    matchCount += 1;
  }

  // Whatever plain text is left after the last match.
  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}
