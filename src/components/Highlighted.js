// The database wraps matched search words in [[H]] ... [[/H]] markers
// instead of real HTML (see build_prefix_tsquery / ts_headline usage in
// schema.md), so we never have to trust/render raw HTML from the
// database — safer than using dangerouslySetInnerHTML. This component
// turns those markers into real <mark> highlight elements. Shared between
// the search result snippets and the full section text view, since both
// need the exact same marker-parsing logic.
export function Highlighted({ text }) {
  if (!text) return null;
  // Splitting on both marker patterns at once leaves us with a list where
  // every other piece was inside a highlight marker, e.g. splitting
  // "the [[H]]privacy[[/H]] rule" gives ["the ", "privacy", " rule"]. If
  // there were no markers at all (nothing matched, or no search was
  // active), this just gives back the whole text as a single piece.
  const parts = text.split(/\[\[H\]\]|\[\[\/H\]\]/);
  return parts.map((part, index) =>
    // Odd positions (1, 3, 5, ...) were between a start and end marker, so
    // they're the actual matched words — wrap those in <mark> to highlight
    // them. Even positions are just plain surrounding text.
    index % 2 === 1 ? (
      <mark key={index}>{part}</mark>
    ) : (
      <span key={index}>{part}</span>
    )
  );
}
