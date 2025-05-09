// src/App.jsx

import React, { useState } from 'react'; // Import useState if you plan to use it (e.g., for dark mode)
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

// Import your layout components
import Header from './components/layout/Header.jsx'; // Assuming .jsx extension
import Footer from './components/layout/Footer.jsx'; // Assuming .jsx extension

// Import your page components
import DashboardPage from './pages/DashboardPage.jsx'; // Assuming .jsx extension
import StockDetailPage from './pages/StockDetailPage.jsx'; // Assuming .jsx extension

// Import your main CSS file
import './App.css';

function App() {
  // Optional: State for dark mode toggle (you can implement the logic later)
  const [darkMode, setDarkMode] = useState(false);

  const toggleDarkMode = () => {
    setDarkMode(prevMode => !prevMode);
    // This is a simple way to toggle a class on the body.
    // For more robust theming with UI libraries like MUI, you'd use their ThemeProvider.
    if (!darkMode) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
  };

  return (
    <Router>
      <div className={`app ${darkMode ? 'dark-mode-active' : ''}`}> {/* Use a distinct class for active dark mode */}
        <Header darkMode={darkMode} toggleDarkMode={toggleDarkMode} />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/stock/:tickerSymbol" element={<StockDetailPage />} />
            {/* You can add more routes here later if needed, e.g., for a settings page */}
          </Routes>
        </main>
        <Footer />
      </div>
    </Router>
  );
}

export default App;