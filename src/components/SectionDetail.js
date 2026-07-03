// Shows the full text of one regulation section — this is what appears in
// the main area when a visitor clicks a section in the sidebar or a search
// result, instead of the results list.

// Our hook that fetches the selected section's full text.
import { useSectionDetail } from '../hooks/useSectionDetail';
// Turns [[H]]...[[/H]] markers into highlighted <mark> elements, so
// whatever's in the search box stays highlighted in the full text too.
import { Highlighted } from './Highlighted';

// sectionId: which section to load and show.
// query: whatever's currently typed in the search box, if anything — used
// to keep the same words highlighted here that were highlighted in the
// results list.
// onClose: a function to call to leave the detail view (e.g. clicking
// "Back to search").
export function SectionDetail({ sectionId, query, onClose }) {
  const { section, loading } = useSectionDetail(sectionId, query);

  if (loading) {
    return <p className="search-status">Loading…</p>;
  }

  if (!section) {
    return <p className="search-status">Section not found.</p>;
  }

  return (
    <div className="section-detail">
      <button type="button" className="section-detail-back" onClick={onClose}>
        ← Back to search
      </button>
      <p className="search-citation">{section.citation}</p>
      <h2 className="section-detail-heading">{section.heading}</h2>
      {section.source_url && (
        <a
          className="section-detail-source"
          href={section.source_url}
          target="_blank"
          rel="noopener noreferrer"
        >
          View source
        </a>
      )}
      {/* white-space: pre-line (see Home.css) keeps the paragraph breaks
          already present in the stored text, and Highlighted wraps any
          matching search words in <mark> the same way the results list
          does. */}
      <p className="section-detail-body">
        <Highlighted text={section.body} />
      </p>
    </div>
  );
}
