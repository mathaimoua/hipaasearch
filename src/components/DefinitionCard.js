// A small card showing one defined term and its definition. Reused in two
// places: under the search bar when a typed word exactly matches a term,
// and when a term is clicked directly in the sidebar's "Terms" tab — both
// cases show the exact same layout.

// definition: { term, definition, citation, source_url }.
export function DefinitionCard({ definition }) {
  return (
    <div className="search-definition">
      <p className="search-definition-label">Definition:</p>
      <p className="search-definition-term">{definition.term}</p>
      <p className="search-definition-body">{definition.definition}</p>
      <p className="search-citation">{definition.citation}</p>
      {definition.source_url && (
        <a href={definition.source_url} target="_blank" rel="noopener noreferrer">
          View source
        </a>
      )}
    </div>
  );
}
