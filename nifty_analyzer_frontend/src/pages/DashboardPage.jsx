// src/pages/DashboardPage.jsx

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
// Ensure getStockQuickUpdates is imported
import { getStockOverviewData, getStockQuickUpdates } from '../services/apiService.js';


// --- Signal Configuration ---
const signalDisplayAliases = {
  'STRONG BUY': 'Strong Buy',
  'RECENT BUY': 'Recent Buy',
  'BUY (Uptrend)': 'Buy Trend',
  'POTENTIAL BUY / RECOVERY': 'Potential Buy',
  'NEUTRAL / SIDEWAYS': 'Neutral',
  'POTENTIAL SELL / DECLINE': 'Potential Sell',
  'SELL (Downtrend)': 'Sell Trend',
  'RECENT SELL': 'Recent Sell',
  'STRONG SELL': 'Strong Sell',
  'INITIAL': 'Initial Data',
  'N/A (Data)': 'N/A (Data)',
  'N/A (Logic)': 'N/A (Signal)',
};

const signalSortOrder = [
  'STRONG BUY', 'RECENT BUY', 'BUY (Uptrend)', 'POTENTIAL BUY / RECOVERY',
  'NEUTRAL / SIDEWAYS',
  'POTENTIAL SELL / DECLINE', 'SELL (Downtrend)', 'RECENT SELL', 'STRONG SELL',
  'INITIAL', 'N/A (Data)', 'N/A (Logic)',
];
// --- End Signal Configuration ---

// Simple Loading and Error components
const LoadingSpinner = () => <div style={{ textAlign: 'center', padding: '20px', fontSize: '1.2em' }}>Loading stocks...</div>;
const ErrorMessage = ({ message }) => <div style={{ textAlign: 'center', padding: '20px', fontSize: '1.2em', color: 'red' }}>Error: {message}</div>;


const DashboardPage = () => {
  const [allStocks, setAllStocks] = useState([]);
  const [isFullLoading, setIsFullLoading] = useState(true); // For full data load/recalc
  const [isQuickLoading, setIsQuickLoading] = useState(false); // For price updates
  const [error, setError] = useState(null); // General error for the page

  const [searchTerm, setSearchTerm] = useState('');
  const [signalFilter, setSignalFilter] = useState('All Signals'); // Stores the backend signal string
  const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'ascending' });

  // Fetches full overview data (signals, SMAs, prices)
  const fetchFullData = useCallback(async (forceClientCacheBypass = false) => {
    setIsFullLoading(true);
    setIsQuickLoading(false); 
    setError(null);
    try {
      // getStockOverviewData(true) will bypass client-side cache
      const data = await getStockOverviewData(forceClientCacheBypass); 
      setAllStocks(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("DashboardPage full fetch error:", err);
      setError(err.message || 'Failed to fetch full stock data.');
      setAllStocks([]);
    } finally {
      setIsFullLoading(false);
    }
  }, []); // Empty dependency array as it doesn't depend on component state here

  // Fetches only quick updates (CMP, day change, volume)
  const fetchQuickUpdates = useCallback(async () => {
    if (allStocks.length === 0 && !isFullLoading) { 
        // If no base data loaded yet, and not already doing a full load, perform a full load instead.
        // This prevents quick refresh on an empty table making little sense.
        console.log("No base data for quick refresh, initiating full data load.");
        fetchFullData(true); 
        return;
    }
    if (isFullLoading) return; // Don't quick refresh if a full refresh is already in progress

    setIsQuickLoading(true);
    // setError(null); // Optionally clear general error, or keep it if it's from a full load
    let quickUpdateError = null; // Specific error for this operation

    try {
      const quickUpdates = await getStockQuickUpdates();
      if (Array.isArray(quickUpdates)) {
        setAllStocks(prevStocks => {
          // Create a map for faster lookups of quick updates
          const updatesMap = new Map();
          quickUpdates.forEach(u => {
            if (u && u.ticker && !u.error) { // Only consider valid updates
                updatesMap.set(u.ticker, u);
            } else if (u && u.error) {
                console.warn(`Quick update for ${u.ticker} failed: ${u.errorMessage}`);
            }
          });

          return prevStocks.map(stock => {
            const update = updatesMap.get(stock.ticker);
            if (update) {
              return {
                ...stock, 
                name: update.name || stock.name, // Backend quick info also sends name
                cmp: update.cmp,
                dayChangePercent: update.dayChangePercent,
                dayChangeAbs: update.dayChangeAbs,
                volume: update.volume,
              };
            }
            return stock; 
          });
        });
        // If some individual quick updates had errors, we might want to inform the user subtly
        // For now, console warnings are handling it.
      }
    } catch (err) {
      console.error("DashboardPage quick update API error:", err);
      quickUpdateError = err.message || 'Failed to fetch price updates.';
      setError(quickUpdateError); // Set the general error if quick update fails significantly
    } finally {
      setIsQuickLoading(false);
    }
  }, [allStocks, fetchFullData, isFullLoading]); // Dependencies for useCallback

  // Initial data load
  useEffect(() => {
    fetchFullData(false); // Don't force client cache bypass on initial mount
  }, [fetchFullData]); // fetchData is memoized

  // Memoized unique signal types for the filter dropdown
  const uniqueSignalTypesForFilter = useMemo(() => {
    if (!allStocks || allStocks.length === 0) return [];
    const signalsSet = new Set(allStocks.map(stock => stock.dmaSignal).filter(Boolean));
    let presentSignals = Array.from(signalsSet);

    presentSignals.sort((a, b) => {
      let indexA = signalSortOrder.indexOf(a);
      let indexB = signalSortOrder.indexOf(b);
      if (indexA === -1) indexA = Infinity;
      if (indexB === -1) indexB = Infinity;
      if (indexA !== Infinity && indexB !== Infinity) return indexA - indexB;
      if (indexA !== Infinity) return -1;
      if (indexB !== Infinity) return 1;
      return a.localeCompare(b);
    });
    
    const filterOptions = presentSignals.map(signal => ({
        value: signal,
        label: signalDisplayAliases[signal] || signal 
    }));

    return [{ value: 'All Signals', label: 'All Signals' }, ...filterOptions];
  }, [allStocks]);

  // Memoized derivation of filtered and sorted stocks
  const filteredAndSortedStocks = useMemo(() => {
    let processedStocks = [...allStocks];

    if (searchTerm) {
      const lowerSearchTerm = searchTerm.toLowerCase();
      processedStocks = processedStocks.filter(stock =>
        (stock.name && stock.name.toLowerCase().includes(lowerSearchTerm)) ||
        (stock.ticker && stock.ticker.toLowerCase().includes(lowerSearchTerm))
      );
    }

    if (signalFilter !== 'All Signals') {
      processedStocks = processedStocks.filter(stock => stock.dmaSignal === signalFilter);
    }

    if (sortConfig.key) {
      processedStocks.sort((a, b) => {
        let valA = a[sortConfig.key];
        let valB = b[sortConfig.key];
        const numericKeys = ['cmp', 'dayChangePercent', 'dayChangeAbs', 'volume', 'smaShort', 'smaLong'];
        
        if (sortConfig.key === 'dmaSignal') {
            let indexA = signalSortOrder.indexOf(valA);
            let indexB = signalSortOrder.indexOf(valB);
            if (indexA === -1) indexA = Infinity;
            if (indexB === -1) indexB = Infinity;
            valA = indexA;
            valB = indexB;
        } else if (numericKeys.includes(sortConfig.key)) {
          valA = parseFloat(valA) || (sortConfig.direction === 'ascending' ? Infinity : -Infinity);
          valB = parseFloat(valB) || (sortConfig.direction === 'ascending' ? Infinity : -Infinity);
        } else {
          valA = String(valA || '').toLowerCase();
          valB = String(valB || '').toLowerCase();
        }

        if (valA < valB) return sortConfig.direction === 'ascending' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'ascending' ? 1 : -1;
        return 0;
      });
    }
    return processedStocks;
  }, [allStocks, searchTerm, signalFilter, sortConfig]);

  const requestSort = (key) => {
    let direction = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const getSignalClassName = (signal) => {
    if (!signal) return 'signal-na';
    const s = signal.toUpperCase();
    if (s.includes('STRONG BUY')) return 'signal-strong-buy';
    if (s.includes('RECENT BUY')) return 'signal-recent-buy';
    if (s.includes('POTENTIAL BUY') || s.includes('RECOVERY')) return 'signal-potential-buy';
    if (s.includes('BUY')) return 'signal-buy';
    if (s.includes('STRONG SELL')) return 'signal-strong-sell';
    if (s.includes('RECENT SELL')) return 'signal-recent-sell';
    if (s.includes('POTENTIAL SELL') || s.includes('DECLINE')) return 'signal-potential-sell';
    if (s.includes('SELL')) return 'signal-sell';
    if (s.includes('NEUTRAL') || s.includes('SIDEWAYS')) return 'signal-neutral';
    if (s.includes('INITIAL') || s.includes('N/A')) return 'signal-na';
    return 'signal-default';
  };

  const getPriceChangeClassName = (change) => {
    const numChange = parseFloat(change);
    if (numChange > 0) return 'price-up';
    if (numChange < 0) return 'price-down';
    return 'price-neutral';
  };

  // Show main spinner only if it's a full load and no stocks are displayed yet
  if (isFullLoading && allStocks.length === 0) return <LoadingSpinner />;
  // Show error only if it's a significant error and no stocks are displayed
  if (error && allStocks.length === 0) return <ErrorMessage message={error} />;

  return (
    <div className="dashboard-page">
      <h2>Nifty 50 Stock Overview</h2>
      {error && <ErrorMessage message={error} /> /* Show error above filters if it occurs after initial load */}
      <div className="filters-container">
        <input
          type="text"
          placeholder="Search by Name or Ticker..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />
        <select
          value={signalFilter} 
          onChange={(e) => setSignalFilter(e.target.value)}
          className="signal-filter"
        >
          {uniqueSignalTypesForFilter.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        
        <button 
          onClick={fetchQuickUpdates} 
          className="refresh-button quick-refresh-button"
          disabled={isQuickLoading || isFullLoading} // Disable if any load is in progress
        >
          {isQuickLoading ? 'Updating Prices...' : 'Refresh Prices'}
        </button>
        <button 
          onClick={() => fetchFullData(true)} // Pass true to bypass client cache
          className="refresh-button full-refresh-button"
          disabled={isFullLoading || isQuickLoading} // Disable if any load is in progress
        >
          {isFullLoading && !isQuickLoading ? 'Recalculating All...' : 'Recalculate All'}
        </button>
      </div>

      {/* Conditional rendering for the table or no data message */}
      {(!isFullLoading || allStocks.length > 0) && filteredAndSortedStocks.length > 0 ? (
        <div className="stock-table-container">
          <table>
            <thead>
              <tr>
                {[
                  { key: 'ticker', label: 'Ticker' },
                  { key: 'name', label: 'Company Name' },
                  { key: 'cmp', label: 'CMP' },
                  { key: 'dayChangePercent', label: 'Day Change (%)' },
                  { key: 'volume', label: 'Volume' },
                  { key: 'dmaSignal', label: 'DMA Signal' },
                  { key: 'lastSignalDate', label: 'Last Signal Dt.' },
                  { key: 'smaShort', label: 'SMA Short' },
                  { key: 'smaLong', label: 'SMA Long' },
                ].map((column) => (
                  <th key={column.key} onClick={() => requestSort(column.key)}>
                    {column.label}
                    {sortConfig.key === column.key ? (sortConfig.direction === 'ascending' ? ' ▲' : ' ▼') : ''}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>{
              filteredAndSortedStocks.map((stock) => (
                <tr key={stock.ticker}>
                  <td><Link to={`/stock/${stock.ticker}`}>{stock.ticker}</Link></td>
                  <td><Link to={`/stock/${stock.ticker}`}>{stock.name}</Link></td>
                  <td className={getPriceChangeClassName(stock.dayChangeAbs)}>{stock.cmp?.toFixed(2) ?? 'N/A'}</td>
                  <td className={getPriceChangeClassName(stock.dayChangePercent)}>{stock.dayChangePercent?.toFixed(2) ?? 'N/A'}%</td>
                  <td>{stock.volume?.toLocaleString() ?? 'N/A'}</td>
                  <td>
                    <span 
                        className={`signal-badge ${getSignalClassName(stock.dmaSignal)}`}
                        title={stock.dmaSignal} 
                    >
                      {signalDisplayAliases[stock.dmaSignal] || stock.dmaSignal}
                    </span>
                  </td>
                  <td>{stock.lastSignalDate ?? 'N/A'}</td>
                  <td>{stock.smaShort?.toFixed(2) ?? 'N/A'}</td>
                  <td>{stock.smaLong?.toFixed(2) ?? 'N/A'}</td>
                </tr>
              ))
            }</tbody>
          </table>
        </div>
      ) : (
         !isFullLoading && // Only show "no data" if not in the middle of a full load
         <p style={{ textAlign: 'center', padding: '20px' }}>
            {allStocks.length === 0 && !error ? 'No stock data available. Is the backend running?' : 'No stocks match your current filters.'}
        </p>
      )}
    </div>
  );
};

export default DashboardPage;