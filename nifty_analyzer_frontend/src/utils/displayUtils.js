// src/utils/displayUtils.js

// --- DMA Signal Configuration ---
export const SHORT_WINDOW = 20;
export const LONG_WINDOW = 50;

// Mapping from backend signal string to UI display alias
export const signalDisplayAliases = {
  'STRONG BUY': 'Strong Buy',
  'RECENT BUY': 'Recent Buy',
  'BUY (Uptrend)': 'Buy Trend',
  'POTENTIAL BUY / RECOVERY': 'Potential Buy', // Used by StockDetailPage for alias
  'NEUTRAL / SIDEWAYS': 'Neutral',
  'POTENTIAL SELL / DECLINE': 'Potential Sell', // Used by StockDetailPage for alias
  'SELL (Downtrend)': 'Sell Trend',
  'RECENT SELL': 'Recent Sell',
  'STRONG SELL': 'Strong Sell',
  'INITIAL': 'Initial Data',
  'N/A (Data)': 'N/A (Data)',
  'N/A (Logic)': 'N/A (Signal)',
  // Add any other signals your backend might produce to ensure they have an alias
};

// The sort order for the dropdown and column sort in DashboardPage, uses backend's full names
export const signalSortOrder = [
  'STRONG BUY', 'RECENT BUY', 'BUY (Uptrend)', 'POTENTIAL BUY / RECOVERY',
  'NEUTRAL / SIDEWAYS',
  'POTENTIAL SELL / DECLINE', 'SELL (Downtrend)', 'RECENT SELL', 'STRONG SELL',
  'INITIAL', 'N/A (Data)', 'N/A (Logic)',
];

// --- Styling & Formatting Utilities ---

// Helper function for CSS classes based on signal (used by DashboardPage and StockDetailPage)
export const getSignalClassName = (signal) => {
    if (!signal) return 'signal-na';
    const s = signal.toUpperCase(); // Normalize
    if (s.includes('STRONG BUY')) return 'signal-strong-buy';
    if (s.includes('RECENT BUY')) return 'signal-recent-buy';
    // Use specific classes for potential signals if defined in CSS
    if (s.includes('POTENTIAL BUY') || s.includes('RECOVERY')) return 'signal-potential-buy'; 
    if (s.includes('BUY')) return 'signal-buy';

    if (s.includes('STRONG SELL')) return 'signal-strong-sell';
    if (s.includes('RECENT SELL')) return 'signal-recent-sell';
    if (s.includes('POTENTIAL SELL') || s.includes('DECLINE')) return 'signal-potential-sell';
    if (s.includes('SELL')) return 'signal-sell';
    
    if (s.includes('NEUTRAL') || s.includes('SIDEWAYS')) return 'signal-neutral';
    if (s.includes('INITIAL') || s.includes('N/A')) return 'signal-na'; // Catches "N/A (Data)", "N/A (Logic)"
    return 'signal-default'; // Fallback
};

// Helper function for CSS classes based on price change (used by DashboardPage and StockDetailPage)
export const getPriceChangeClassName = (change) => {
    const numChange = parseFloat(change);
    if (numChange > 0) return 'price-up';
    if (numChange < 0) return 'price-down';
    return 'price-neutral';
};

// Formats large numbers (e.g., Market Cap, Volume) (used by StockDetailPage)
export const formatMarketCap = (mc) => {
    if (mc === null || mc === undefined || isNaN(parseFloat(mc))) return 'N/A'; // Check for invalid inputs
    const numMc = parseFloat(mc);
    if (numMc >= 1e12) return `${(numMc / 1e12).toFixed(2)} Tn`; // Trillion
    if (numMc >= 1e7) return `${(numMc / 1e7).toFixed(2)} Cr`;   // Crore
    if (numMc >= 1e5) return `${(numMc / 1e5).toFixed(2)} L`;    // Lakh
    return numMc.toLocaleString(); // Default for smaller numbers
};

// Formats date strings (used by StockDetailPage for news and last crossover)
export const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
        const date = new Date(dateString);
        // Check if date is valid after parsing
        if (isNaN(date.getTime())) {
            // If it's already in a simple YYYY-MM-DD format, just return it or a formatted version
            // This regex checks for YYYY-MM-DD
            if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
                 const [year, month, day] = dateString.split('-');
                 // Simple reformat to DD Mon YYYY without full Date object if needed
                 const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
                 return `${day} ${monthNames[parseInt(month, 10) - 1]} ${year}`;
            }
            return dateString; // Return original if not a valid date string pattern we handle
        }
        // 'en-IN' for India, 'en-GB' for UK-style DD/MM/YYYY, 'en-US' for US-style MM/DD/YYYY
        return date.toLocaleDateString('en-IN', { 
            year: 'numeric', 
            month: 'short', // 'short' (e.g., Sep), 'long' (e.g., September), 'numeric' (e.g., 9)
            day: 'numeric'  // 'numeric' (e.g., 5), '2-digit' (e.g., 05)
        });
    } catch (e) {
        console.warn("Error formatting date:", dateString, e);
        return dateString; // Fallback to original string if formatting fails
    }
};