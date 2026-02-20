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
    { key: 'comments', label: 'Pin Comments', icon: 'comment', color: '#3b82f6', pts: 3 }
];

// ─── Medal colours for top 3 ─────────────────────────────────────────────────
const MEDAL = ['🥇', '🥈', '🥉'];
const MEDAL_GLOW = ['rgba(255,215,0,.35)', 'rgba(192,192,192,.35)', 'rgba(205,127,50,.35)'];

// Helper: generate a deterministic avatar gradient from a userId string
function avatarGradient(userId) {
    let h = 0;
    for (let i = 0; i < userId.length; i++) h = (h * 31 + userId.charCodeAt(i)) & 0xffff;
    const hue1 = h % 360;
    const hue2 = (hue1 + 40) % 360;
    return `linear-gradient(135deg, hsl(${hue1},70%,55%), hsl(${hue2},70%,40%))`;
}

// Helper: format week label
function weekLabel(start, end) {
    if (!start || !end) return '';
    const fmt = (d) =>
        new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    return `${fmt(start)} – ${fmt(new Date(new Date(end).getTime() - 1))}`;
}

export default function Leaderboard() {
    const { getToken } = useAuth();
    const [leaders, setLeaders] = useState([]);
    const [meta, setMeta] = useState({ weekStart: null, weekEnd: null });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [expanded, setExpanded] = useState(null); // userId of expanded row

    const fetchLeaderboard = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const token = await getToken();
            const res = await fetch(`${API_BASE_URL}/api/leaderboard/weekly`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) throw new Error('Failed to load leaderboard');
            const data = await res.json();
            setLeaders(data.leaders || []);
            setMeta({ weekStart: data.weekStart, weekEnd: data.weekEnd });
        } catch (e) {
            setError(e.message || 'Something went wrong');
        } finally {
            setLoading(false);
        }
    }, [getToken]);

    useEffect(() => { fetchLeaderboard(); }, [fetchLeaderboard]);

    return (
        <div className="lb-page">
            {/* ── Header ─────────────────────────────────────────────────────── */}
            <div className="lb-hero">
                <div className="lb-hero-bg" aria-hidden="true" />
                <div className="lb-hero-content">
                    <span className="lb-hero-trophy" aria-hidden="true">🏆</span>
                    <h1 className="lb-hero-title">Weekly Leaderboard</h1>
                    <p className="lb-hero-subtitle">
                        Top contributors this week &nbsp;·&nbsp;
                        <span className="lb-hero-week">{weekLabel(meta.weekStart, meta.weekEnd)}</span>
                    </p>
                </div>
            </div>

            <div className="lb-main">
                {/* ── Scoring legend ──────────────────────────────────────────── */}
                <section className="lb-legend" aria-label="Scoring system">
                    <h2 className="lb-legend-title">How points are scored</h2>
                    <div className="lb-legend-grid">
                        {SCORE_LABELS.map(({ key, label, icon, color, pts }) => (
                            <div key={key} className="lb-legend-item">
                                <span
                                    className="lb-legend-icon material-icons-round"
                                    style={{ color }}
                                >
                                    {icon}
                                </span>
                                <span className="lb-legend-label">{label}</span>
                                <span className="lb-legend-pts" style={{ color }}>
                                    +{pts} pts
                                </span>
                            </div>
                        ))}
                    </div>
                </section>

                {/* ── Board ───────────────────────────────────────────────────── */}
                <section className="lb-board" aria-label="Leaderboard rankings">
                    <div className="lb-board-header">
                        <h2 className="lb-board-heading">Rankings</h2>
                        <button
                            id="lb-refresh-btn"
                            className="lb-refresh-btn"
                            onClick={fetchLeaderboard}
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
                            <p>Computing this week's heroes…</p>
                        </div>
                    )}

                    {!loading && error && (
                        <div className="lb-state lb-state-error">
                            <span className="material-icons-round">error_outline</span>
                            <p>{error}</p>
                            <button className="lb-retry-btn" onClick={fetchLeaderboard}>
                                Try again
                            </button>
                        </div>
                    )}

                    {!loading && !error && leaders.length === 0 && (
                        <div className="lb-state">
                            <span className="lb-empty-icon" aria-hidden="true">🌱</span>
                            <p>No contributions yet this week.</p>
                            <p className="lb-state-sub">Be the first — pin an issue, add an NGO, or join the conversation!</p>
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
                                        {/* Main row (always visible) */}
                                        <button
                                            className="lb-row-main"
                                            onClick={() => setExpanded(isOpen ? null : leader.userId)}
                                            aria-expanded={isOpen}
                                            aria-controls={`lb-breakdown-${leader.userId}`}
                                        >
                                            {/* Rank */}
                                            <span className="lb-rank" aria-label={`Rank ${leader.rank}`}>
                                                {isTop3 ? MEDAL[leader.rank - 1] : leader.rank}
                                            </span>

                                            {/* Avatar */}
                                            <span
                                                className="lb-avatar"
                                                style={{ background: avatarGradient(leader.userId) }}
                                                aria-hidden="true"
                                            >
                                                {initials}
                                            </span>

                                            {/* Name + subtitle */}
                                            <span className="lb-name-col">
                                                <span className="lb-username">{leader.username}</span>
                                                <span className="lb-contributions-summary">
                                                    {[
                                                        leader.pins && `${leader.pins} pin${leader.pins !== 1 ? 's' : ''}`,
                                                        leader.ngos && `${leader.ngos} NGO${leader.ngos !== 1 ? 's' : ''}`,
                                                        leader.events && `${leader.events} event${leader.events !== 1 ? 's' : ''}`,
                                                        leader.comments && `${leader.comments} comment${leader.comments !== 1 ? 's' : ''}`,
                                                        leader.suggestion && `${leader.suggestion} suggestion${leader.suggestion !== 1 ? 's' : ''}`,
                                                    ]
                                                        .filter(Boolean)
                                                        .join(' · ') || 'No contributions yet'}
                                                </span>
                                            </span>

                                            {/* Score */}
                                            <span className="lb-score-col">
                                                <span className="lb-score">{leader.total.toLocaleString()}</span>
                                                <span className="lb-score-label">pts</span>
                                            </span>

                                            {/* Expand chevron */}
                                            <span className="lb-chevron material-icons-round" aria-hidden="true">
                                                {isOpen ? 'expand_less' : 'expand_more'}
                                            </span>
                                        </button>

                                        {/* Breakdown (collapsible) */}
                                        <div
                                            id={`lb-breakdown-${leader.userId}`}
                                            className={`lb-breakdown${isOpen ? ' lb-breakdown-open' : ''}`}
                                        >
                                            <div className="lb-breakdown-inner">
                                                {leader.total === 0 ? (
                                                    <p className="lb-breakdown-empty">
                                                        No activity recorded this week yet. Start contributing to earn points! 🚀
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
                                                    <span>Weekly total</span>
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
