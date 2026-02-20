import React, { useState, useEffect, useCallback } from 'react';
import { API_BASE_URL } from '../config';
import { useAuth } from '../context/AuthContext';
import './Leaderboard.css';

// ─── Scoring weights (must match backend) ───────────────────────────────────
const SCORE_LABELS = [
    { key: 'pins', label: 'Pins Created', icon: 'push_pin', color: '#6366f1', pts: 10 },
    { key: 'ngos', label: 'NGOs Added', icon: 'business', color: '#10b981', pts: 20 },
    { key: 'events', label: 'Events Organized', icon: 'event', color: '#f59e0b', pts: 15 },
    { key: 'suggestion', label: 'Suggestions Made', icon: 'lightbulb', color: '#8b5cf6', pts: 5 },
    { key: 'comments', label: 'Pin Comments', icon: 'comment', color: '#3b82f6', pts: 3 },
];

// ─── Period tab config ────────────────────────────────────────────────────────
const PERIODS = [
    { key: 'daily', label: 'Daily', icon: 'today' },
    { key: 'weekly', label: 'Weekly', icon: 'calendar_view_week' },
    { key: 'monthly', label: 'Monthly', icon: 'calendar_month' },
    { key: 'yearly', label: 'Yearly', icon: 'event_note' },
];

// ─── Medal config for top 3 ──────────────────────────────────────────────────
const MEDAL = ['🥇', '🥈', '🥉'];
const MEDAL_GLOW = ['rgba(255,215,0,.35)', 'rgba(192,192,192,.35)', 'rgba(205,127,50,.35)'];

// ─── Helpers ─────────────────────────────────────────────────────────────────
function avatarGradient(userId) {
    let h = 0;
    for (let i = 0; i < userId.length; i++) h = (h * 31 + userId.charCodeAt(i)) & 0xffff;
    const hue1 = h % 360;
    const hue2 = (hue1 + 40) % 360;
    return `linear-gradient(135deg, hsl(${hue1},70%,55%), hsl(${hue2},70%,40%))`;
}

function periodLabel(start, end, period) {
    if (!start || !end) return '';
    const s = new Date(start);
    const e = new Date(new Date(end).getTime() - 1); // last ms of period

    if (period === 'daily') {
        return s.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    }
    if (period === 'yearly') {
        return s.toLocaleDateString(undefined, { year: 'numeric' });
    }
    if (period === 'monthly') {
        return s.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    }
    // weekly
    const fmt = (d) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    return `${fmt(s)} – ${fmt(e)}`;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function Leaderboard() {
    const { getToken } = useAuth();

    const [period, setPeriod] = useState('weekly');
    const [leaders, setLeaders] = useState([]);
    const [meta, setMeta] = useState({ periodStart: null, periodEnd: null });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [expanded, setExpanded] = useState(null); // userId of expanded row

    const fetchLeaderboard = useCallback(async (p) => {
        setLoading(true);
        setError('');
        setExpanded(null); // collapse all rows on period change
        try {
            const token = await getToken();
            // User's timezone offset in minutes (e.g. 330 for IST) so "today" matches local date
            const tzOffset = -new Date().getTimezoneOffset();
            const res = await fetch(`${API_BASE_URL}/api/leaderboard?period=${p}&timezone=${tzOffset}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) throw new Error('Failed to load leaderboard');
            const data = await res.json();
            setLeaders(data.leaders || []);
            setMeta({ periodStart: data.periodStart, periodEnd: data.periodEnd });
        } catch (e) {
            setError(e.message || 'Something went wrong');
        } finally {
            setLoading(false);
        }
    }, [getToken]);

    // Fetch whenever period changes
    useEffect(() => { fetchLeaderboard(period); }, [period, fetchLeaderboard]);

    const activePeriodLabel = PERIODS.find((p) => p.key === period)?.label ?? 'Weekly';

    return (
        <div className="lb-page">
            {/* ── Hero ──────────────────────────────────────────────────── */}
            <div className="lb-hero">
                <div className="lb-hero-bg" aria-hidden="true" />
                <div className="lb-hero-content">
                    <span className="lb-hero-trophy" aria-hidden="true">🏆</span>
                    <h1 className="lb-hero-title">{activePeriodLabel} Leaderboard</h1>
                    <p className="lb-hero-subtitle">
                        Top contributors &nbsp;·&nbsp;
                        <span className="lb-hero-week">
                            {periodLabel(meta.periodStart, meta.periodEnd, period)}
                        </span>
                    </p>
                </div>

                {/* ── Period tabs (inside hero so they sit under the title) */}
                <div className="lb-period-tabs" role="tablist" aria-label="Select period">
                    {PERIODS.map(({ key, label, icon }) => (
                        <button
                            key={key}
                            role="tab"
                            aria-selected={period === key}
                            id={`lb-tab-${key}`}
                            className={`lb-period-tab${period === key ? ' lb-period-tab-active' : ''}`}
                            onClick={() => setPeriod(key)}
                            disabled={loading}
                        >
                            <span className="lb-period-tab-icon material-icons-round" aria-hidden="true">
                                {icon}
                            </span>
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="lb-main">
                {/* ── Scoring legend ──────────────────────────────────────── */}
                <section className="lb-legend" aria-label="Scoring system">
                    <h2 className="lb-legend-title">How points are scored</h2>
                    <div className="lb-legend-grid">
                        {SCORE_LABELS.map(({ key, label, icon, color, pts }) => (
                            <div key={key} className="lb-legend-item">
                                <span className="lb-legend-icon material-icons-round" style={{ color }}>
                                    {icon}
                                </span>
                                <span className="lb-legend-label">{label}</span>
                                <span className="lb-legend-pts" style={{ color }}>+{pts} pts</span>
                            </div>
                        ))}
                    </div>
                </section>

                {/* ── Board ───────────────────────────────────────────────── */}
                <section className="lb-board" aria-label="Leaderboard rankings">
                    <div className="lb-board-header">
                        <h2 className="lb-board-heading">Rankings</h2>
                        <button
                            id="lb-refresh-btn"
                            className="lb-refresh-btn"
                            onClick={() => fetchLeaderboard(period)}
                            disabled={loading}
                            title="Refresh leaderboard"
                            aria-label="Refresh"
                        >
                            <span className={`material-icons-round${loading ? ' lb-spin' : ''}`}>
                                refresh
                            </span>
                        </button>
                    </div>

                    {loading && (
                        <div className="lb-state">
                            <div className="lb-loader" aria-label="Loading" />
                            <p>Computing {activePeriodLabel.toLowerCase()} heroes…</p>
                        </div>
                    )}

                    {!loading && error && (
                        <div className="lb-state lb-state-error">
                            <span className="material-icons-round">error_outline</span>
                            <p>{error}</p>
                            <button className="lb-retry-btn" onClick={() => fetchLeaderboard(period)}>
                                Try again
                            </button>
                        </div>
                    )}

                    {!loading && !error && leaders.length === 0 && (
                        <div className="lb-state">
                            <span className="lb-empty-icon" aria-hidden="true">🌱</span>
                            <p>No contributions yet this {period.replace('ly', '')}.</p>
                            <p className="lb-state-sub">
                                Be the first — pin an issue, add an NGO, or join the conversation!
                            </p>
                        </div>
                    )}

                    {!loading && !error && leaders.length > 0 && (
                        <ol className="lb-list" aria-label="Top contributors">
                            {leaders.map((leader) => {
                                const isTop3 = leader.rank <= 3;
                                const isOpen = expanded === leader.userId;
                                const initials = (leader.username || '?')
                                    .split(' ')
                                    .map((w) => w[0])
                                    .join('')
                                    .slice(0, 2)
                                    .toUpperCase();

                                return (
                                    <li
                                        key={leader.userId}
                                        className={`lb-row${isTop3 ? ' lb-row-top' : ''}${isOpen ? ' lb-row-open' : ''}`}
                                        style={isTop3 ? { '--medal-glow': MEDAL_GLOW[leader.rank - 1] } : undefined}
                                    >
                                        {/* Main clickable row */}
                                        <button
                                            className="lb-row-main"
                                            onClick={() => setExpanded(isOpen ? null : leader.userId)}
                                            aria-expanded={isOpen}
                                            aria-controls={`lb-breakdown-${leader.userId}`}
                                        >
                                            <span className="lb-rank" aria-label={`Rank ${leader.rank}`}>
                                                {isTop3 ? MEDAL[leader.rank - 1] : leader.rank}
                                            </span>

                                            <span
                                                className="lb-avatar"
                                                style={{ background: avatarGradient(leader.userId) }}
                                                aria-hidden="true"
                                            >
                                                {initials}
                                            </span>

                                            <span className="lb-name-col">
                                                <span className="lb-username">{leader.username}</span>
                                                <span className="lb-contributions-summary">
                                                    {[
                                                        leader.pins && `${leader.pins} pin${leader.pins !== 1 ? 's' : ''}`,
                                                        leader.ngos && `${leader.ngos} NGO${leader.ngos !== 1 ? 's' : ''}`,
                                                        leader.events && `${leader.events} event${leader.events !== 1 ? 's' : ''}`,
                                                        leader.suggestion && `${leader.suggestion} suggestion${leader.suggestion !== 1 ? 's' : ''}`,
                                                        leader.comments && `${leader.comments} comment${leader.comments !== 1 ? 's' : ''}`,
                                                    ]
                                                        .filter(Boolean)
                                                        .join(' · ') || 'No contributions yet'}
                                                </span>
                                            </span>

                                            <span className="lb-score-col">
                                                <span className="lb-score">{leader.total.toLocaleString()}</span>
                                                <span className="lb-score-label">pts</span>
                                            </span>

                                            <span className="lb-chevron material-icons-round" aria-hidden="true">
                                                {isOpen ? 'expand_less' : 'expand_more'}
                                            </span>
                                        </button>

                                        {/* Score breakdown (collapsible) */}
                                        <div
                                            id={`lb-breakdown-${leader.userId}`}
                                            className={`lb-breakdown${isOpen ? ' lb-breakdown-open' : ''}`}
                                        >
                                            <div className="lb-breakdown-inner">
                                                {leader.total === 0 ? (
                                                    <p className="lb-breakdown-empty">
                                                        No activity recorded this {period.replace('ly', '')} yet.
                                                        Start contributing to earn points! 🚀
                                                    </p>
                                                ) : (
                                                    SCORE_LABELS.map(({ key, label, icon, color, pts }) => {
                                                        const count = leader[key] ?? 0;
                                                        if (count === 0) return null;
                                                        return (
                                                            <div key={key} className="lb-breakdown-row">
                                                                <span
                                                                    className="lb-breakdown-icon material-icons-round"
                                                                    style={{ color }}
                                                                >
                                                                    {icon}
                                                                </span>
                                                                <span className="lb-breakdown-label">{label}</span>
                                                                <span className="lb-breakdown-count">×{count}</span>
                                                                <span className="lb-breakdown-earned" style={{ color }}>
                                                                    +{(count * pts).toLocaleString()} pts
                                                                </span>
                                                            </div>
                                                        );
                                                    })
                                                )}
                                                <div className="lb-breakdown-total">
                                                    <span>{activePeriodLabel} total</span>
                                                    <span>{leader.total.toLocaleString()} pts</span>
                                                </div>
                                            </div>
                                        </div>
                                    </li>
                                );
                            })}
                        </ol>
                    )}
                </section>
            </div>
        </div>
    );
}
