// src/components/layout/Footer.jsx

import React from 'react';

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="app-footer">
      <p>
        © {currentYear} Nifty DMA Analyzer. All Rights Reserved.
      </p>
      <p className="footer-disclaimer">
        Data primarily sourced from Yahoo Finance (via yfinance library for backend).
        Signals and analysis are for educational and informational purposes only and do not constitute financial advice.
        Past performance is not indicative of future results. Always do your own research before investing.
        Project By Siddhant Singh Bisht 
      </p>
    </footer>
  );
};

export default Footer;