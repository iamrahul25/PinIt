import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Toast from '../components/Toast';
import './About.css';

function About({ showAuthButton = false }) {
    const navigate = useNavigate();
    const animRefs = useRef([]);
    const [toast, setToast] = useState({ visible: false, message: '' });

    const hideToast = () => setToast(t => ({ ...t, visible: false }));

    // For unauthenticated users, show info toast instead of navigating
    const handleProtectedAction = (path, actionLabel) => {
        if (showAuthButton) {
            setToast({ visible: true, message: `Please login to ${actionLabel}. Click "Login / Sign Up" at the top to continue.` });
        } else {
            navigate(path);
        }
    };

    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('visible');
                    }
                });
            },
            { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
        );

        const elements = document.querySelectorAll('.about-animate');
        elements.forEach((el) => observer.observe(el));

        return () => observer.disconnect();
    }, []);

    const scrollToSection = (id) => {
        const el = document.getElementById(id);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    return (
        <div className="about-page">

            {/* ===== AUTH TOP BAR (only for unauthenticated visitors) ===== */}
            {showAuthButton && (
                <div className="about-auth-topbar">
                    <div className="about-auth-topbar-inner">
                        <div className="about-auth-brand">
                            <span className="material-icons-round" style={{ fontSize: '1.5rem', color: '#2dd4a8' }}>push_pin</span>
                            <span className="about-auth-brand-text">Pin-It</span>
                        </div>
                        <button className="about-auth-login-btn" onClick={() => navigate('/login')}>
                            <span className="material-icons-round">login</span>
                            Login / Sign Up
                        </button>
                    </div>
                </div>
            )}

            {/* ===== HERO ===== */}
            <section className="about-hero">
                <div className="about-hero-particles">
                    <div className="about-particle" />
                    <div className="about-particle" />
                    <div className="about-particle" />
                    <div className="about-particle" />
                    <div className="about-particle" />
                    <div className="about-particle" />
                </div>
                <div className="about-hero-content">
                    <div className="about-hero-badge">
                        <span className="material-icons-round">location_on</span>
                        Civic Issue Reporting Platform
                    </div>
                    <h1 className="about-hero-title">
                        Pin Any Civic Issue<br />
                        <span className="about-highlight">In Your Locality</span>
                    </h1>
                    <p className="about-hero-subtitle">
                        Pin-It empowers citizens to report local problems by dropping geo-located pins on a map.
                        NGOs and community members then collaborate to solve these issues — making neighborhoods cleaner, safer, and greener.
                    </p>
                    <div className="about-hero-cta-group">
                        <button className="about-cta-btn about-cta-primary" onClick={() => handleProtectedAction('/', 'Explore the Map')}>
                            <span className="material-icons-round">explore</span>
                            Explore the Map
                        </button>
                        <button className="about-cta-btn about-cta-secondary" onClick={() => scrollToSection('about-features')}>
                            <span className="material-icons-round">info</span>
                            Learn More
                        </button>
                    </div>
                </div>
            </section>

            {/* ===== WHY PIN-IT ===== */}
            <section className="about-why">
                <div className="about-section">
                    <div className="about-section-header about-animate">
                        <div className="about-section-eyebrow">
                            <span className="material-icons-round">lightbulb</span> Why Pin-It?
                        </div>
                        <h2 className="about-section-title">Built for NGOs &amp; People</h2>
                        <p className="about-section-desc">
                            This website is made specifically for NGO's and people to come together and take civic responsibility.
                        </p>
                    </div>

                    <div className="about-why-grid">
                        <div className="about-why-text about-animate">
                            <div className="about-why-quote">
                                <span className="material-icons-round">account_balance</span>
                                Government have websites as well for reporting issues like that. For example —
                                <strong> CPGRAMS</strong> (Centralized Public Grievance Redress and Monitoring System): pgportal.gov.in,
                                <strong> Swachhata App</strong> (MoHUA), and
                                <strong> National Government Services Portal</strong>.
                            </div>
                            <div className="about-why-quote">
                                <span className="material-icons-round">format_quote</span>
                                Because, it's not government who is throwing the trash anywhere and causing the litter. It's us who are creating the problem. And so, it's our equal responsibility as well to make surrounding clean.
                            </div>
                            <div className="about-why-quote">
                                <span className="material-icons-round">format_quote</span>
                                Once people take part in such drive and work on ground - they will realise how big is the problem. And they will definitely stop doing litter and they will also stop others if to do so. This awareness creates a ripple effect. So, everyone should join the clean-up drives (or other drives) at-least once.
                            </div>
                            <div className="about-why-problems">
                                <h4 style={{ color: '#f1f5f9', fontWeight: 700, fontSize: '1.1rem', marginBottom: '0.25rem' }}>The Problem</h4>
                                <div className="about-problem-item">
                                    <div className="about-problem-icon">
                                        <span className="material-icons-round">search_off</span>
                                    </div>
                                    <div className="about-problem-text">
                                        <h4>Hard to Find Locations</h4>
                                        <p>Many NGOs conduct drives (cleanups, plantations, painting, etc.) but struggle to find locations</p>
                                    </div>
                                </div>
                                <div className="about-problem-item">
                                    <div className="about-problem-icon">
                                        <span className="material-icons-round">group_off</span>
                                    </div>
                                    <div className="about-problem-text">
                                        <h4>Low Volunteer Participation</h4>
                                        <p>Low volunteer participation in some cities</p>
                                    </div>
                                </div>
                                <div className="about-problem-item">
                                    <div className="about-problem-icon">
                                        <span className="material-icons-round">visibility_off</span>
                                    </div>
                                    <div className="about-problem-text">
                                        <h4>Lack of Awareness</h4>
                                        <p>Lack of awareness about ongoing drives</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="about-solution-cards about-animate">
                            <h4 style={{ color: '#f1f5f9', fontWeight: 700, fontSize: '1.1rem', marginBottom: '0.25rem' }}>The Solution — Pin-It helps in:</h4>
                            <div className="about-solution-card">
                                <div className="about-solution-icon green">✅</div>
                                <div>
                                    <h4>Marking and finding issues nearby</h4>
                                    <p>Geo-located pins make it easy to spot problems around you</p>
                                </div>
                            </div>
                            <div className="about-solution-card">
                                <div className="about-solution-icon blue">🤝</div>
                                <div>
                                    <h4>Connecting people and NGOs together</h4>
                                    <p>Bridge the gap between willing volunteers and NGOs</p>
                                </div>
                            </div>
                            <div className="about-solution-card">
                                <div className="about-solution-icon orange">🔧</div>
                                <div>
                                    <h4>Fixing problems collaboratively</h4>
                                    <p>Track issues from reported to resolved together</p>
                                </div>
                            </div>
                            <div className="about-solution-card">
                                <div className="about-solution-icon teal">📢</div>
                                <div>
                                    <h4>Spreading awareness</h4>
                                    <p>This awareness creates a ripple effect</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ===== ISSUE TYPES ===== */}
            <section className="about-issues-section">
                <div className="about-section">
                    <div className="about-section-header about-animate">
                        <div className="about-section-eyebrow">
                            <span className="material-icons-round">report_problem</span> Issue Types
                        </div>
                        <h2 className="about-section-title">What Can You Report?</h2>
                        <p className="about-section-desc">
                            From potholes to stray animals — pin any civic problem you encounter in your daily life.
                        </p>
                    </div>

                    <div className="about-issues-grid about-animate">
                        <div className="about-issue-card">
                            <span className="about-issue-emoji">🗑️</span>
                            <h4>Trash Pile</h4>
                            <p>Accumulated garbage in open areas</p>
                        </div>
                        <div className="about-issue-card">
                            <span className="about-issue-emoji">🕳️</span>
                            <h4>Pothole</h4>
                            <p>Road damage and potholes</p>
                        </div>
                        <div className="about-issue-card">
                            <span className="about-issue-emoji">🌊</span>
                            <h4>Water Pollution</h4>
                            <p>Garbage in rivers, lakes, etc.</p>
                        </div>
                        <div className="about-issue-card">
                            <span className="about-issue-emoji">🐕</span>
                            <h4>Stray Animals</h4>
                            <p>Areas with stray animal issues</p>
                        </div>
                        <div className="about-issue-card">
                            <span className="about-issue-emoji">💡</span>
                            <h4>Broken Infrastructure</h4>
                            <p>Broken pipes, fuse street lights</p>
                        </div>
                        <div className="about-issue-card">
                            <span className="about-issue-emoji">➕</span>
                            <h4>And More</h4>
                            <p>Any civic issue you encounter</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* ===== HOW IT WORKS ===== */}
            <section className="about-how-section">
                <div className="about-section">
                    <div className="about-section-header about-animate">
                        <div className="about-section-eyebrow">
                            <span className="material-icons-round">route</span> How It Works
                        </div>
                        <h2 className="about-section-title">Four Simple Steps</h2>
                        <p className="about-section-desc">
                            Report an issue in under a minute and watch the community come together to fix it.
                        </p>
                    </div>

                    <div className="about-how-steps about-animate">
                        <div className="about-how-step">
                            <div className="about-step-number">1</div>
                            <h4>Drop the Pin</h4>
                            <p>Click on the map to mark the location of the issue</p>
                        </div>
                        <div className="about-how-step">
                            <div className="about-step-number">2</div>
                            <h4>Add Details</h4>
                            <p>Describe the problem with type, severity, and description</p>
                        </div>
                        <div className="about-how-step">
                            <div className="about-step-number">3</div>
                            <h4>Attach Photos</h4>
                            <p>Upload photos as evidence of the issue</p>
                        </div>
                        <div className="about-how-step">
                            <div className="about-step-number">4</div>
                            <h4>Post It</h4>
                            <p>Publish for NGOs and people to see and take action</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* ===== FEATURES SHOWCASE ===== */}
            <section id="about-features" className="about-features-section">
                <div className="about-section">
                    <div className="about-section-header about-animate">
                        <div className="about-section-eyebrow">
                            <span className="material-icons-round">auto_awesome</span> Features
                        </div>
                        <h2 className="about-section-title">Everything You Need</h2>
                        <p className="about-section-desc">
                            A comprehensive platform designed to make civic engagement simple, effective, and rewarding.
                        </p>
                    </div>

                    <div className="about-feature-showcase">

                        {/* Map Page */}
                        <div className="about-feature-block about-animate">
                            <div className="about-feature-info">
                                <div className="about-feature-tag map">
                                    <span className="material-icons-round">map</span> Map Page
                                </div>
                                <h3>Interactive Map Interface</h3>
                                <p>
                                    The main hub for viewing and reporting civic issues. Click anywhere on the map to pin an issue, browse all pins through the side panel, or filter by type, date, and more.
                                </p>
                                <div className="about-feature-highlights">
                                    <div className="about-feature-highlight">
                                        <span className="material-icons-round">check_circle</span>
                                        Pin an issue with one click
                                    </div>
                                    <div className="about-feature-highlight">
                                        <span className="material-icons-round">check_circle</span>
                                        View all pins in a side panel
                                    </div>
                                    <div className="about-feature-highlight">
                                        <span className="material-icons-round">check_circle</span>
                                        Filter by type, saved, date, likes
                                    </div>
                                    <div className="about-feature-highlight">
                                        <span className="material-icons-round">check_circle</span>
                                        Toggle between card view sizes
                                    </div>
                                </div>
                            </div>
                            <div className="about-feature-image-wrap">
                                <img src="/images/map-page.png" alt="Pin-It Map Page" className="about-feature-img" loading="lazy" />
                            </div>
                        </div>

                        {/* Pin Details */}
                        <div className="about-feature-block reverse about-animate">
                            <div className="about-feature-info">
                                <div className="about-feature-tag pin">
                                    <span className="material-icons-round">push_pin</span> Pin Details
                                </div>
                                <h3>Comprehensive Issue View</h3>
                                <p>
                                    Every pin has a detailed page showing the issue heading, description, before/after images, verification status, severity rating, and precise GPS location.
                                </p>
                                <div className="about-feature-highlights">
                                    <div className="about-feature-highlight">
                                        <span className="material-icons-round">check_circle</span>
                                        Before &amp; After images
                                    </div>
                                    <div className="about-feature-highlight">
                                        <span className="material-icons-round">check_circle</span>
                                        Verification score system
                                    </div>
                                    <div className="about-feature-highlight">
                                        <span className="material-icons-round">check_circle</span>
                                        Nested comments (3 levels)
                                    </div>
                                    <div className="about-feature-highlight">
                                        <span className="material-icons-round">check_circle</span>
                                        Severity scale 1-10
                                    </div>
                                </div>
                            </div>
                            <div className="about-feature-image-wrap">
                                <img src="/images/pin-details.png" alt="Pin Details View" className="about-feature-img" loading="lazy" />
                            </div>
                        </div>

                        {/* Profile Page */}
                        <div className="about-feature-block about-animate">
                            <div className="about-feature-info">
                                <div className="about-feature-tag profile">
                                    <span className="material-icons-round">person</span> Profile
                                </div>
                                <h3>Track Your Contributions</h3>
                                <p>
                                    Your profile showcases your civic journey — contribution stats, level badges (Bronze to Diamond), gamification badges, pins you've created, and more.
                                </p>
                                <div className="about-feature-highlights">
                                    <div className="about-feature-highlight">
                                        <span className="material-icons-round">check_circle</span>
                                        Contribution statistics
                                    </div>
                                    <div className="about-feature-highlight">
                                        <span className="material-icons-round">check_circle</span>
                                        Level system (1-5)
                                    </div>
                                    <div className="about-feature-highlight">
                                        <span className="material-icons-round">check_circle</span>
                                        Gamification badges
                                    </div>
                                    <div className="about-feature-highlight">
                                        <span className="material-icons-round">check_circle</span>
                                        User role display
                                    </div>
                                </div>
                            </div>
                            <div className="about-feature-image-wrap">
                                <img src="/images/profile-page.png" alt="Profile Page" className="about-feature-img" loading="lazy" />
                            </div>
                        </div>

                        {/* Suggestions */}
                        <div className="about-feature-block reverse about-animate">
                            <div className="about-feature-info">
                                <div className="about-feature-tag suggestion">
                                    <span className="material-icons-round">tips_and_updates</span> Suggestions
                                </div>
                                <h3>Share Your Ideas</h3>
                                <p>
                                    Submit feature requests, UI improvements, bug reports, or general improvement ideas. Track the status and action taken on every suggestion.
                                </p>
                                <div className="about-feature-highlights">
                                    <div className="about-feature-highlight">
                                        <span className="material-icons-round">check_circle</span>
                                        Feature requests &amp; bug reports
                                    </div>
                                    <div className="about-feature-highlight">
                                        <span className="material-icons-round">check_circle</span>
                                        Filter by type and status
                                    </div>
                                    <div className="about-feature-highlight">
                                        <span className="material-icons-round">check_circle</span>
                                        Track action taken
                                    </div>
                                </div>
                            </div>
                            <div className="about-feature-image-wrap">
                                <img src="/images/suggestion-page.png" alt="Suggestion Page" className="about-feature-img" loading="lazy" />
                            </div>
                        </div>

                        {/* NGOs */}
                        <div className="about-feature-block about-animate">
                            <div className="about-feature-info">
                                <div className="about-feature-tag ngo">
                                    <span className="material-icons-round">corporate_fare</span> NGOs
                                </div>
                                <h3>Discover &amp; Connect with NGOs</h3>
                                <p>
                                    Browse a growing database of NGOs. Anyone can add NGO details, filter by city, connect via social media, and find organizations by their focus area.
                                </p>
                                <div className="about-feature-highlights">
                                    <div className="about-feature-highlight">
                                        <span className="material-icons-round">check_circle</span>
                                        Community-built NGO database
                                    </div>
                                    <div className="about-feature-highlight">
                                        <span className="material-icons-round">check_circle</span>
                                        City-based filtering
                                    </div>
                                    <div className="about-feature-highlight">
                                        <span className="material-icons-round">check_circle</span>
                                        Direct social media links
                                    </div>
                                    <div className="about-feature-highlight">
                                        <span className="material-icons-round">check_circle</span>
                                        Filter by focus area
                                    </div>
                                </div>
                            </div>
                            <div className="about-feature-image-wrap">
                                <img src="/images/ngos-page.png" alt="NGOs Page" className="about-feature-img" loading="lazy" />
                            </div>
                        </div>

                        {/* Events */}
                        <div className="about-feature-block reverse about-animate">
                            <div className="about-feature-info">
                                <div className="about-feature-tag event">
                                    <span className="material-icons-round">event</span> Events
                                </div>
                                <h3>Find &amp; Share Drive Events</h3>
                                <p>
                                    Many people want to join cleanup or plantation drives but aren't aware of them. Pin-It's events page solves this by centralizing all community drive information.
                                </p>
                                <div className="about-feature-highlights">
                                    <div className="about-feature-highlight">
                                        <span className="material-icons-round">check_circle</span>
                                        Add and share drive details
                                    </div>
                                    <div className="about-feature-highlight">
                                        <span className="material-icons-round">check_circle</span>
                                        Search by city
                                    </div>
                                    <div className="about-feature-highlight">
                                        <span className="material-icons-round">check_circle</span>
                                        Date &amp; time filtering
                                    </div>
                                    <div className="about-feature-highlight">
                                        <span className="material-icons-round">check_circle</span>
                                        Comprehensive event details
                                    </div>
                                </div>
                            </div>
                            <div className="about-feature-image-wrap">
                                <img src="/images/events-page.png" alt="Events Page" className="about-feature-img" loading="lazy" />
                            </div>
                        </div>

                        {/* Leaderboard */}
                        <div className="about-feature-block about-animate">
                            <div className="about-feature-info">
                                <div className="about-feature-tag leaderboard">
                                    <span className="material-icons-round">emoji_events</span> Leaderboard
                                </div>
                                <h3>Recognition &amp; Statistics</h3>
                                <p>
                                    See top contributors across daily, weekly, monthly, and yearly timeframes. Plus, get a bird's-eye view of platform stats — total users, pins, NGOs, events, and more.
                                </p>
                                <div className="about-feature-highlights">
                                    <div className="about-feature-highlight">
                                        <span className="material-icons-round">check_circle</span>
                                        Daily, weekly, monthly, yearly rankings
                                    </div>
                                    <div className="about-feature-highlight">
                                        <span className="material-icons-round">check_circle</span>
                                        Platform statistics at a glance
                                    </div>
                                    <div className="about-feature-highlight">
                                        <span className="material-icons-round">check_circle</span>
                                        Gamification &amp; rewards
                                    </div>
                                </div>
                            </div>
                            <div className="about-feature-image-wrap">
                                <img src="/images/leaderboard-page.png" alt="Leaderboard Page" className="about-feature-img" loading="lazy" />
                            </div>
                        </div>

                        {/* Discord */}
                        <div className="about-feature-block reverse about-animate">
                            <div className="about-feature-info">
                                <div className="about-feature-tag discord">
                                    <span className="material-icons-round">forum</span> Community
                                </div>
                                <h3>Join the Discussion on Discord</h3>
                                <p>
                                    Connect with the community on Discord! Share how you can contribute, find useful resources, and get inspired by stories from fellow volunteers.
                                </p>
                                <div className="about-feature-highlights">
                                    <div className="about-feature-highlight">
                                        <span className="material-icons-round">check_circle</span>
                                        #i-can-contribute-as channel
                                    </div>
                                    <div className="about-feature-highlight">
                                        <span className="material-icons-round">check_circle</span>
                                        #useful-info resources
                                    </div>
                                    <div className="about-feature-highlight">
                                        <span className="material-icons-round">check_circle</span>
                                        #inspirational-stories
                                    </div>
                                </div>
                            </div>
                            <div className="about-feature-image-wrap">
                                <img src="/images/discord.png" alt="Discord Community" className="about-feature-img" loading="lazy" />
                            </div>
                        </div>

                    </div>
                </div>
            </section>

            {/* ===== VERIFICATION ===== */}
            <section className="about-verification-section">
                <div className="about-section">
                    <div className="about-section-header about-animate">
                        <div className="about-section-eyebrow">
                            <span className="material-icons-round">verified</span> Systems
                        </div>
                        <h2 className="about-section-title">Verification &amp; Resolution</h2>
                        <p className="about-section-desc">
                            A trust-based system where different user roles contribute different verification scores, and issues follow a clear resolution workflow.
                        </p>
                    </div>

                    <div className="about-verification-grid about-animate">
                        <div className="about-verify-card">
                            <h3>
                                <span className="material-icons-round" style={{ color: '#2dd4a8' }}>verified_user</span>
                                Verification Scores
                            </h3>
                            <p style={{ color: '#94a3b8', marginBottom: '1.25rem', fontSize: '0.9rem' }}>
                                Pins need a score &gt; 80 to be verified. Each role contributes:
                            </p>
                            <div className="about-verify-roles">
                                <div className="about-verify-role">
                                    <div className="about-verify-role-info">
                                        <span className="about-verify-role-emoji">👤</span>
                                        <span className="about-verify-role-name">User</span>
                                    </div>
                                    <span className="about-verify-role-score">+10 pts</span>
                                </div>
                                <div className="about-verify-role">
                                    <div className="about-verify-role-info">
                                        <span className="about-verify-role-emoji">🔍</span>
                                        <span className="about-verify-role-name">Reviewer</span>
                                    </div>
                                    <span className="about-verify-role-score">+30 pts</span>
                                </div>
                                <div className="about-verify-role">
                                    <div className="about-verify-role-info">
                                        <span className="about-verify-role-emoji">🏢</span>
                                        <span className="about-verify-role-name">NGO</span>
                                    </div>
                                    <span className="about-verify-role-score">+50 pts</span>
                                </div>
                                <div className="about-verify-role">
                                    <div className="about-verify-role-info">
                                        <span className="about-verify-role-emoji">👑</span>
                                        <span className="about-verify-role-name">Admin</span>
                                    </div>
                                    <span className="about-verify-role-score">+60 pts</span>
                                </div>
                            </div>
                        </div>

                        <div className="about-verify-card">
                            <h3>
                                <span className="material-icons-round" style={{ color: '#3498db' }}>timeline</span>
                                Fix Status Workflow
                            </h3>
                            <p style={{ color: '#94a3b8', marginBottom: '1.25rem', fontSize: '0.9rem' }}>
                                Each issue progresses through a clear pipeline:
                            </p>
                            <div className="about-status-flow">
                                <div className="about-status-step">
                                    <div className="about-status-dot reported">📍</div>
                                    <div className="about-status-info">
                                        <h4>Reported</h4>
                                        <p>Initial state when the pin is created</p>
                                    </div>
                                </div>
                                <div className="about-status-step">
                                    <div className="about-status-dot verified">✅</div>
                                    <div className="about-status-info">
                                        <h4>Verified</h4>
                                        <p>Verification score exceeds 80</p>
                                    </div>
                                </div>
                                <div className="about-status-step">
                                    <div className="about-status-dot awaiting">⏳</div>
                                    <div className="about-status-info">
                                        <h4>Awaiting</h4>
                                        <p>Waiting for an event/drive to be scheduled</p>
                                    </div>
                                </div>
                                <div className="about-status-step">
                                    <div className="about-status-dot scheduled">📅</div>
                                    <div className="about-status-info">
                                        <h4>Scheduled</h4>
                                        <p>An NGO has scheduled an event for the fix</p>
                                    </div>
                                </div>
                                <div className="about-status-step">
                                    <div className="about-status-dot resolved">✨</div>
                                    <div className="about-status-info">
                                        <h4>Resolved</h4>
                                        <p>Issue has been fixed and marked as resolved</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ===== NGO DRIVES ===== */}
            <section className="about-drives-section">
                <div className="about-section">
                    <div className="about-section-header about-animate">
                        <div className="about-section-eyebrow">
                            <span className="material-icons-round">volunteer_activism</span> NGO Drives
                        </div>
                        <h2 className="about-section-title">Types of Community Drives</h2>
                        <p className="about-section-desc">
                            NGOs organize a variety of drives to address civic issues. Here's what you can participate in.
                        </p>
                    </div>

                    <div className="about-drives-grid about-animate">
                        <div className="about-drive-card">
                            <span className="about-drive-emoji">🧹</span>
                            <h4>Cleanup Drives</h4>
                            <p>Parks, grounds, rivers, and lakes</p>
                        </div>
                        <div className="about-drive-card">
                            <span className="about-drive-emoji">🌱</span>
                            <h4>Plantation Drives</h4>
                            <p>Tree planting initiatives</p>
                        </div>
                        <div className="about-drive-card">
                            <span className="about-drive-emoji">🎨</span>
                            <h4>Painting Drives</h4>
                            <p>Removing posters, painting walls</p>
                        </div>
                        <div className="about-drive-card">
                            <span className="about-drive-emoji">🕳️</span>
                            <h4>Pothole Fix Drives</h4>
                            <p>Road repair initiatives</p>
                        </div>
                        <div className="about-drive-card">
                            <span className="about-drive-emoji">📢</span>
                            <h4>Awareness Drives</h4>
                            <p>Spreading civic awareness</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* ===== GAMIFICATION ===== */}
            <section className="about-gamification-section">
                <div className="about-section">
                    <div className="about-section-header about-animate">
                        <div className="about-section-eyebrow">
                            <span className="material-icons-round">military_tech</span> Gamification
                        </div>
                        <h2 className="about-section-title">Levels &amp; Badges</h2>
                        <p className="about-section-desc">
                            Stay motivated with a rewarding level system and achievement badges for your contributions.
                        </p>
                    </div>

                    <div className="about-gamification-grid about-animate">
                        <div className="about-levels-card">
                            <h3>
                                <span className="material-icons-round" style={{ color: '#f1c40f' }}>emoji_events</span>
                                Level System
                            </h3>
                            <div className="about-levels-list">
                                <div className="about-level-item">
                                    <span className="about-level-badge">🥉</span>
                                    <div className="about-level-info">
                                        <span>Level 1</span>
                                        <span>Bronze</span>
                                    </div>
                                </div>
                                <div className="about-level-item">
                                    <span className="about-level-badge">🥈</span>
                                    <div className="about-level-info">
                                        <span>Level 2</span>
                                        <span>Silver</span>
                                    </div>
                                </div>
                                <div className="about-level-item">
                                    <span className="about-level-badge">🥇</span>
                                    <div className="about-level-info">
                                        <span>Level 3</span>
                                        <span>Gold</span>
                                    </div>
                                </div>
                                <div className="about-level-item">
                                    <span className="about-level-badge">💎</span>
                                    <div className="about-level-info">
                                        <span>Level 4</span>
                                        <span>Platinum</span>
                                    </div>
                                </div>
                                <div className="about-level-item">
                                    <span className="about-level-badge">👑</span>
                                    <div className="about-level-info">
                                        <span>Level 5</span>
                                        <span>Diamond</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="about-badges-card">
                            <h3>
                                <span className="material-icons-round" style={{ color: '#e67e22' }}>workspace_premium</span>
                                Achievement Badges
                            </h3>
                            <div className="about-badges-list">
                                <div className="about-badge-item">
                                    <span className="about-badge-emoji">🏆</span>
                                    <span className="about-badge-name">Top Contributor</span>
                                </div>
                                <div className="about-badge-item">
                                    <span className="about-badge-emoji">⭐</span>
                                    <span className="about-badge-name">Active Volunteer</span>
                                </div>
                                <div className="about-badge-item">
                                    <span className="about-badge-emoji">🌱</span>
                                    <span className="about-badge-name">Eco Warrior</span>
                                </div>
                                <div className="about-badge-item">
                                    <span className="about-badge-emoji">🔥</span>
                                    <span className="about-badge-name">Streak Master</span>
                                </div>
                                <div className="about-badge-item">
                                    <span className="about-badge-emoji">📸</span>
                                    <span className="about-badge-name">Photo Reporter</span>
                                </div>
                                <div className="about-badge-item">
                                    <span className="about-badge-emoji">💬</span>
                                    <span className="about-badge-name">Community Voice</span>
                                </div>
                                <div className="about-badge-item">
                                    <span className="about-badge-emoji">🗺️</span>
                                    <span className="about-badge-name">Explorer</span>
                                </div>
                                <div className="about-badge-item">
                                    <span className="about-badge-emoji">🤝</span>
                                    <span className="about-badge-name">Collaborator</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ===== PWA INSTALL ===== */}
            <section className="about-pwa-section">
                <div className="about-section">
                    <div className="about-section-header about-animate">
                        <div className="about-section-eyebrow">
                            <span className="material-icons-round">install_mobile</span> Install
                        </div>
                        <h2 className="about-section-title">Install as App (PWA)</h2>
                        <p className="about-section-desc">
                            Pin-It works as a Progressive Web App — install it on any device for a native app-like experience.
                        </p>
                    </div>

                    <div className="about-pwa-content about-animate">
                        <div className="about-pwa-info">
                            <h3>Available on All Platforms</h3>
                            <p>
                                No app store needed. Install Pin-It directly from your browser and get instant access on your home screen.
                            </p>
                            <div className="about-pwa-platforms">
                                <div className="about-pwa-platform">
                                    <span className="about-pwa-platform-emoji">🤖</span>
                                    <span className="about-pwa-platform-name">Android</span>
                                </div>
                                <div className="about-pwa-platform">
                                    <span className="about-pwa-platform-emoji">🍎</span>
                                    <span className="about-pwa-platform-name">iOS</span>
                                </div>
                                <div className="about-pwa-platform">
                                    <span className="about-pwa-platform-emoji">💻</span>
                                    <span className="about-pwa-platform-name">Windows</span>
                                </div>
                                <div className="about-pwa-platform">
                                    <span className="about-pwa-platform-emoji">🍎</span>
                                    <span className="about-pwa-platform-name">Mac</span>
                                </div>
                            </div>
                        </div>
                        <div className="about-pwa-install-instructions">
                            <div className="about-install-method">
                                <h4>
                                    <span className="material-icons-round" style={{ color: '#2dd4a8', fontSize: '1.1rem' }}>smartphone</span>
                                    On Mobile
                                </h4>
                                <p>
                                    Tap the <strong>"Install"</strong> button below the "Join Discussion" link in the navigation bar.
                                </p>
                            </div>
                            <div className="about-install-method">
                                <h4>
                                    <span className="material-icons-round" style={{ color: '#3498db', fontSize: '1.1rem' }}>computer</span>
                                    On Desktop
                                </h4>
                                <p>
                                    Look for the <strong>install icon</strong> in your browser's address bar and click it to install Pin-It as a desktop app.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ===== FINAL CTA ===== */}
            <section className="about-final-cta">
                <div className="about-final-cta-content">
                    <p className="about-final-cta-quote">
                        "It's our nation and it's our responsibility to make it green and clean."
                    </p>
                    <h2>Ready to Make a<br />Difference?</h2>
                    <p>
                        Join Pin-It today and be part of a growing community of citizens and NGOs working together for cleaner, greener neighborhoods.
                    </p>
                    <div className="about-final-cta-actions">
                        <button className="about-cta-btn about-cta-primary" onClick={() => handleProtectedAction('/', 'Start Pinning Issues')}>
                            <span className="material-icons-round">location_on</span>
                            Start Pinning Issues
                        </button>
                        <button className="about-cta-btn about-cta-secondary" onClick={() => handleProtectedAction('/ngos', 'Explore NGOs')}>
                            <span className="material-icons-round">corporate_fare</span>
                            Explore NGOs
                        </button>
                        <button className="about-cta-btn about-cta-secondary" onClick={() => handleProtectedAction('/events', 'Find Events')}>
                            <span className="material-icons-round">event</span>
                            Find Events
                        </button>
                    </div>
                    <div className="about-final-cta-emoji-row">
                        <div className="about-final-cta-emoji-item">
                            <span>📍</span>
                            <span>Report Issues</span>
                        </div>
                        <div className="about-final-cta-emoji-item">
                            <span>🤝</span>
                            <span>Join Drives</span>
                        </div>
                        <div className="about-final-cta-emoji-item">
                            <span>🌱</span>
                            <span>Make a Difference</span>
                        </div>
                    </div>
                </div>
            </section>

            {/* ===== FOOTER ===== */}
            <footer className="about-footer">
                <p>
                    Made with <span className="about-heart">❤️</span> for a cleaner, greener tomorrow
                </p>
            </footer>

            {/* ===== LOGIN INFO TOAST ===== */}
            <Toast
                visible={toast.visible}
                message={toast.message}
                type="info"
                autoHideMs={5000}
                onClose={hideToast}
                position="top-center"
            />

        </div>
    );
}

export default About;
