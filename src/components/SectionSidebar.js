// The left sidebar listing every Part 164 regulation section, ordered by
// section number, for browsing. Clicking one selects it (Home.js then
// shows that section's full text in the main area).

// Our hook that fetches the section_number/heading list.
import { useSectionList } from '../hooks/useSectionList';
import './SectionSidebar.css';

// selectedId: which section (if any) is currently open, so we can
// highlight it in the list.
// onSelect: a function to call with a section's id when it's clicked.
export function SectionSidebar({ selectedId, onSelect }) {
  const { sections, loading } = useSectionList();

  return (
    <nav className="section-sidebar">
      <p className="section-sidebar-title">Part 164 Sections</p>

      {loading && <p className="section-sidebar-status">Loading…</p>}

      <ul className="section-sidebar-list">
        {sections.map((section) => (
          <li key={section.id}>
            <button
              type="button"
              // Highlight whichever section is currently open, so it's
              // clear which one the main area is showing.
              className={
                'section-sidebar-item' +
                (section.id === selectedId ? ' section-sidebar-item--active' : '')
              }
              onClick={() => onSelect(section.id)}
              // The CSS below cuts long lines off with "…", so the full
              // text still shows up as a native tooltip on hover/long-press.
              title={`${section.section_number} - ${section.heading}`}
            >
              {section.section_number} - {section.heading}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
