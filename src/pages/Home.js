// This is the main page, shown once someone is signed in. It has two ways
// to find regulation text:
// 1. Type in the Google-style search box for ranked results as you type.
// 2. Browse the left sidebar, which lists every Part 164 section, and
//    click one to read its full text.
// Clicking a section, whether from the sidebar or from a search result,
// opens its full text in place of whatever was showing, without touching
// the search box — so closing that full-text view returns to exactly
// where the visitor was (the search results, or the empty homepage).
// Typing in the search box is the only thing that closes a full-text view
// automatically, since a fresh search should always take over.

// useState: remember a value and re-draw when it changes.
import { useState } from 'react';
// Our helper for reading the current login info and signing out.
import { useAuth } from '../context/AuthContext';
// Our custom hook that does the actual searching (see useHipaaSearch.js).
import { useHipaaSearch } from '../hooks/useHipaaSearch';
// Our custom hook that finds out when the regulation data was last
// refreshed (see useDataFreshness.js).
import { useDataFreshness } from '../hooks/useDataFreshness';
// The sidebar listing every section, and the full-text detail view shown
// when one is clicked.
import { SectionSidebar } from '../components/SectionSidebar';
import { SectionDetail } from '../components/SectionDetail';
// Turns [[H]]...[[/H]] markers from the database into real highlighted
// <mark> elements — shared with SectionDetail so the same search terms
// stay highlighted whether you're looking at a snippet or the full text.
import { Highlighted } from '../components/Highlighted';
// The styling for this page.
import './Home.css';

export default function Home() {
  // Who's signed in, and the function to sign out.
  const { user, signOut } = useAuth();
  // What the visitor has typed into the search box so far.
  const [query, setQuery] = useState('');
  // Which sidebar section (if any) is currently open for reading, by id.
  const [selectedSectionId, setSelectedSectionId] = useState(null);
  // Ask our search hook for whatever matches the current query.
  const { definition, sections, loading } = useHipaaSearch(query);
  // The date/time the regulation data was last refreshed, or null until
  // we've looked it up.
  const dataUpdatedAt = useDataFreshness();

  // Whether the visitor has typed anything at all.
  const hasQuery = query.trim().length > 0;
  // Whether we should be showing search results or a section's full text
  // in the main area at all, instead of the big empty "home" state.
  const showContent = hasQuery || Boolean(selectedSectionId);

  // Runs when the visitor types in the search box. Typing should always
  // win over a section that was being read, so clear that selection out.
  const handleQueryChange = (event) => {
    setQuery(event.target.value);
    setSelectedSectionId(null);
  };

  // Runs when the visitor clicks a section — whether that's in the
  // sidebar, or in the search results list. Either way, just open that
  // section's full text and leave the search box exactly as it was, so
  // closing the detail view (see SectionDetail's onClose below) returns to
  // wherever the visitor was before, instead of losing whatever they'd
  // typed.
  const handleSelectSectionId = (id) => {
    setSelectedSectionId(id);
  };

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

      {/* Everything below the top bar is a sidebar on the left and the
          main content on the right, side by side. */}
      <div className="search-body">
        <SectionSidebar selectedId={selectedSectionId} onSelect={handleSelectSectionId} />

        <div className="search-main">
          {/* The big heading and search box. It gets a "compact" class
              once there's a search or an open section, which the CSS uses
              to shrink the spacing so content below has room. */}
          <div className={`search-hero ${showContent ? 'search-hero--compact' : ''}`}>
            <h1 className="search-title">HIPAA Search</h1>
            <h4 className="subheader">Powered by ecfr.gov</h4>
            <input
              className="search-input"
              type="text"
              placeholder="Search HIPAA regulations and definitions…"
              // The box always shows whatever is currently stored in
              // "query".
              value={query}
              onChange={handleQueryChange}
              autoFocus
            />
          </div>

          {showContent && (
            <div className="search-results">
              {selectedSectionId ? (
                // A section is open for reading — whether that's because
                // the visitor clicked it in the sidebar or clicked a
                // search result, show its full text here instead of the
                // results list. Closing it goes back to whatever was in
                // the search box: the results list if there's still a
                // query typed, or the empty homepage if not (that's why
                // this one "onClose" works for both cases).
                <SectionDetail
                  sectionId={selectedSectionId}
                  query={query}
                  onClose={() => setSelectedSectionId(null)}
                />
              ) : (
                // No section open — a search is active, so show search
                // results.
                <>
                  {loading && <p className="search-status">Searching…</p>}

                  {/* If the typed text exactly matches a defined term, show
                      its definition first, above the regulation results. */}
                  {definition && (
                    <div className="search-definition">
                      <p className="search-definition-label">Definition:</p>
                      <p className="search-definition-term">{definition.term}</p>
                      <p className="search-definition-body">{definition.definition}</p>
                      <p className="search-citation">{definition.citation}</p>
                    </div>
                  )}

                  {/* If we're done searching and found neither a
                      definition nor any sections, let the visitor know
                      instead of showing a blank page. */}
                  {!loading && !definition && sections.length === 0 && (
                    <p className="search-status">No results found.</p>
                  )}

                  {/* The regulation sections, already sorted
                      best-match-first by the database. Each one is a
                      button — clicking it swaps this list out for that
                      section's full text via handleSelectSectionId above. */}
                  <ul className="search-result-list">
                    {sections.map((section) => (
                      <li key={section.id} className="search-result">
                        <button
                          type="button"
                          className="search-result-button"
                          onClick={() => handleSelectSectionId(section.id)}
                        >
                          <p className="search-result-heading">{section.heading}</p>
                          <p className="search-result-snippet">
                            <Highlighted text={section.snippet} />
                          </p>
                          <p className="search-citation">{section.citation}</p>
                        </button>
                        {section.source_url && (
                          <a
                            href={section.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            // Without this, clicking the link would also
                            // trigger the button above it (since the click
                            // "bubbles up" to it) and open the full-text
                            // view at the same time as opening the source
                            // link — stopPropagation keeps the two clicks
                            // separate.
                            onClick={(event) => event.stopPropagation()}
                          >
                            View source
                          </a>
                        )}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* A small, unobtrusive note at the bottom of the page telling
          visitors how fresh the regulation data is, so they know it's not
          stale. Only shows once we actually have a date to display. */}
      {dataUpdatedAt && (
        <footer className="search-footer">
          <p className="search-footer-text">
            Data last updated{' '}
            {dataUpdatedAt.toLocaleDateString(undefined, {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </footer>
      )}
    </div>
  );
}
