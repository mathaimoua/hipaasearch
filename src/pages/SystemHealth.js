// A small admin page showing self-reported Postgres stats: database size,
// active connections, cache hit ratio, content table row counts, and the
// slowest queries this app has run. See useSystemHealth.js for how the
// numbers are fetched, and get_system_health()/get_slow_queries() in
// schema.md for where they actually come from.
//
// This does NOT show uptime — a database can't reliably report on its own
// downtime while it's down. That lives in Supabase's own dashboard
// instead (see the README's Monitoring section for exactly where).

import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSystemHealth } from '../hooks/useSystemHealth';
import './SystemHealth.css';

// Turns a raw byte count (e.g. 8425984) into a friendlier "8.0 MB".
function formatBytes(bytes) {
  if (bytes == null) return '—';
  const megabytes = bytes / (1024 * 1024);
  return `${megabytes.toFixed(1)} MB`;
}

// Turns a 0-1 fraction (e.g. 0.987) into a percentage string ("98.7%").
function formatPercent(fraction) {
  if (fraction == null) return '—';
  return `${(fraction * 100).toFixed(1)}%`;
}

export default function SystemHealth() {
  const { user } = useAuth();
  const { health, slowQueries, loading } = useSystemHealth();

  return (
    <div className="health-page">
      <header className="health-header">
        <Link to="/" className="health-back">
          ← Back to search
        </Link>
        <h1 className="health-title">System Health</h1>
      </header>

      {/* Every account is an admin by default today (see schema.md's
          `users` table), but this check is here so nothing extra needs to
          change here if that ever stops being true. */}
      {user?.role !== 'admin' ? (
        <p className="health-status">You don't have access to this page.</p>
      ) : loading ? (
        <p className="health-status">Loading…</p>
      ) : !health ? (
        <p className="health-status">
          Error loading system health.
        </p>
      ) : (
        <>
          <div className="health-stats">
            <div className="health-stat">
              <p className="health-stat-label">Database size</p>
              <p className="health-stat-value">{formatBytes(health.database_size_bytes)}</p>
            </div>
            <div className="health-stat">
              <p className="health-stat-label">Active connections</p>
              <p className="health-stat-value">{health.active_connections}</p>
            </div>
            <div className="health-stat">
              <p className="health-stat-label">Cache hit ratio</p>
              <p className="health-stat-value">{formatPercent(health.cache_hit_ratio)}</p>
            </div>
            <div className="health-stat">
              <p className="health-stat-label">Regulation sections</p>
              <p className="health-stat-value">{health.hipaa_sections_count}</p>
            </div>
            <div className="health-stat">
              <p className="health-stat-label">Defined terms</p>
              <p className="health-stat-value">{health.hipaa_definitions_count}</p>
            </div>
          </div>

          <h2 className="health-subheading">Slowest queries</h2>
          {slowQueries.length === 0 ? (
            <p className="health-status">
              No query stats yet — has the pg_stat_statements extension been
              enabled?
            </p>
          ) : (
            <table className="health-table">
              <thead>
                <tr>
                  <th>Query</th>
                  <th>Calls</th>
                  <th>Avg time (ms)</th>
                </tr>
              </thead>
              <tbody>
                {slowQueries.map((row, index) => (
                  <tr key={index}>
                    <td className="health-table-query">{row.query}</td>
                    <td>{row.calls}</td>
                    <td>{row.mean_exec_time.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
}
