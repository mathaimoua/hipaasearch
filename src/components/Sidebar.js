// The left sidebar. It has two tabs: "Sections" (every Part 164 section,
// ordered by section number — the default view) and "Terms" (every
// defined term, alphabetical). Clicking either kind of entry opens it in
// the main area, via the onSelect callbacks passed in from Home.js.

// useState: remember which tab is active, and re-draw when it changes.
import { useState } from 'react';
// Our hooks that fetch the two lists shown here.
import { useSectionList } from '../hooks/useSectionList';
import { useDefinitionList } from '../hooks/useDefinitionList';
import './Sidebar.css';

// selectedSectionId / onSelectSection: which section (if any) is open, and
// what to call when one is clicked.
// selectedTermId / onSelectTerm: same idea, for terms.
export function Sidebar({ selectedSectionId, onSelectSection, selectedTermId, onSelectTerm }) {
  // Which tab is showing right now — "sections" is the default per the
  // requirements.
  const [activeTab, setActiveTab] = useState('sections');

  const { sections, loading: sectionsLoading } = useSectionList();
  const { definitions, loading: definitionsLoading } = useDefinitionList();

  return (
    <nav className="sidebar">
      {/* The tab switcher at the top of the sidebar. */}
      <div className="sidebar-tabs">
        <button
          type="button"
          className={'sidebar-tab' + (activeTab === 'sections' ? ' sidebar-tab--active' : '')}
          onClick={() => setActiveTab('sections')}
        >
          Sections
        </button>
        <button
          type="button"
          className={'sidebar-tab' + (activeTab === 'terms' ? ' sidebar-tab--active' : '')}
          onClick={() => setActiveTab('terms')}
        >
          Terms
        </button>
      </div>

      {activeTab === 'sections' ? (
        <>
          {sectionsLoading && <p className="sidebar-status">Loading…</p>}
          <ul className="sidebar-list">
            {sections.map((section) => (
              <li key={section.id}>
                <button
                  type="button"
                  // Highlight whichever section is currently open.
                  className={
                    'sidebar-item' +
                    (section.id === selectedSectionId ? ' sidebar-item--active' : '')
                  }
                  onClick={() => onSelectSection(section.id)}
                  // The CSS cuts long lines off with "…", so the full text
                  // still shows up as a native tooltip on hover/long-press.
                  title={`${section.section_number} - ${section.heading}`}
                >
                  {section.section_number} - {section.heading}
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <>
          {definitionsLoading && <p className="sidebar-status">Loading…</p>}
          <ul className="sidebar-list">
            {definitions.map((definition) => (
              <li key={definition.id}>
                <button
                  type="button"
                  // Highlight whichever term is currently open.
                  className={
                    'sidebar-item' +
                    (definition.id === selectedTermId ? ' sidebar-item--active' : '')
                  }
                  // The sidebar already has the whole definition in memory
                  // (unlike sections, which only fetch their full body on
                  // click), so just hand the whole thing up instead of
                  // making Home.js fetch it again by id.
                  onClick={() => onSelectTerm(definition)}
                  title={definition.term}
                >
                  {definition.term}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </nav>
  );
}
