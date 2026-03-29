import React, { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  LineChart,
  Line,
  Legend,
  XAxis,
  YAxis,
  CartesianGrid,
  BarChart,
  Bar,
  Cell as BarCell,
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
  UserPlus,
  LineChart as LineChartIcon,
  ArrowDown,
  ArrowUp,
} from 'lucide-react';
import './Analytics.css';
import { getProblemTypeMarkerHtml, PROBLEM_TYPE_COLORS } from '../utils/problemTypeIcons';
import { getPinImageDisplayUrl } from '../utils/pinImageEntry';
import type { PinImageStored } from '../utils/pinImageEntry';
import { formatRelativeTimeAgo } from '../utils/formatRelativeTime';

const ANALYTICS_QUERY_KEY = ['pins-analytics'];
const ACTIVITY_QUERY_KEY = 'pins-analytics-activity';
const USERS_JOIN_QUERY_KEY = 'users-analytics-joins';
const STALE_MS = 2 * 60 * 1000;

export type ActivityRange = '7d' | '30d' | '365d' | 'all';

export type ActivitySeriesPayload = {
  range: ActivityRange;
  unit: 'day' | 'month';
  series: { t: string; reported: number; resolved: number }[];
};

export type UserJoinSeriesPayload = {
  range: ActivityRange;
  unit: 'day' | 'month';
  series: { t: string; joined: number }[];
};

const ACTIVITY_RANGE_OPTIONS: { value: ActivityRange; label: string }[] = [
  { value: '7d', label: '7 days' },
  { value: '30d', label: '1 month' },
  { value: '365d', label: '1 year' },
  { value: 'all', label: 'All time' },
];

function formatActivityBucketLabel(iso: string, range: ActivityRange): string {
  const d = new Date(iso);
  if (range === 'all') {
    return d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
  }
  if (range === '7d') {
    return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  }
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

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

/** Fallback when problemType is not in the known enum (legacy data). */
const TYPE_COLORS_FALLBACK = ['#135bec', '#f59e0b', '#f43f5e', '#10b981', '#8b5cf6', '#64748b'];

function fillForProblemType(name: string, index: number): string {
  const fromMap = (PROBLEM_TYPE_COLORS as Record<string, string>)[name];
  return fromMap ?? TYPE_COLORS_FALLBACK[index % TYPE_COLORS_FALLBACK.length];
}

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
  upvotes: number;
  status: 'resolved' | 'in_progress' | 'open';
  createdAt: string;
  firstImage?: PinImageStored | null;
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

const RECENT_SORT_KEYS = ['issue', 'type', 'reported', 'status', 'severity', 'likes'] as const;
export type RecentSortKey = (typeof RECENT_SORT_KEYS)[number];

const DEFAULT_FIRST_SORT_DIRECTION: Record<RecentSortKey, 'asc' | 'desc'> = {
  issue: 'asc',
  type: 'asc',
  reported: 'desc',
  status: 'asc',
  severity: 'desc',
  likes: 'desc',
};

const STATUS_SORT_ORDER: Record<AnalyticsRecentPin['status'], number> = {
  open: 0,
  in_progress: 1,
  resolved: 2,
};

function compareRecentPins(
  a: AnalyticsRecentPin,
  b: AnalyticsRecentPin,
  key: RecentSortKey,
  dir: 'asc' | 'desc'
): number {
  const mult = dir === 'asc' ? 1 : -1;
  switch (key) {
    case 'issue': {
      const sa = (a.problemHeading || a.problemType || '').toLowerCase();
      const sb = (b.problemHeading || b.problemType || '').toLowerCase();
      return mult * sa.localeCompare(sb, undefined, { sensitivity: 'base' });
    }
    case 'type':
      return mult * a.problemType.localeCompare(b.problemType, undefined, { sensitivity: 'base' });
    case 'reported': {
      const ta = new Date(a.createdAt).getTime();
      const tb = new Date(b.createdAt).getTime();
      return mult * (ta - tb);
    }
    case 'status': {
      const va = STATUS_SORT_ORDER[a.status] ?? 99;
      const vb = STATUS_SORT_ORDER[b.status] ?? 99;
      const cmp = va - vb;
      if (cmp !== 0) return mult * cmp;
      return mult * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    }
    case 'severity':
      return mult * (a.severity - b.severity);
    case 'likes':
      return mult * ((a.upvotes ?? 0) - (b.upvotes ?? 0));
    default:
      return 0;
  }
}

type PlatformStatsPayload = Record<(typeof PLATFORM_STATS_LABELS)[number]['key'], number>;

type RecentSortState = { key: RecentSortKey; dir: 'asc' | 'desc' } | null;

function AnalyticsSortTh({
  label,
  sortKey,
  sort,
  onSort,
}: {
  label: string;
  sortKey: RecentSortKey;
  sort: RecentSortState;
  onSort: (key: RecentSortKey) => void;
}) {
  const active = sort?.key === sortKey;
  const dir = active && sort ? sort.dir : null;
  return (
    <th scope="col" aria-sort={active && dir ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button
        type="button"
        className={`analytics-th-sort${active ? ' analytics-th-sort--active' : ''}`}
        onClick={() => onSort(sortKey)}
        aria-label={
          active && dir
            ? `${label}: sorted ${dir === 'asc' ? 'ascending' : 'descending'}. Click to reverse.`
            : `Sort by ${label}`
        }
      >
        <span>{label}</span>
        {active &&
          (dir === 'asc' ? (
            <ArrowUp className="analytics-th-sort-icon" size={14} aria-hidden />
          ) : (
            <ArrowDown className="analytics-th-sort-icon" size={14} aria-hidden />
          ))}
      </button>
    </th>
  );
}

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

  const [activityRange, setActivityRange] = useState<ActivityRange>('30d');
  const [userJoinRange, setUserJoinRange] = useState<ActivityRange>('30d');
  const [recentSort, setRecentSort] = useState<RecentSortState>(null);

  const {
    data: activityData,
    isLoading: activityLoading,
    error: activityError,
  } = useQuery({
    queryKey: [ACTIVITY_QUERY_KEY, activityRange],
    queryFn: async (): Promise<ActivitySeriesPayload> => {
      const token = await getToken();
      const res = await fetch(
        `${API_BASE_URL}/api/pins/analytics/activity?range=${encodeURIComponent(activityRange)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to load activity series');
      }
      return res.json();
    },
    staleTime: STALE_MS,
  });

  const {
    data: userJoinData,
    isLoading: userJoinLoading,
    error: userJoinError,
  } = useQuery({
    queryKey: [USERS_JOIN_QUERY_KEY, userJoinRange],
    queryFn: async (): Promise<UserJoinSeriesPayload> => {
      const token = await getToken();
      const res = await fetch(
        `${API_BASE_URL}/api/users/analytics/joins?range=${encodeURIComponent(userJoinRange)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to load user join series');
      }
      return res.json();
    },
    staleTime: STALE_MS,
  });

  const userJoinBarData = useMemo(() => {
    const rows = userJoinData?.series ?? [];
    return rows.map((row) => ({
      ...row,
      label: formatActivityBucketLabel(row.t, userJoinRange),
    }));
  }, [userJoinData?.series, userJoinRange]);

  const activityLineData = useMemo(() => {
    const rows = activityData?.series ?? [];
    let reportedRun = 0;
    let resolvedRun = 0;
    return rows.map((row) => {
      reportedRun += row.reported;
      resolvedRun += row.resolved;
      return {
        ...row,
        label: formatActivityBucketLabel(row.t, activityRange),
        reportedCumulative: reportedRun,
        resolvedCumulative: resolvedRun,
      };
    });
  }, [activityData?.series, activityRange]);

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

  const handleRecentSort = useCallback((key: RecentSortKey) => {
    setRecentSort((prev) => {
      if (prev?.key === key) {
        return { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' };
      }
      return { key, dir: DEFAULT_FIRST_SORT_DIRECTION[key] };
    });
  }, []);

  const sortedRecentPins = useMemo(() => {
    const rows = data?.recentPins ?? [];
    if (!recentSort) return rows;
    const copy = [...rows];
    copy.sort((a, b) => compareRecentPins(a, b, recentSort.key, recentSort.dir));
    return copy;
  }, [data?.recentPins, recentSort]);

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
                              <Cell key={`${row.name}-${i}`} fill={fillForProblemType(row.name, i)} />
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
                            className="analytics-legend-type-icon"
                            dangerouslySetInnerHTML={{ __html: getProblemTypeMarkerHtml(row.name, 22) }}
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

              <section className="analytics-panel" aria-labelledby="chart-users-join-heading">
                <div className="analytics-activity-head">
                  <h2
                    id="chart-users-join-heading"
                    className="analytics-panel-title analytics-panel-title--flush"
                  >
                    <UserPlus size={20} className="text-[#6366f1]" aria-hidden />
                    Users joined
                  </h2>
                  <div className="analytics-activity-filters" role="group" aria-label="User join time range">
                    {ACTIVITY_RANGE_OPTIONS.map(({ value, label }) => (
                      <button
                        key={value}
                        type="button"
                        className={`analytics-range-btn${userJoinRange === value ? ' analytics-range-btn--active' : ''}`}
                        onClick={() => setUserJoinRange(value)}
                        aria-pressed={userJoinRange === value}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                {userJoinError && (
                  <p className="analytics-activity-error" role="alert">
                    {userJoinError instanceof Error ? userJoinError.message : 'Could not load chart'}
                  </p>
                )}
                {userJoinLoading && !userJoinData && !userJoinError && (
                  <div className="analytics-activity-loading">
                    <Loader2 className="analytics-icon-spin" size={24} aria-hidden />
                    <span>Loading chart…</span>
                  </div>
                )}
                {userJoinData && userJoinBarData.length === 0 && !userJoinLoading && (
                  <p className="analytics-empty analytics-empty--compact">No data in this range.</p>
                )}
                {userJoinData && userJoinBarData.length > 0 && (
                  <div className="analytics-line-wrap">
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart
                        data={userJoinBarData}
                        margin={{ top: 8, right: 8, left: 0, bottom: 4 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
                        <XAxis
                          dataKey="label"
                          tick={{ fontSize: 10 }}
                          interval="preserveStartEnd"
                          minTickGap={12}
                          height={40}
                        />
                        <YAxis allowDecimals={false} width={40} tick={{ fontSize: 11 }} />
                        <Tooltip
                          contentStyle={{ borderRadius: 8 }}
                          formatter={(value: number) => [
                            value.toLocaleString(),
                            userJoinData.unit === 'month'
                              ? 'New signups (month)'
                              : 'New signups (day)',
                          ]}
                        />
                        <Bar
                          dataKey="joined"
                          name="joined"
                          fill="#6366f1"
                          radius={[4, 4, 0, 0]}
                          maxBarSize={48}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
                <p className="analytics-panel-foot">
                  New accounts from UserData (first sign-in / profile sync). Bars use daily buckets for
                  7 days / 1 month / 1 year, and monthly buckets for all time.
                </p>
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
                        {statusBarData.map((row) => (
                          <BarCell key={row.name} fill={row.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <p className="analytics-panel-foot">
                  Open, in progress, and resolved counts across all issues. Resolved when community
                  resolve-verification crosses the threshold (same as the map).
                </p>
              </section>

              <section className="analytics-panel" aria-labelledby="chart-activity-heading">
                <div className="analytics-activity-head">
                  <h2 id="chart-activity-heading" className="analytics-panel-title analytics-panel-title--flush">
                    <LineChartIcon size={20} className="text-[#135bec]" aria-hidden />
                    Cumulative reported vs resolved
                  </h2>
                  <div className="analytics-activity-filters" role="group" aria-label="Time range">
                    {ACTIVITY_RANGE_OPTIONS.map(({ value, label }) => (
                      <button
                        key={value}
                        type="button"
                        className={`analytics-range-btn${activityRange === value ? ' analytics-range-btn--active' : ''}`}
                        onClick={() => setActivityRange(value)}
                        aria-pressed={activityRange === value}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                {activityError && (
                  <p className="analytics-activity-error" role="alert">
                    {activityError instanceof Error ? activityError.message : 'Could not load chart'}
                  </p>
                )}
                {activityLoading && !activityData && !activityError && (
                  <div className="analytics-activity-loading">
                    <Loader2 className="analytics-icon-spin" size={24} aria-hidden />
                    <span>Loading chart…</span>
                  </div>
                )}
                {activityData && activityLineData.length === 0 && !activityLoading && (
                  <p className="analytics-empty analytics-empty--compact">No data in this range.</p>
                )}
                {activityData && activityLineData.length > 0 && (
                  <div className="analytics-line-wrap">
                    <ResponsiveContainer width="100%" height={260}>
                      <LineChart
                        data={activityLineData}
                        margin={{ top: 8, right: 8, left: 0, bottom: 4 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
                        <XAxis
                          dataKey="label"
                          tick={{ fontSize: 10 }}
                          interval="preserveStartEnd"
                          minTickGap={16}
                          height={36}
                        />
                        <YAxis allowDecimals={false} width={32} tick={{ fontSize: 11 }} />
                        <Tooltip
                          contentStyle={{ borderRadius: 8 }}
                          formatter={(value: number, name: string) => [
                            value,
                            name === 'reportedCumulative'
                              ? 'Total reported (in period)'
                              : 'Total resolved (in period)',
                          ]}
                        />
                        <Legend
                          wrapperStyle={{ fontSize: '12px', paddingTop: 8 }}
                          formatter={(value) =>
                            value === 'reportedCumulative'
                              ? 'Total reported (cumulative)'
                              : 'Total resolved (cumulative)'
                          }
                        />
                        <Line
                          type="stepAfter"
                          dataKey="reportedCumulative"
                          name="reportedCumulative"
                          stroke="#135bec"
                          strokeWidth={2}
                          dot={false}
                          activeDot={{ r: 4 }}
                        />
                        <Line
                          type="stepAfter"
                          dataKey="resolvedCumulative"
                          name="resolvedCumulative"
                          stroke="#10b981"
                          strokeWidth={2}
                          dot={false}
                          activeDot={{ r: 4 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
                <p className="analytics-panel-foot">
                  Running totals from the start of the selected range: each point adds new reports or new resolutions
                  in that bucket. Lines never decrease.
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
                  Showing {sortedRecentPins.length} issues
                </span>
              </div>
              <div className="analytics-table-wrap">
                <table className="analytics-table">
                  <thead>
                    <tr>
                      <AnalyticsSortTh
                        label="Issue"
                        sortKey="issue"
                        sort={recentSort}
                        onSort={handleRecentSort}
                      />
                      <AnalyticsSortTh
                        label="Type"
                        sortKey="type"
                        sort={recentSort}
                        onSort={handleRecentSort}
                      />
                      <AnalyticsSortTh
                        label="Reported"
                        sortKey="reported"
                        sort={recentSort}
                        onSort={handleRecentSort}
                      />
                      <AnalyticsSortTh
                        label="Status"
                        sortKey="status"
                        sort={recentSort}
                        onSort={handleRecentSort}
                      />
                      <AnalyticsSortTh
                        label="Severity"
                        sortKey="severity"
                        sort={recentSort}
                        onSort={handleRecentSort}
                      />
                      <AnalyticsSortTh
                        label="Likes"
                        sortKey="likes"
                        sort={recentSort}
                        onSort={handleRecentSort}
                      />
                      <th scope="col" className="analytics-table-actions">
                        <span className="sr-only">Open</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedRecentPins.map((pin) => {
                      const issueThumb = pin.firstImage
                        ? getPinImageDisplayUrl(pin.firstImage, 'thumb')
                        : '';
                      return (
                      <tr key={pin._id}>
                        <td>
                          <div className="analytics-cell-issue">
                            {issueThumb ? (
                              <img
                                className="analytics-issue-thumb"
                                src={issueThumb}
                                alt=""
                              />
                            ) : (
                              <span
                                className="analytics-issue-thumb-fallback"
                                aria-hidden
                                dangerouslySetInnerHTML={{
                                  __html: getProblemTypeMarkerHtml(pin.problemType, 44),
                                }}
                              />
                            )}
                            <div className="analytics-cell-issue-text">
                              <span className="analytics-cell-title">
                                {pin.problemHeading || pin.problemType}
                              </span>
                              {pin.address ? (
                                <span className="analytics-cell-sub">{pin.address}</span>
                              ) : null}
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="analytics-cell-type">
                            <span
                              className="analytics-type-icon"
                              dangerouslySetInnerHTML={{
                                __html: getProblemTypeMarkerHtml(pin.problemType, 22),
                              }}
                            />
                            <span>{pin.problemType}</span>
                          </div>
                        </td>
                        <td>
                          <span
                            className="analytics-cell-reported"
                            title={new Date(pin.createdAt).toLocaleString()}
                          >
                            {formatRelativeTimeAgo(pin.createdAt)}
                          </span>
                        </td>
                        <td>
                          <span className={statusBadgeClass(pin.status)}>{statusLabel(pin.status)}</span>
                        </td>
                        <td>
                          <span className="analytics-severity" title="1–10">
                            {pin.severity}/10
                          </span>
                        </td>
                        <td>
                          <span className="analytics-likes" title="Upvotes on this issue">
                            {(pin.upvotes ?? 0).toLocaleString()}
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
                      );
                    })}
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
