// src/components/layout/Header.jsx

import React from 'react';
import { Link } from 'react-router-dom';

const Header = ({ darkMode, toggleDarkMode }) => {
  return (
    <header className="app-header">
      <div className="logo-container">
        <Link to="/" className="logo-link">
          <h1>Nifty DMA Analyzer</h1>
        </Link>
      </div>
      <div className="header-actions">
        <button onClick={toggleDarkMode} className="theme-toggle-button">
          {darkMode ? '☀️ Light Mode' : '🌙 Dark Mode'}
        </button>
      </div>
    </header>
  );
};

export default Header;