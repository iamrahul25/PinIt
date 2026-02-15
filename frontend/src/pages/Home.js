import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Home.css';

function Home() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');

  const handleGetStarted = () => {
    navigate('/login');
  };

  const handleScrollToFeatures = () => {
    const featuresSection = document.getElementById('features');
    if (featuresSection) {
      featuresSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleNewsletterSignup = (e) => {
    e.preventDefault();
    alert('Thank you for your interest! We\'ll keep you updated.');
    setEmail('');
  };

  return (
    <div className="home-container">
      {/* Navigation Bar */}
      <nav className="home-navbar">
        <div className="home-nav-content">
          <div className="home-logo">
            <span className="material-icons-round home-logo-icon">push_pin</span>
            <span className="home-logo-text">Pin-It</span>
          </div>
          <button className="home-nav-cta" onClick={handleGetStarted}>
            Get Started
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="home-hero">
        <div className="home-hero-content">
          <div className="home-hero-text">
            <h1 className="home-hero-title">
              Empower Your Community,<br />
              <span className="home-gradient-text">One Pin at a Time</span>
            </h1>
            <p className="home-hero-subtitle">
              PinIt is a community-driven platform where citizens report and track civic issues in real-time. From broken streetlights to potholes, help your neighborhood become better together.
            </p>
            <div className="home-hero-buttons">
              <button className="home-btn home-btn-primary" onClick={handleGetStarted}>
                Start Reporting Issues
              </button>
              <button className="home-btn home-btn-secondary" onClick={handleScrollToFeatures}>
                Learn More
              </button>
            </div>
          </div>
          <div className="home-hero-visual">
            <div className="home-hero-illustration">
              {/* Central Circle */}
              <div className="home-illus-center">
                <span className="material-icons-round home-illus-center-icon">public</span>
              </div>

              {/* Floating Elements */}
              <div className="home-illus-element home-illus-element-1">
                <span className="material-icons-round">location_on</span>
              </div>
              <div className="home-illus-element home-illus-element-2">
                <span className="material-icons-round">people</span>
              </div>
              <div className="home-illus-element home-illus-element-3">
                <span className="material-icons-round">sentiment_very_satisfied</span>
              </div>
              <div className="home-illus-element home-illus-element-4">
                <span className="material-icons-round">check_circle</span>
              </div>
              <div className="home-illus-element home-illus-element-5">
                <span className="material-icons-round">lightbulb</span>
              </div>
              <div className="home-illus-element home-illus-element-6">
                <span className="material-icons-round">handshake</span>
              </div>

              {/* Animated Background Circles */}
              <div className="home-illus-bg-circle home-illus-bg-1"></div>
              <div className="home-illus-bg-circle home-illus-bg-2"></div>
              <div className="home-illus-bg-circle home-illus-bg-3"></div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="home-stats">
        <div className="home-stats-grid">
          <div className="home-stat-card">
            <h3 className="home-stat-number">1000+</h3>
            <p className="home-stat-label">Issues Reported</p>
          </div>
          <div className="home-stat-card">
            <h3 className="home-stat-number">500+</h3>
            <p className="home-stat-label">Issues Resolved</p>
          </div>
          <div className="home-stat-card">
            <h3 className="home-stat-number">50+</h3>
            <p className="home-stat-label">NGO Partners</p>
          </div>
          <div className="home-stat-card">
            <h3 className="home-stat-number">10k+</h3>
            <p className="home-stat-label">Active Community Members</p>
          </div>
        </div>
      </section>

      {/* Key Features Section */}
      <section id="features" className="home-features">
        <div className="home-section-header">
          <h2 className="home-section-title">What You Can Do With PinIt</h2>
          <p className="home-section-subtitle">Everything you need to make a difference in your community</p>
        </div>

        <div className="home-features-grid">
          {/* Feature 1 */}
          <div className="home-feature-card">
            <div className="home-feature-icon home-icon-red">
              <span className="material-icons-round">location_on</span>
            </div>
            <h3 className="home-feature-title">Report Issues</h3>
            <p className="home-feature-desc">
              Pin problems you find in your neighborhood - broken roads, lights, utilities, or any civic issue. Include photos and detailed descriptions.
            </p>
            <ul className="home-feature-list">
              <li>Add location on interactive map</li>
              <li>Attach photos & evidence</li>
              <li>Categorize issue type</li>
              <li>Set urgency level</li>
            </ul>
          </div>

          {/* Feature 2 */}
          <div className="home-feature-card">
            <div className="home-feature-icon home-icon-blue">
              <span className="material-icons-round">visibility</span>
            </div>
            <h3 className="home-feature-title">Track Progress</h3>
            <p className="home-feature-desc">
              Monitor the status of reported issues in real-time. See which issues have been acknowledged, are under repair, or are resolved.
            </p>
            <ul className="home-feature-list">
              <li>Real-time status updates</li>
              <li>Timeline of activities</li>
              <li>Official department responses</li>
              <li>Resolution confirmation</li>
            </ul>
          </div>

          {/* Feature 3 */}
          <div className="home-feature-card">
            <div className="home-feature-icon home-icon-green">
              <span className="material-icons-round">favorite</span>
            </div>
            <h3 className="home-feature-title">Community Support</h3>
            <p className="home-feature-desc">
              Vote and comment on issues you care about. Upvote critical problems to help prioritize repairs and get faster action.
            </p>
            <ul className="home-feature-list">
              <li>Vote on issues</li>
              <li>Post comments & suggestions</li>
              <li>Connect with neighbors</li>
              <li>Share solutions</li>
            </ul>
          </div>

          {/* Feature 4 */}
          <div className="home-feature-card">
            <div className="home-feature-icon home-icon-purple">
              <span className="material-icons-round">people</span>
            </div>
            <h3 className="home-feature-title">NGO Collaboration</h3>
            <p className="home-feature-desc">
              Connect with NGOs and organizations already working in your area. Get help from specialized entities for specific issues.
            </p>
            <ul className="home-feature-list">
              <li>Browse partner NGOs</li>
              <li>Direct communication</li>
              <li>View their projects</li>
              <li>Join initiatives</li>
            </ul>
          </div>

          {/* Feature 5 */}
          <div className="home-feature-card">
            <div className="home-feature-icon home-icon-yellow">
              <span className="material-icons-round">event</span>
            </div>
            <h3 className="home-feature-title">Community Events</h3>
            <p className="home-feature-desc">
              Organize and participate in community clean-ups, awareness campaigns, and civic action events in your neighborhood.
            </p>
            <ul className="home-feature-list">
              <li>Create events</li>
              <li>RSVP to activities</li>
              <li>Join cleanup drives</li>
              <li>Share updates</li>
            </ul>
          </div>

          {/* Feature 6 */}
          <div className="home-feature-card">
            <div className="home-feature-icon home-icon-cyan">
              <span className="material-icons-round">lightbulb</span>
            </div>
            <h3 className="home-feature-title">Share Ideas</h3>
            <p className="home-feature-desc">
              Post suggestions and innovative solutions for community problems. Vote on ideas and help prioritize community improvements.
            </p>
            <ul className="home-feature-list">
              <li>Submit suggestions</li>
              <li>Rate ideas</li>
              <li>Discuss solutions</li>
              <li>Track implementation</li>
            </ul>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="home-how-it-works">
        <div className="home-section-header">
          <h2 className="home-section-title">How PinIt Works</h2>
          <p className="home-section-subtitle">Simple steps to make a real difference</p>
        </div>

        <div className="home-steps-container">
          <div className="home-step">
            <div className="home-step-number">1</div>
            <h3 className="home-step-title">Create Account</h3>
            <p className="home-step-desc">Sign up using your Google account in seconds. No lengthy forms or verification needed.</p>
          </div>

          <div className="home-step-arrow">
            <span className="material-icons-round">arrow_forward</span>
          </div>

          <div className="home-step">
            <div className="home-step-number">2</div>
            <h3 className="home-step-title">Pin an Issue</h3>
            <p className="home-step-desc">Click on the map, describe the problem, add photos, and let your community know about it.</p>
          </div>

          <div className="home-step-arrow">
            <span className="material-icons-round">arrow_forward</span>
          </div>

          <div className="home-step">
            <div className="home-step-number">3</div>
            <h3 className="home-step-title">Community Engagement</h3>
            <p className="home-step-desc">Others vote, comment, and suggest solutions. Your voice amplifies when others support it.</p>
          </div>

          <div className="home-step-arrow">
            <span className="material-icons-round">arrow_forward</span>
          </div>

          <div className="home-step">
            <div className="home-step-number">4</div>
            <h3 className="home-step-title">Real Impact</h3>
            <p className="home-step-desc">Authorities and NGOs act, update progress, and resolve issues. You track it all in real-time.</p>
          </div>
        </div>
      </section>

      {/* Call to Action Section */}
      <section className="home-cta">
        <div className="home-cta-content">
          <h2 className="home-cta-title">Ready to Make a Difference?</h2>
          <p className="home-cta-desc">
            Join thousands of citizens and organizations already using PinIt to build better communities.
          </p>
          <button className="home-btn home-btn-primary home-btn-large" onClick={handleGetStarted}>
            Get Started Today
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="home-footer">
        <p className="home-footer-copyright">
          &copy; 2026 PinIt. All rights reserved. | Empowering Communities, One Pin at a Time.
        </p>
      </footer>
    </div>
  );
}

export default Home;
