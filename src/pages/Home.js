// This is the main page, shown once someone is signed in: a Google-style
// search box for HIPAA regulations and defined terms. As the visitor
// types, matching results appear automatically — no need to press Enter or
// click a search button.

// useState: remember a value (what's typed in the box) and re-draw when it
// changes.
import { useState } from 'react';
// Our helper for reading the current login info and signing out.
import { useAuth } from '../context/AuthContext';
// Our custom hook that does the actual searching (see useHipaaSearch.js).
import { useHipaaSearch } from '../hooks/useHipaaSearch';
// The styling for this page.
import './Home.css';

// The database wraps matched words in a snippet with [[H]] ... [[/H]]
// markers instead of real HTML (see search_sections in schema.md) so we
// never have to trust/render raw HTML from the database — safer than using
// dangerouslySetInnerHTML. This small helper turns those markers into real
// <mark> highlight elements.
function Highlighted({ text }) {
  if (!text) return null;
  // Splitting on both marker patterns at once leaves us with a list where
  // every other piece was inside a highlight marker, e.g. splitting
  // "the [[H]]privacy[[/H]] rule" gives ["the ", "privacy", " rule"].
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

export default function Home() {
  // Who's signed in, and the function to sign out.
  const { user, signOut } = useAuth();
  // What the visitor has typed into the search box so far.
  const [query, setQuery] = useState('');
  // Ask our search hook for whatever matches the current query.
  const { definition, sections, loading } = useHipaaSearch(query);

  // Whether the visitor has typed anything at all — used to decide whether
  // to show the results area and to shrink the big centered heading down
  // to a smaller top bar (like Google does once you start searching).
  const hasQuery = query.trim().length > 0;

  return (
    <div className="search-page">
      {/* A small bar in the top-right corner showing who's signed in, with
          a sign-out button — kept out of the way so the search box stays
          the main focus of the page. */}
      <header className="search-topbar">
        <span className="search-topbar-user">
          {user?.username} ({user?.role})
        </span>
        <button className="search-signout" onClick={signOut}>
          Sign out
        </button>
      </header>

      {/* The big heading and search box. It gets a "compact" class once
          the visitor starts typing, which the CSS uses to shrink the
          spacing so results have room below. */}
      <div className={`search-hero ${hasQuery ? 'search-hero--compact' : ''}`}>
        <h1 className="search-title">HIPAA Search</h1>
        <input
          className="search-input"
          type="text"
          placeholder="Search HIPAA regulations and definitions…"
          // The box always shows whatever is currently stored in "query".
          value={query}
          // Every time the visitor types, update "query" — which triggers
          // useHipaaSearch to search again automatically.
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
      </div>

      {/* Only show the results area once the visitor has actually typed
          something. */}
      {hasQuery && (
        <div className="search-results">
          {loading && <p className="search-status">Searching…</p>}

          {/* If the typed text exactly matches a defined term, show its
              definition first, above the regulation results. */}
          {definition && (
            <div className="search-definition">
              <p className="search-definition-label">Definition:</p>
              <p className="search-definition-term">{definition.term}</p>
              <p className="search-definition-body">{definition.definition}</p>
              <p className="search-citation">{definition.citation}</p>
            </div>
          )}

          {/* If we're done searching and found neither a definition nor
              any sections, let the visitor know instead of showing a
              blank page. */}
          {!loading && !definition && sections.length === 0 && (
            <p className="search-status">No results found.</p>
          )}

          {/* The regulation sections, already sorted best-match-first by
              the database. */}
          <ul className="search-result-list">
            {sections.map((section) => (
              <li key={section.id} className="search-result">
                <p className="search-result-heading">{section.heading}</p>
                <p className="search-result-snippet">
                  <Highlighted text={section.snippet} />
                </p>
                <p className="search-citation">{section.citation}</p>
                {section.source_url && (
                  <a href={section.source_url} target="_blank" rel="noopener noreferrer">
                    View source
                  </a>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
