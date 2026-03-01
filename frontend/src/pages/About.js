import React from 'react';
import { useNavigate } from 'react-router-dom';
import { DISCORD_INVITE_URL } from '../config';
import './About.css';

function About() {
  const navigate = useNavigate();

  return (
    <div className="about-page">
      {/* Hero Section */}
      <section className="about-hero">
        <div className="about-hero-content">
          <div className="about-hero-icon">📍</div>
          <h1 className="about-hero-title">Pin-It</h1>
          <p className="about-hero-tagline">Pin any civic issue in your locality/surrounding to the map.</p>
        </div>
      </section>

      {/* About Section */}
      <section className="about-section">
        <div className="about-container">
          <h2 className="about-section-title">
            <span className="about-section-icon">🎯</span>
            About Pin-It
          </h2>
          <p className="about-description">
            Pin-It is a civic-issue reporting platform where citizens can drop geo-located pins on a map to report local problems. NGOs and people can then help in fixing these issues.
          </p>

          {/* Issue Types */}
          <div className="about-issues-grid">
            <h3 className="about-subtitle">Types of Issues You Can Report</h3>
            <div className="about-cards-grid">
              <div className="about-issue-card">
                <span className="about-issue-icon">🗑️</span>
                <h4>Trash Pile</h4>
                <p>Accumulated garbage in an area</p>
              </div>
              <div className="about-issue-card">
                <span className="about-issue-icon">🕳️</span>
                <h4>Pothole</h4>
                <p>Road damage and potholes</p>
              </div>
              <div className="about-issue-card">
                <span className="about-issue-icon">🌊</span>
                <h4>Garbage in Water Bodies</h4>
                <p>Pollution in rivers, lakes, etc.</p>
              </div>
              <div className="about-issue-card">
                <span className="about-issue-icon">🐕</span>
                <h4>Stray Animal Colony</h4>
                <p>Areas with stray animal issues</p>
              </div>
              <div className="about-issue-card">
                <span className="about-issue-icon">💡</span>
                <h4>Broken Infrastructure</h4>
                <p>Broken pipes, fuse street lights</p>
              </div>
              <div className="about-issue-card">
                <span className="about-issue-icon">➕</span>
                <h4>And More</h4>
                <p>Any civic issue in your surroundings</p>
              </div>
            </div>
          </div>

          {/* How It Works */}
          <div className="about-how-it-works">
            <h3 className="about-subtitle">How It Works</h3>
            <div className="about-steps">
              <div className="about-step">
                <div className="about-step-number">1</div>
                <div className="about-step-content">
                  <h4>Drop the pin</h4>
                  <p>Click on the map to mark the location</p>
                </div>
              </div>
              <div className="about-step">
                <div className="about-step-number">2</div>
                <div className="about-step-content">
                  <h4>Add details</h4>
                  <p>Describe the problem</p>
                </div>
              </div>
              <div className="about-step">
                <div className="about-step-number">3</div>
                <div className="about-step-content">
                  <h4>Attach photos</h4>
                  <p>Add images to the pin</p>
                </div>
              </div>
              <div className="about-step">
                <div className="about-step-number">4</div>
                <div className="about-step-content">
                  <h4>Post it</h4>
                  <p>For NGOs and people to see and help</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Why Pin-It Section */}
      <section className="about-section about-why-section">
        <div className="about-container">
          <h2 className="about-section-title">
            <span className="about-section-icon">💡</span>
            Why Pin-It?
          </h2>
          
          <div className="about-highlight-box">
            <p className="about-highlight-text">
              <strong>So, this website I made for NGO's and people specific only, not for government specific.</strong>
            </p>
          </div>

          <div className="about-gov-examples">
            <p>Government have website as well for reporting issue like that.</p>
            <div className="about-gov-links">
              <a href="https://www.pgportal.gov.in" target="_blank" rel="noopener noreferrer" className="about-gov-link">
                <span className="material-icons-round">link</span>
                CPGRAMS (Centralized Public Grievance Redress and Monitoring System)
              </a>
              <span className="about-gov-item">Swachhata App (MoHUA)</span>
              <span className="about-gov-item">National Government Services Portal</span>
            </div>
          </div>

          <div className="about-quotes">
            <blockquote className="about-quote">
              <p>Because, it's not government who is throwing the trash anywhere and causing the litter. It's us who are creating the problem. And so, it's our equal responsibility as well to make surrounding clean.</p>
            </blockquote>
            <blockquote className="about-quote">
              <p>Once people take part in such drive and work on ground - they will realise how big is the problem. And they will definitely stop doing litter and they will also stop others if to do so. This awareness creates a ripple effect. So, everyone should join the clean-up drives (or other drives) at-least once.</p>
            </blockquote>
          </div>

          {/* Problem & Solution */}
          <div className="about-problem-solution">
            <div className="about-problem">
              <h3 className="about-subtitle">The Problem</h3>
              <ul className="about-list">
                <li>Many NGOs conduct drives (cleanups, plantations, painting, etc.) but struggle to find locations</li>
                <li>Low volunteer participation in some cities</li>
                <li>Lack of awareness about ongoing drives</li>
              </ul>
            </div>
            <div className="about-solution">
              <h3 className="about-subtitle">The Solution</h3>
              <p className="about-solution-intro">Pin-It helps in:</p>
              <ul className="about-check-list">
                <li><span className="about-check">✅</span> Marking and finding issues nearby</li>
                <li><span className="about-check">✅</span> Connecting people and NGOs together</li>
                <li><span className="about-check">✅</span> Fixing problems collaboratively</li>
                <li><span className="about-check">✅</span> Spreading awareness</li>
              </ul>
            </div>
          </div>

          {/* NGO Drives */}
          <div className="about-drives">
            <h3 className="about-subtitle">Types of NGO Drives</h3>
            <div className="about-drives-grid">
              <div className="about-drive-card">
                <span className="about-drive-icon">🧹</span>
                <h4>Cleanup Drives</h4>
                <p>Parks, grounds, rivers, lakes</p>
              </div>
              <div className="about-drive-card">
                <span className="about-drive-icon">🌱</span>
                <h4>Plantation Drives</h4>
                <p>Tree planting initiatives</p>
              </div>
              <div className="about-drive-card">
                <span className="about-drive-icon">🎨</span>
                <h4>Painting Drives</h4>
                <p>Removing posters, painting walls/pillars</p>
              </div>
              <div className="about-drive-card">
                <span className="about-drive-icon">🕳️</span>
                <h4>Pothole Fix Drives</h4>
                <p>Road repair initiatives</p>
              </div>
              <div className="about-drive-card">
                <span className="about-drive-icon">📢</span>
                <h4>Awareness Drives</h4>
                <p>Spreading awareness about civic issues</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="about-section about-features-section">
        <div className="about-container">
          <h2 className="about-section-title">
            <span className="about-section-icon">✨</span>
            Features
          </h2>

          {/* Map Page */}
          <div className="about-feature-block">
            <div className="about-feature-header">
              <span className="about-feature-icon">🗺️</span>
              <h3>Map Page</h3>
            </div>
            <div className="about-feature-content">
              <p className="about-feature-desc">The main interface for interacting with civic issues.</p>
              <div className="about-feature-table">
                <div className="about-feature-row">
                  <div className="about-feature-name">Pin an Issue</div>
                  <div className="about-feature-desc-cell">Click the "Pin an Issue" button (bottom-left) to add a new civic issue</div>
                </div>
                <div className="about-feature-row">
                  <div className="about-feature-name">View Pins Panel</div>
                  <div className="about-feature-desc-cell">Click the arrow "side" on the right to open the side panel listing all pins</div>
                </div>
                <div className="about-feature-row">
                  <div className="about-feature-name">Pin Details</div>
                  <div className="about-feature-desc-cell">Click on any pin to view full details</div>
                </div>
                <div className="about-feature-row">
                  <div className="about-feature-name">Card View Toggle</div>
                  <div className="about-feature-desc-cell">Switch between small and large card views</div>
                </div>
                <div className="about-feature-row">
                  <div className="about-feature-name">Filters</div>
                  <div className="about-feature-desc-cell">Filter pins by type, saved status, date, time, likes, etc.</div>
                </div>
              </div>
            </div>
          </div>

          {/* Pin Details */}
          <div className="about-feature-block">
            <div className="about-feature-header">
              <span className="about-feature-icon">📌</span>
              <h3>Pin Details</h3>
            </div>
            <div className="about-feature-content">
              <p className="about-feature-desc">Comprehensive information about each reported issue.</p>
              
              <h4 className="about-feature-subtitle">Information Displayed</h4>
              <div className="about-info-grid">
                <div className="about-info-item"><strong>Heading</strong> - Title of the issue</div>
                <div className="about-info-item"><strong>Description</strong> - Detailed description of the problem</div>
                <div className="about-info-item"><strong>Before Images</strong> - Photos showing the issue</div>
                <div className="about-info-item"><strong>After Images</strong> - Photos showing resolution</div>
                <div className="about-info-item"><strong>Verification Status</strong> - Whether the pin is verified</div>
                <div className="about-info-item"><strong>Severity</strong> - Scale of 1-10 (low to high)</div>
                <div className="about-info-item"><strong>Likes/Dislikes</strong> - Community engagement</div>
                <div className="about-info-item"><strong>Date of Publish</strong> - When the issue was pinned</div>
                <div className="about-info-item"><strong>Location</strong> - Address, latitude & longitude</div>
              </div>

              <h4 className="about-feature-subtitle">Verification System</h4>
              <p className="about-feature-desc">Pins need a verification score greater than 80 to be verified. Different user roles contribute different scores:</p>
              <div className="about-verification-table">
                <div className="about-verification-row">
                  <span className="about-verification-role">👤 User</span>
                  <span className="about-verification-score">10 points</span>
                </div>
                <div className="about-verification-row">
                  <span className="about-verification-role">🔍 Reviewer</span>
                  <span className="about-verification-score">30 points</span>
                </div>
                <div className="about-verification-row">
                  <span className="about-verification-role">🏢 NGO</span>
                  <span className="about-verification-score">50 points</span>
                </div>
                <div className="about-verification-row">
                  <span className="about-verification-role">👑 Admin</span>
                  <span className="about-verification-score">60 points</span>
                </div>
              </div>

              <h4 className="about-feature-subtitle">Fix Status Workflow</h4>
              <div className="about-workflow">
                <div className="about-workflow-step">
                  <span className="about-workflow-icon">📍</span>
                  <span>Reported</span>
                </div>
                <span className="about-workflow-arrow">→</span>
                <div className="about-workflow-step">
                  <span className="about-workflow-icon">✅</span>
                  <span>Verified</span>
                </div>
                <span className="about-workflow-arrow">→</span>
                <div className="about-workflow-step">
                  <span className="about-workflow-icon">⏳</span>
                  <span>Awaiting</span>
                </div>
                <span className="about-workflow-arrow">→</span>
                <div className="about-workflow-step">
                  <span className="about-workflow-icon">📅</span>
                  <span>Scheduled</span>
                </div>
                <span className="about-workflow-arrow">→</span>
                <div className="about-workflow-step">
                  <span className="about-workflow-icon">✨</span>
                  <span>Resolved</span>
                </div>
              </div>

              <h4 className="about-feature-subtitle">Additional Features</h4>
              <ul className="about-feature-list">
                <li><strong>Mark as Resolved:</strong> Score-based system to verify resolution</li>
                <li><strong>Comments:</strong> Nested comments up to 3 levels with like, dislike, and reply options</li>
              </ul>
            </div>
          </div>

          {/* Profile Page */}
          <div className="about-feature-block">
            <div className="about-feature-header">
              <span className="about-feature-icon">👤</span>
              <h3>Profile Page</h3>
            </div>
            <div className="about-feature-content">
              <p className="about-feature-desc">Track your contributions and achievements.</p>
              
              <h4 className="about-feature-subtitle">User Statistics</h4>
              <ul className="about-feature-list">
                <li>📊 Contribution stats</li>
                <li>🎖️ User role (User, Reviewer, NGO, Admin)</li>
                <li>📍 Number of pins, events, NGOs, suggestions, comments, likes, etc.</li>
              </ul>

              <h4 className="about-feature-subtitle">Level System</h4>
              <p className="about-feature-desc">Based on contribution score, users achieve levels (1-5):</p>
              <div className="about-levels">
                <div className="about-level"><span className="about-level-badge">🥉</span> Level 1 - Bronze</div>
                <div className="about-level"><span className="about-level-badge">🥈</span> Level 2 - Silver</div>
                <div className="about-level"><span className="about-level-badge">🥇</span> Level 3 - Gold</div>
                <div className="about-level"><span className="about-level-badge">💎</span> Level 4 - Platinum</div>
                <div className="about-level"><span className="about-level-badge">👑</span> Level 5 - Diamond</div>
              </div>

              <h4 className="about-feature-subtitle">Badges Section</h4>
              <p className="about-feature-desc">Gamification badges to motivate contributions:</p>
              <div className="about-badges">
                <span className="about-badge">🏆 Top Contributor</span>
                <span className="about-badge">⭐ Active Volunteer</span>
                <span className="about-badge">🌱 Eco Warrior</span>
                <span className="about-badge">And more...</span>
              </div>
            </div>
          </div>

          {/* Suggestion Page */}
          <div className="about-feature-block">
            <div className="about-feature-header">
              <span className="about-feature-icon">💬</span>
              <h3>Suggestion Page</h3>
            </div>
            <div className="about-feature-content">
              <p className="about-feature-desc">Share your ideas to improve Pin-It.</p>
              
              <h4 className="about-feature-subtitle">Suggestion Types</h4>
              <div className="about-suggestion-types">
                <div className="about-suggestion-type">
                  <span className="about-suggestion-icon">🚀</span>
                  <span>Feature Request</span>
                </div>
                <div className="about-suggestion-type">
                  <span className="about-suggestion-icon">🎨</span>
                  <span>UI Change</span>
                </div>
                <div className="about-suggestion-type">
                  <span className="about-suggestion-icon">🐛</span>
                  <span>Bug Report</span>
                </div>
                <div className="about-suggestion-type">
                  <span className="about-suggestion-icon">⚡</span>
                  <span>Improvement</span>
                </div>
              </div>
            </div>
          </div>

          {/* NGOs Page */}
          <div className="about-feature-block">
            <div className="about-feature-header">
              <span className="about-feature-icon">🏢</span>
              <h3>NGOs Page</h3>
            </div>
            <div className="about-feature-content">
              <p className="about-feature-desc">Discover and connect with NGOs.</p>
              
              <div className="about-feature-grid">
                <div className="about-feature-item">
                  <strong>Add NGO</strong>
                  <p>Anyone can add NGO details to expand the database</p>
                </div>
                <div className="about-feature-item">
                  <strong>City Filter</strong>
                  <p>Filter NGOs by city to find local organizations</p>
                </div>
                <div className="about-feature-item">
                  <strong>Social Media Links</strong>
                  <p>Connect with NGOs directly</p>
                </div>
                <div className="about-feature-item">
                  <strong>NGO Types</strong>
                  <p>Find NGOs by focus area (trash, plants, potholes, animals, etc.)</p>
                </div>
              </div>

              <h4 className="about-feature-subtitle">Benefits</h4>
              <ul className="about-check-list">
                <li><span className="about-check">🤝</span> Increase NGO database</li>
                <li><span className="about-check">📍</span> Find NGOs in your city</li>
                <li><span className="about-check">🔗</span> Facilitate collaboration</li>
                <li><span className="about-check">👥</span> Gather more volunteers</li>
                <li><span className="about-check">🌍</span> Create greater impact</li>
              </ul>
            </div>
          </div>

          {/* Events Page */}
          <div className="about-feature-block">
            <div className="about-feature-header">
              <span className="about-feature-icon">📅</span>
              <h3>Events Page</h3>
            </div>
            <div className="about-feature-content">
              <p className="about-feature-desc">Find and share drive events.</p>
              
              <div className="about-highlight-box about-highlight-box--small">
                <p>Many people want to join NGO drives but aren't aware of events happening in their area.</p>
              </div>

              <div className="about-feature-grid">
                <div className="about-feature-item">
                  <strong>Add Events</strong>
                  <p>Share drive details if you know about upcoming events</p>
                </div>
                <div className="about-feature-item">
                  <strong>Search Database</strong>
                  <p>Find drives in your city</p>
                </div>
                <div className="about-feature-item">
                  <strong>Date/Time Filter</strong>
                  <p>Filter by desired date and time</p>
                </div>
                <div className="about-feature-item">
                  <strong>Event Details</strong>
                  <p>Full information about each drive</p>
                </div>
              </div>

              <h4 className="about-feature-subtitle">Impact</h4>
              <ul className="about-check-list">
                <li><span className="about-check">📢</span> Create awareness</li>
                <li><span className="about-check">👥</span> More people join the cause</li>
                <li><span className="about-check">🗺️</span> Centralized event database</li>
              </ul>
            </div>
          </div>

          {/* Leaderboard Page */}
          <div className="about-feature-block">
            <div className="about-feature-header">
              <span className="about-feature-icon">🏆</span>
              <h3>Leaderboard Page</h3>
            </div>
            <div className="about-feature-content">
              <p className="about-feature-desc">Two sections for recognition and statistics.</p>
              
              <div className="about-leaderboard-sections">
                <div className="about-leaderboard-section">
                  <h4 className="about-feature-subtitle">🥇 Leaderboard</h4>
                  <p>Top contributors recognized for their efforts.</p>
                  <div className="about-timeframes">
                    <span className="about-timeframe">Daily</span>
                    <span className="about-timeframe">Weekly</span>
                    <span className="about-timeframe">Monthly</span>
                    <span className="about-timeframe">Yearly</span>
                  </div>
                  <p className="about-feature-desc"><strong>Purpose:</strong></p>
                  <ul className="about-feature-list">
                    <li>🎖️ Recognition for contributors</li>
                    <li>🎮 Gamification element</li>
                    <li>💪 Motivation to contribute</li>
                    <li>🎁 Potential rewards for top users</li>
                  </ul>
                </div>
                <div className="about-leaderboard-section">
                  <h4 className="about-feature-subtitle">📊 Platform at a Glance</h4>
                  <p>Pin-It website statistics:</p>
                  <div className="about-stats-grid">
                    <div className="about-stat"><span className="about-stat-icon">👥</span> Total Users</div>
                    <div className="about-stat"><span className="about-stat-icon">🟢</span> Active Users</div>
                    <div className="about-stat"><span className="about-stat-icon">📍</span> Total Pins</div>
                    <div className="about-stat"><span className="about-stat-icon">🏢</span> Total NGOs</div>
                    <div className="about-stat"><span className="about-stat-icon">📅</span> Total Events</div>
                    <div className="about-stat"><span className="about-stat-icon">💡</span> Suggestions</div>
                    <div className="about-stat"><span className="about-stat-icon">✅</span> Pins Resolved</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Discord Section */}
          <div className="about-feature-block">
            <div className="about-feature-header">
              <span className="about-feature-icon">💬</span>
              <h3>Join Discussion (Discord)</h3>
            </div>
            <div className="about-feature-content">
              <p className="about-feature-desc">Connect with the community!</p>
              
              <a href={DISCORD_INVITE_URL} target="_blank" rel="noopener noreferrer" className="about-discord-btn">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                </svg>
                Join Discussion
              </a>

              <h4 className="about-feature-subtitle">Discord Channels</h4>
              <div className="about-channels">
                <div className="about-channel">
                  <code>#i-can-contribute-as</code>
                  <p>Share how you can help (Volunteer, Video Editor, Speaker, Event Organizer, Social Media Handler, etc.)</p>
                </div>
                <div className="about-channel">
                  <code>#useful-info</code>
                  <p>Helpful resources and information</p>
                </div>
                <div className="about-channel">
                  <code>#inspirational-stories</code>
                  <p>Stories to inspire the community</p>
                </div>
              </div>

              <blockquote className="about-quote about-quote--small">
                <p>Similar in future will add more useful "#channels" to grow the community and connect more people NGO's and people.</p>
              </blockquote>
            </div>
          </div>

          {/* Install as App */}
          <div className="about-feature-block">
            <div className="about-feature-header">
              <span className="about-feature-icon">📱</span>
              <h3>Install as App</h3>
            </div>
            <div className="about-feature-content">
              <p className="about-feature-desc">Pin-It can be installed as a Progressive Web App (PWA).</p>
              
              <h4 className="about-feature-subtitle">Supported Platforms</h4>
              <div className="about-platforms">
                <div className="about-platform"><span className="about-platform-icon">🤖</span> Android</div>
                <div className="about-platform"><span className="about-platform-icon">🍎</span> iOS</div>
                <div className="about-platform"><span className="about-platform-icon">💻</span> Windows</div>
                <div className="about-platform"><span className="about-platform-icon">🍎</span> Mac</div>
              </div>

              <h4 className="about-feature-subtitle">How to Install</h4>
              <div className="about-install-instructions">
                <div className="about-install-item">
                  <strong>Mobile:</strong>
                  <p>Tap "Install" button below "Join Discussion" in the navbar</p>
                </div>
                <div className="about-install-item">
                  <strong>Desktop:</strong>
                  <p>Click the install icon in the browser's address bar</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Get Involved Section */}
      <section className="about-section about-cta-section">
        <div className="about-container">
          <h2 className="about-section-title">
            <span className="about-section-icon">🌟</span>
            Get Involved
          </h2>
          <blockquote className="about-quote about-quote--large">
            <p>"It's our nation and it's our responsibility to make it green and clean."</p>
          </blockquote>
          <p className="about-cta-text">Join Pin-It today and be part of the change!</p>
          <div className="about-cta-actions">
            <div className="about-cta-item">
              <span className="about-cta-icon">📍</span>
              <span>Report issues in your locality</span>
            </div>
            <div className="about-cta-item">
              <span className="about-cta-icon">🤝</span>
              <span>Join NGO drives</span>
            </div>
            <div className="about-cta-item">
              <span className="about-cta-icon">🌱</span>
              <span>Make a difference</span>
            </div>
          </div>
          <button className="about-cta-btn" onClick={() => navigate('/')}>
            Get Started
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="about-footer">
        <div className="about-container">
          <p>Made with ❤️ for a cleaner, greener tomorrow</p>
        </div>
      </footer>
    </div>
  );
}

export default About;