// This is the main page, shown once someone is signed in. It has two ways
// to find regulation text:
// 1. Type in the Google-style search box for ranked results as you type.
// 2. Browse the left sidebar, which has two tabs: "Sections" (every Part
//    164 section, the default view) and "Terms" (every defined term,
//    alphabetical). Clicking either opens it.
// Only one thing shows in the main area at a time: search results, an open
// section's full text, or an open term's definition. Opening a section or
// term from the sidebar/results leaves the search box exactly as it was,
// so closing it returns to wherever the visitor was. Typing in the search
// box is the only thing that closes an open section/term automatically,
// since a fresh search should always take over.

// useState: remember a value and re-draw when it changes.
import { useState } from 'react';
// Our helper for reading the current login info and signing out.
import { useAuth } from '../context/AuthContext';
// Our custom hook that does the actual searching (see useHipaaSearch.js).
import { useHipaaSearch } from '../hooks/useHipaaSearch';
// Our custom hook that finds out when the regulation data was last
// refreshed (see useDataFreshness.js).
import { useDataFreshness } from '../hooks/useDataFreshness';
// Our custom hook that fetches every defined term. Fetched once up here
// (rather than inside Sidebar) since SectionDetail needs the same list too,
// to turn defined terms found inside a section's body into clickable
// links — fetching it in one shared place avoids downloading it twice.
import { useDefinitionList } from '../hooks/useDefinitionList';
// The sidebar (Sections/Terms tabs), the full-text detail view shown when
// a section is opened, and the card shown when a term is opened.
import { Sidebar } from '../components/Sidebar';
import { SectionDetail } from '../components/SectionDetail';
import { DefinitionCard } from '../components/DefinitionCard';
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
  // Which term (if any) is currently open, as the whole
  // { id, term, definition, citation, source_url } object — the sidebar
  // already has this in memory, so there's no need to fetch it again.
  const [selectedTerm, setSelectedTerm] = useState(null);
  // Ask our search hook for whatever matches the current query.
  const { definition, sections, loading } = useHipaaSearch(query);
  // The date/time the regulation data was last refreshed, or null until
  // we've looked it up.
  const dataUpdatedAt = useDataFreshness();
  // Every defined term, for the sidebar's "Terms" tab and for turning
  // terms found inside a section's body into clickable links.
  const { definitions, loading: definitionsLoading } = useDefinitionList();

  // Whether the visitor has typed anything at all.
  const hasQuery = query.trim().length > 0;
  // Whether we should be showing search results, a section's full text, or
  // a term's definition in the main area at all, instead of the big empty
  // "home" state.
  const showContent = hasQuery || Boolean(selectedSectionId) || Boolean(selectedTerm);

  // Runs when the visitor types in the search box. Typing should always
  // win over a section/term that was being read, so clear those out.
  const handleQueryChange = (event) => {
    setQuery(event.target.value);
    setSelectedSectionId(null);
    setSelectedTerm(null);
  };

  // Runs when the visitor clicks a section — whether that's in the
  // sidebar, or in the search results list. Either way, just open that
  // section's full text and leave the search box exactly as it was, so
  // closing the detail view (see SectionDetail's onClose below) returns to
  // wherever the visitor was before, instead of losing whatever they'd
  // typed. Opening a section also closes any term that was open, since
  // only one of the two can be shown at once.
  const handleSelectSectionId = (id) => {
    setSelectedSectionId(id);
    setSelectedTerm(null);
  };

  // Runs when the visitor clicks a term in the sidebar's "Terms" tab.
  // Mirrors handleSelectSectionId above, just for terms instead of
  // sections: browsing a term standalone from the sidebar should replace
  // whatever section was open, so closing it goes back to search
  // results/homepage rather than some unrelated section.
  const handleSelectTerm = (term) => {
    setSelectedTerm(term);
    setSelectedSectionId(null);
  };

  // Runs when the visitor clicks a defined term found inside a section's
  // body text (see SectionDetail's onTermClick below). Unlike
  // handleSelectTerm above, this deliberately leaves selectedSectionId
  // alone — the term view is shown on top of it (see the render priority
  // below), so closing the term goes back to that same section instead of
  // to search results.
  const handleSelectTermFromBody = (term) => {
    setSelectedTerm(term);
  };

  // Runs when the visitor clicks the "Clear" text inside the search box.
  // Empties the box, same as if they'd deleted everything themselves.
  const handleClear = () => {
    setQuery('');
    setSelectedSectionId(null);
    setSelectedTerm(null);
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
        <Sidebar
          selectedSectionId={selectedSectionId}
          onSelectSection={handleSelectSectionId}
          selectedTermId={selectedTerm?.id}
          onSelectTerm={handleSelectTerm}
          definitions={definitions}
          definitionsLoading={definitionsLoading}
        />

        <div className="search-main">
          {/* The big heading and search box. It gets a "compact" class
              once there's a search or an open section, which the CSS uses
              to shrink the spacing so content below has room. */}
          <div className={`search-hero ${showContent ? 'search-hero--compact' : ''}`}>
            <h1 className="search-title">HIPAA Search</h1>
            <h4 className="subheader">Powered by ecfr.gov</h4>
            {/* A positioning wrapper so the "Clear" text can sit inside
                the right edge of the input, on top of it, instead of next
                to it. */}
            <div className="search-input-wrapper">
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
              {/* Only show "Clear" once there's actually something typed
                  to clear. */}
              {hasQuery && (
                <button type="button" className="search-clear" onClick={handleClear}>
                  Clear
                </button>
              )}
            </div>
          </div>

          {showContent && (
            <div className="search-results">
              {selectedTerm ? (
                // A term is open — either browsed standalone from the
                // sidebar's "Terms" tab, or clicked from inside a
                // section's body text (see SectionDetail's onTermClick).
                // This is checked before selectedSectionId below on
                // purpose: if a term was opened from within a section, the
                // section is still remembered underneath so "Back" can
                // return to it, but the term should display on top of it
                // while it's open.
                <div>
                  <button
                    type="button"
                    className="section-detail-back"
                    onClick={() => setSelectedTerm(null)}
                  >
                    ← Back
                  </button>
                  <DefinitionCard definition={selectedTerm} />
                </div>
              ) : selectedSectionId ? (
                // A section is open for reading — whether that's because
                // the visitor clicked it in the sidebar or clicked a
                // search result, show its full text here instead of the
                // results list. Closing it goes back to whatever was in
                // the search box: the results list if there's still a
                // query typed, or the empty homepage if not (that's why
                // this one "onClose" works for both cases). Any defined
                // term found in the text becomes a clickable link, via
                // handleSelectTermFromBody.
                <SectionDetail
                  sectionId={selectedSectionId}
                  query={query}
                  terms={definitions}
                  onTermClick={handleSelectTermFromBody}
                  onClose={() => setSelectedSectionId(null)}
                />
              ) : (
                // Nothing open — a search is active, so show search
                // results.
                <>
                  {loading && <p className="search-status">Searching…</p>}

                  {/* If the typed text exactly matches a defined term, show
                      its definition first, above the regulation results. */}
                  {definition && <DefinitionCard definition={definition} />}

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
