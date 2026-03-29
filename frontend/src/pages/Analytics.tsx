import React, { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  Cell as BarCell,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import { API_BASE_URL } from '../config';
import { useAuth } from '../context/AuthContext';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Clock,
  Download,
  Loader2,
  MapPin,
  PieChart as PieChartIcon,
  RefreshCw,
  TrendingUp,
  Users,
} from 'lucide-react';
import './Analytics.css';

const ANALYTICS_QUERY_KEY = ['pins-analytics'];
const STALE_MS = 2 * 60 * 1000;

/** Same key as former Leaderboard stats query — keeps cache when switching pages. */
const LEADERBOARD_STATS_QUERY_KEY = ['leaderboard', 'stats'];
const PLATFORM_STATS_STALE_MS = 10 * 60 * 1000;

/** Must match backend GET /api/leaderboard/stats keys */
const PLATFORM_STATS_LABELS = [
  { key: 'totalUsers', label: 'Users joined', icon: 'people', color: '#6366f1' },
  { key: 'totalNgos', label: 'NGOs created', icon: 'business', color: '#10b981' },
  { key: 'totalEvents', label: 'Events created', icon: 'event', color: '#f59e0b' },
  { key: 'totalSuggestions', label: 'Suggestions made', icon: 'lightbulb', color: '#8b5cf6' },
  { key: 'totalPins', label: 'Pins reported', icon: 'push_pin', color: '#6366f1' },
  { key: 'pinsResolved', label: 'Pins resolved', icon: 'check_circle', color: '#22c55e' },
  { key: 'totalComments', label: 'Comments', icon: 'comment', color: '#3b82f6' },
  { key: 'suggestionsImplemented', label: 'Suggestions implemented', icon: 'done_all', color: '#8b5cf6' },
  { key: 'activeUsersLast7Days', label: 'Active this week', icon: 'trending_up', color: '#ec4899' },
] as const;

const TYPE_COLORS = ['#135bec', '#f59e0b', '#f43f5e', '#10b981', '#8b5cf6', '#64748b'];

export type AnalyticsProblemRow = {
  problemType: string;
  count: number;
  percentage: number;
};

export type AnalyticsRecentPin = {
  _id: string;
  problemHeading: string;
  problemType: string;
  address: string;
  severity: number;
  status: 'resolved' | 'in_progress' | 'open';
  createdAt: string;
};

export type AnalyticsPayload = {
  totalPins: number;
  resolvedCount: number;
  inProgressCount: number;
  openCount: number;
  pinsLast30Days: number;
  pinsLast7Days: number;
  avgSeverity: number;
  totalUpvotes: number;
  distinctReporters: number;
  resolutionRatePercent: number;
  byProblemType: AnalyticsProblemRow[];
  recentPins: AnalyticsRecentPin[];
};

function statusBadgeClass(status: AnalyticsRecentPin['status']) {
  if (status === 'resolved') {
    return 'analytics-badge analytics-badge--resolved';
  }
  if (status === 'in_progress') {
    return 'analytics-badge analytics-badge--progress';
  }
  return 'analytics-badge analytics-badge--open';
}

function statusLabel(status: AnalyticsRecentPin['status']) {
  if (status === 'resolved') return 'Resolved';
  if (status === 'in_progress') return 'In progress';
  return 'Open';
}

type PlatformStatsPayload = Record<(typeof PLATFORM_STATS_LABELS)[number]['key'], number>;

export default function Analytics() {
  const { getToken } = useAuth();
  const navigate = useNavigate();

  const {
    data: platformStats,
    isLoading: platformStatsLoading,
    error: platformStatsError,
  } = useQuery({
    queryKey: LEADERBOARD_STATS_QUERY_KEY,
    queryFn: async (): Promise<PlatformStatsPayload> => {
      const token = await getToken();
      const res = await fetch(`${API_BASE_URL}/api/leaderboard/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to load platform stats');
      return res.json();
    },
    staleTime: PLATFORM_STATS_STALE_MS,
  });

  const {
    data,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useQuery({
    queryKey: ANALYTICS_QUERY_KEY,
    queryFn: async (): Promise<AnalyticsPayload> => {
      const token = await getToken();
      const res = await fetch(`${API_BASE_URL}/api/pins/analytics`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to load analytics');
      }
      return res.json();
    },
    staleTime: STALE_MS,
  });

  const pieData = useMemo(() => {
    const rows = data?.byProblemType ?? [];
    return rows.map((r) => ({
      name: r.problemType,
      value: r.count,
      percentage: r.percentage,
    }));
  }, [data?.byProblemType]);

  const statusBarData = useMemo(() => {
    if (!data) return [];
    return [
      { name: 'Open', count: data.openCount, fill: '#94a3b8' },
      { name: 'In progress', count: data.inProgressCount, fill: '#135bec' },
      { name: 'Resolved', count: data.resolvedCount, fill: '#10b981' },
    ];
  }, [data]);

  const dominantType = pieData[0];
  const exportReport = useCallback(() => {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pin-it-analytics-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [data]);

  const errMsg = error instanceof Error ? error.message : '';

  return (
    <div className="analytics-page">
      <div className="analytics-inner">
        <header className="analytics-header">
          <div>
            <h1 className="analytics-title">Issue analytics overview</h1>
            <p className="analytics-subtitle">
              Community-reported civic issues: types, resolution progress, and recent activity.
            </p>
          </div>
          <div className="analytics-header-actions">
            <button
              type="button"
              className="analytics-btn analytics-btn--ghost"
              onClick={() => refetch()}
              disabled={isFetching}
              aria-busy={isFetching}
            >
              {isFetching ? (
                <Loader2 className="analytics-icon-spin" size={18} aria-hidden />
              ) : (
                <RefreshCw size={18} aria-hidden />
              )}
              Refresh
            </button>
            <button
              type="button"
              className="analytics-btn analytics-btn--primary"
              onClick={exportReport}
              disabled={!data}
            >
              <Download size={18} aria-hidden />
              Export report
            </button>
          </div>
        </header>

        <section className="analytics-platform" aria-label="Platform statistics">
          <h2 className="analytics-platform-title">Platform at a glance</h2>
          {platformStatsLoading && (
            <div className="analytics-platform-loading">
              <Loader2 className="analytics-icon-spin" size={16} aria-hidden />
              <span>Loading stats…</span>
            </div>
          )}
          {!platformStatsLoading && platformStatsError && (
            <p className="analytics-platform-error">Stats unavailable</p>
          )}
          {!platformStatsLoading && !platformStatsError && platformStats && (
            <div className="analytics-platform-grid">
              {PLATFORM_STATS_LABELS.map(({ key, label, icon, color }) => (
                <div key={key} className="analytics-platform-card">
                  <span
                    className="analytics-platform-icon material-icons-round"
                    style={{ color }}
                    aria-hidden="true"
                  >
                    {icon}
                  </span>
                  <span className="analytics-platform-value">
                    {(platformStats[key] ?? 0).toLocaleString()}
                  </span>
                  <span className="analytics-platform-label">{label}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        {isLoading && (
          <div className="analytics-loading">
            <Loader2 className="analytics-icon-spin" size={32} aria-hidden />
            <span>Loading analytics…</span>
          </div>
        )}

        {errMsg && !isLoading && (
          <div className="analytics-error" role="alert">
            {errMsg}
          </div>
        )}

        {data && !isLoading && (
          <>
            <section className="analytics-stats-grid" aria-label="Summary statistics">
              <article className="analytics-stat-card">
                <div className="analytics-stat-card-top">
                  <span className="analytics-stat-label">Total reports</span>
                  <Activity className="analytics-stat-icon text-[#135bec]" size={22} aria-hidden />
                </div>
                <p className="analytics-stat-value">{data.totalPins.toLocaleString()}</p>
                <p className="analytics-stat-hint analytics-stat-hint--muted">
                  <TrendingUp size={14} aria-hidden />
                  {data.pinsLast7Days} new in the last 7 days
                </p>
              </article>
              <article className="analytics-stat-card">
                <div className="analytics-stat-card-top">
                  <span className="analytics-stat-label">Resolved</span>
                  <CheckCircle2 className="analytics-stat-icon text-emerald-500" size={22} aria-hidden />
                </div>
                <p className="analytics-stat-value">{data.resolvedCount.toLocaleString()}</p>
                <p className="analytics-stat-hint analytics-stat-hint--success">
                  {data.resolutionRatePercent}% of all reports
                </p>
              </article>
              <article className="analytics-stat-card">
                <div className="analytics-stat-card-top">
                  <span className="analytics-stat-label">Active (open + in progress)</span>
                  <AlertTriangle className="analytics-stat-icon text-amber-500" size={22} aria-hidden />
                </div>
                <p className="analytics-stat-value">
                  {(data.openCount + data.inProgressCount).toLocaleString()}
                </p>
                <p className="analytics-stat-hint analytics-stat-hint--muted">
                  Open: {data.openCount} · In progress: {data.inProgressCount}
                </p>
              </article>
              <article className="analytics-stat-card">
                <div className="analytics-stat-card-top">
                  <span className="analytics-stat-label">Reports (30 days)</span>
                  <Clock className="analytics-stat-icon text-slate-400" size={22} aria-hidden />
                </div>
                <p className="analytics-stat-value">{data.pinsLast30Days.toLocaleString()}</p>
                <p className="analytics-stat-hint analytics-stat-hint--muted">
                  Avg. severity {data.avgSeverity}/10
                </p>
              </article>
              <article className="analytics-stat-card">
                <div className="analytics-stat-card-top">
                  <span className="analytics-stat-label">Community upvotes</span>
                  <BarChart3 className="analytics-stat-icon text-violet-500" size={22} aria-hidden />
                </div>
                <p className="analytics-stat-value">{data.totalUpvotes.toLocaleString()}</p>
                <p className="analytics-stat-hint analytics-stat-hint--muted">Across all issues</p>
              </article>
              <article className="analytics-stat-card">
                <div className="analytics-stat-card-top">
                  <span className="analytics-stat-label">Distinct reporters</span>
                  <Users className="analytics-stat-icon text-pink-500" size={22} aria-hidden />
                </div>
                <p className="analytics-stat-value">{data.distinctReporters.toLocaleString()}</p>
                <p className="analytics-stat-hint analytics-stat-hint--muted">Unique contributors</p>
              </article>
            </section>

            <div className="analytics-main-grid">
              <section className="analytics-panel analytics-panel--wide" aria-labelledby="chart-types-heading">
                <h2 id="chart-types-heading" className="analytics-panel-title">
                  <PieChartIcon size={20} className="text-[#135bec]" aria-hidden />
                  Issue types (share of reports)
                </h2>
                {pieData.length === 0 ? (
                  <p className="analytics-empty">No reports yet — data will appear as issues are filed.</p>
                ) : (
                  <div className="analytics-chart-row">
                    <div className="analytics-donut-wrap">
                      <ResponsiveContainer width="100%" height={260}>
                        <PieChart>
                          <Pie
                            data={pieData}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            innerRadius={68}
                            outerRadius={96}
                            paddingAngle={2}
                          >
                            {pieData.map((row, i) => (
                              <Cell key={`${row.name}-${i}`} fill={TYPE_COLORS[i % TYPE_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(value: number, name: string, item: { payload?: { percentage?: number } }) => [
                              `${value} (${item?.payload?.percentage ?? 0}%)`,
                              name,
                            ]}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="analytics-donut-center">
                        <span className="analytics-donut-center-pct">
                          {dominantType ? `${dominantType.percentage}%` : '—'}
                        </span>
                        <span className="analytics-donut-center-label">
                          {dominantType ? dominantType.name : 'Top type'}
                        </span>
                      </div>
                    </div>
                    <ul className="analytics-legend" aria-label="Breakdown by type">
                      {pieData.map((row, i) => (
                        <li key={row.name} className="analytics-legend-row">
                          <span
                            className="analytics-legend-dot"
                            style={{ background: TYPE_COLORS[i % TYPE_COLORS.length] }}
                          />
                          <span className="analytics-legend-name">{row.name}</span>
                          <span className="analytics-legend-pct">{row.percentage}%</span>
                          <span className="analytics-legend-count">({row.value})</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>

              <section className="analytics-panel" aria-labelledby="chart-status-heading">
                <h2 id="chart-status-heading" className="analytics-panel-title">
                  <BarChart3 size={20} className="text-[#135bec]" aria-hidden />
                  Status pipeline
                </h2>
                <div className="analytics-bar-wrap">
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={statusBarData} layout="vertical" margin={{ left: 8, right: 16 }}>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
                      <XAxis type="number" allowDecimals={false} />
                      <YAxis dataKey="name" type="category" width={88} tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                        {statusBarData.map((row, i) => (
                          <BarCell key={row.name} fill={row.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <p className="analytics-panel-foot">
                  Resolved when community resolve-verification score crosses the threshold (same as the map).
                </p>
              </section>
            </div>

            <section className="analytics-table-section" aria-labelledby="recent-heading">
              <div className="analytics-table-head">
                <h2 id="recent-heading" className="analytics-panel-title">
                  <MapPin size={20} className="text-[#135bec]" aria-hidden />
                  Recent issues
                </h2>
                <span className="analytics-table-meta">
                  Showing {data.recentPins.length} newest
                </span>
              </div>
              <div className="analytics-table-wrap">
                <table className="analytics-table">
                  <thead>
                    <tr>
                      <th scope="col">Issue</th>
                      <th scope="col">Type</th>
                      <th scope="col">Status</th>
                      <th scope="col">Severity</th>
                      <th scope="col" className="analytics-table-actions">
                        <span className="sr-only">Open</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recentPins.map((pin) => (
                      <tr key={pin._id}>
                        <td>
                          <div className="analytics-cell-issue">
                            <span className="analytics-cell-title">
                              {pin.problemHeading || pin.problemType}
                            </span>
                            {pin.address ? (
                              <span className="analytics-cell-sub">{pin.address}</span>
                            ) : null}
                          </div>
                        </td>
                        <td>{pin.problemType}</td>
                        <td>
                          <span className={statusBadgeClass(pin.status)}>{statusLabel(pin.status)}</span>
                        </td>
                        <td>
                          <span className="analytics-severity" title="1–10">
                            {pin.severity}/10
                          </span>
                        </td>
                        <td className="analytics-table-actions">
                          <button
                            type="button"
                            className="analytics-link-btn"
                            onClick={() => navigate(`/pin/${pin._id}`)}
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
