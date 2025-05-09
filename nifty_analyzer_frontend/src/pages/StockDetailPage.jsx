// src/pages/StockDetailPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link as RouterLink } from 'react-router-dom';
import { getStockDetailData, getSingleStockQuickInfo } from '../services/apiService.js';

// Import utilities from your utils file
import {
    signalDisplayAliases,
    getSignalClassName,
    getPriceChangeClassName,
    formatMarketCap,
    formatDate,
    SHORT_WINDOW,
    LONG_WINDOW
} from '../utils/displayUtils.js'; // Adjust path if necessary
// --- IMPORT CHART COMPONENT ---
import StockPriceChart from '../components/StockPriceChart.jsx';


// Components (Consider moving these to separate files: src/components/LoadingSpinner.jsx, etc.)
const LoadingSpinner = () => <div className="loading-spinner" style={{ textAlign: 'center', padding: '20px', fontSize: '1.2em' }}>Loading stock details...</div>;
const ErrorMessage = ({ message }) => <div className="error-message" style={{ textAlign: 'center', padding: '20px', fontSize: '1.2em', color: 'red' }}>Error: {message}</div>;

// Helper Component for Financial Tables
// (Keep this here or move to src/components/FinancialTable.jsx and import)
const FinancialTable = ({ title, data, columnsToShow = null }) => {
    if (!data || data.length === 0) {
        // Optionally return null instead of text if you prefer cleaner look for missing tables
        // return null; 
        return <p style={{fontSize: '0.9em', fontStyle: 'italic'}}>No {title} data available.</p>;
    }
    const allKeys = Object.keys(data[0]);
    // Ensure 'Period' is always first if it exists
    let displayColumns = columnsToShow ? ['Period', ...columnsToShow.filter(col => col !== 'Period' && allKeys.includes(col))] : allKeys;
    // Filter out columns that don't exist in the data (handles cases where yfinance data varies)
    displayColumns = displayColumns.filter(col => allKeys.includes(col));

    // If 'Period' wasn't included but exists, add it first
    if (!displayColumns.includes('Period') && allKeys.includes('Period')) {
        displayColumns.unshift('Period');
    }
    
    const formatFinancialNumber = (num) => { // Moved formatter inside component or import from utils
        if (num === null || num === undefined || isNaN(num)) return '-';
        const absNum = Math.abs(num);
        // Using Cr/L formatting for large numbers
        if (absNum >= 1e7) return `${(num / 1e7).toFixed(2)} Cr`;
        if (absNum >= 1e5) return `${(num / 1e5).toFixed(2)} L`;
        // Using localeString with controlled decimals for smaller/other numbers
        return num.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    };

    return (
        <div className="financial-table-container" style={{ marginBottom: '20px' }}> {/* Reduced bottom margin */}
            <h4 style={{ marginBottom: '10px' }}>{title}</h4>
            <div style={{ overflowX: 'auto' }}>
                <table className="financial-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8em' }}> {/* Slightly smaller font */}
                    <thead>
                        <tr style={{ borderBottom: '1px solid #dee2e6', backgroundColor: '#f8f9fa' }}>
                            {displayColumns.map(key => (
                                <th key={key} style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 600, whiteSpace: 'nowrap' }}>
                                    {/* Simple formatting for key names */}
                                    {key.replace(/([A-Z])/g, ' $1').replace(/Interest$/,'Int.').trim()} 
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {data.slice(0, 5).map((row, index) => ( // Limit to latest 5 periods maybe? Or make configurable
                            <tr key={index} style={{ borderBottom: '1px solid #eee' }}>
                                {displayColumns.map(key => (
                                    <td key={key} style={{ padding: '6px 8px', whiteSpace: 'nowrap', textAlign: (key === 'Period' ? 'left' : 'right') }}>
                                        {key === 'Period' ? formatDate(row[key]) : formatFinancialNumber(row[key])}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

// Main Page Component
const StockDetailPage = () => {
    const { tickerSymbol } = useParams();
    const [stockData, setStockData] = useState(null);
    const [isLoading, setIsLoading] = useState(true); // For initial full data load
    // **** ADD NEW STATE for quick price updates ****
    const [isPriceUpdating, setIsPriceUpdating] = useState(false);
    const [error, setError] = useState(null);
    
    const bodyHasDarkMode = document.body.classList.contains('dark-mode');


    // Renamed to fetchInitialData for clarity
    const fetchInitialData = useCallback(async (forceBackendRefresh = false) => {
        if (!tickerSymbol) return;
        setIsLoading(true); // This is for the main page load
        setError(null);
        try {
            const data = await getStockDetailData(tickerSymbol, forceBackendRefresh);
            setStockData(data);
        } catch (err) {
            setError(err.message || `Failed to fetch data for ${tickerSymbol}. Is the backend running?`);
            setStockData(null);
        } finally {
            setIsLoading(false);
        }
    }, [tickerSymbol]);

    // **** ADD NEW FUNCTION for fetching quick price updates ****
    const fetchPriceUpdate = useCallback(async () => {
        if (!tickerSymbol || !stockData || isLoading) return; // Don't run if no ticker, no initial data, or main load in progress

        setIsPriceUpdating(true); 
        try {
            const quickInfo = await getSingleStockQuickInfo(tickerSymbol);
            if (quickInfo && !quickInfo.error) {
                setStockData(prevData => {
                    if (!prevData) return null; 
                    return {
                        ...prevData,
                        currentMarketData: {
                            ...prevData.currentMarketData,
                            cmp: quickInfo.cmp,
                            dayChangeAbs: quickInfo.dayChangeAbs,
                            dayChangePercent: quickInfo.dayChangePercent,
                            volume: quickInfo.volume !== undefined ? quickInfo.volume : prevData.currentMarketData.volume,
                        },
                        info: { // Also update dayHigh/Low if your quickInfo provides it
                            ...prevData.info,
                            dayHigh: quickInfo.dayHigh !== undefined ? quickInfo.dayHigh : prevData.info.dayHigh,
                            dayLow: quickInfo.dayLow !== undefined ? quickInfo.dayLow : prevData.info.dayLow,
                        }
                    };
                });
            } else {
                console.warn(`Quick price update for ${tickerSymbol} failed or returned error:`, quickInfo?.errorMessage);
            }
        } catch (err) {
            console.warn(`Error during quick price update for ${tickerSymbol}:`, err.message);
        } finally {
            setIsPriceUpdating(false);
        }
    }, [tickerSymbol, stockData, isLoading]); // Add isLoading to dependencies

    // Effect for initial data load
    useEffect(() => {
        fetchInitialData(false);
    }, [fetchInitialData]); // fetchInitialData is memoized and depends on tickerSymbol

    // **** ADD NEW useEffect for periodic price updates ****
    useEffect(() => {
        if (!stockData || isLoading || error) {
            // Don't start interval if initial data isn't loaded, 
            // main loading is in progress, or there's a page error
            return;
        }

        const intervalId = setInterval(() => {
            fetchPriceUpdate();
        }, 10000); // Update every 10 seconds UPDATE TIMER in millisecond

        return () => clearInterval(intervalId); // Cleanup interval
    }, [stockData, isLoading, error, fetchPriceUpdate]); // Dependencies


    // Helper to display key-value pairs safely
    const renderInfoPair = (label, value, formatter = null) => {
        // ... (Your existing renderInfoPair function - NO CHANGES NEEDED HERE) ...
        const displayValue = formatter ? formatter(value) : (value ?? 'N/A');
        const hasValue = value !== null && value !== undefined && value !== '';
        return (<p style={{ margin: '4px 0', fontSize: '0.9em' }}><strong>{label}:</strong> {hasValue ? displayValue : 'N/A'}</p>);
    };


    // --- Render Logic ---
    if (isLoading) return <LoadingSpinner />;
    if (error) return <ErrorMessage message={error} />;
    if (!stockData || !stockData.info || !stockData.currentMarketData || !stockData.currentDma) {
        return (
            <div className="stock-detail-page-container" style={{ padding: '20px' }}>
                <ErrorMessage message={error || `Incomplete data received for ${tickerSymbol || 'this stock'}. Cannot display details.`} />
                <RouterLink to="/" className="btn btn-secondary mt-3">Back to Dashboard</RouterLink>
            </div>
        );
    }

    const { info, currentMarketData, currentDma, historicalData, financialStatements, dmaSignalsHistorical } = stockData;

    return (
        <div className="stock-detail-page-container" style={{ padding: '15px' }}>
            {/* --- Header Section --- */}
            <div className="stock-detail-header" style={{ marginBottom: '20px', borderBottom: '1px solid #eee', paddingBottom: '15px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                    <div>
                        <h1>{info.name || tickerSymbol} <span style={{ fontSize: '0.7em', color: '#6c757d', marginLeft: '10px' }}>({info.ticker})</span></h1>
                        <p style={{ margin: 0, color: '#495057', fontSize: '0.9em' }}>{info.sector || 'N/A'} {info.industry && ` - ${info.industry}`}</p>
                    </div>
                    <button 
                        onClick={() => fetchInitialData(true)} 
                        className="refresh-button" 
                        disabled={isLoading || isPriceUpdating} 
                        style={{ minWidth: '100px', whiteSpace: 'nowrap' }}
                    >
                        {isLoading && !isPriceUpdating ? 'Refreshing All...' : (isPriceUpdating ? 'Price Updating...' : 'Refresh Data')}
                    </button>
                </div>
            </div>

            {/* --- Market Snapshot & DMA Section --- */}
            <section className="market-snapshot-section" style={{ marginBottom: '30px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '15px' }}>
                    <div className="price-volume-card card-style">
                        <h4 style={{ marginTop: 0, marginBottom: '10px' }}>
                            Market Snapshot 
                            {isPriceUpdating && <span style={{fontSize: '0.7em', marginLeft: '10px', color: '#007bff', fontStyle: 'italic'}}>(Updating...)</span>}
                        </h4>
                        {/* Ensure CMP p tag has the class for color */}
                        <p 
                            className={`price-display ${getPriceChangeClassName(currentMarketData.dayChangeAbs)}`} 
                            style={{ fontSize: '1.8em', fontWeight: 'bold', margin: '5px 0' }}
                        >
                            ₹{currentMarketData.cmp?.toFixed(2) ?? 'N/A'}
                        </p>
                        <p 
                            style={{ margin: '5px 0' }} 
                            className={getPriceChangeClassName(currentMarketData.dayChangeAbs)}
                        >
                            Change: {currentMarketData.dayChangeAbs?.toFixed(2) ?? 'N/A'} ({currentMarketData.dayChangePercent?.toFixed(2) ?? 'N/A'}%)
                        </p>
                        <hr style={{ margin: '10px 0' }} />
                        {renderInfoPair("Volume", currentMarketData.volume, (v) => v?.toLocaleString())}
                        {renderInfoPair("Open", currentMarketData.openPrice?.toFixed(2))}
                        {renderInfoPair("Previous Close", currentMarketData.previousClosePrice?.toFixed(2))}
                        {renderInfoPair("Day Range", info.dayLow !== null && info.dayHigh !== null ? `${info.dayLow?.toFixed(2)} - ${info.dayHigh?.toFixed(2)}` : 'N/A')}
                        {renderInfoPair("52wk Range", info.fiftyTwoWeekLow !== null && info.fiftyTwoWeekHigh !== null ? `${info.fiftyTwoWeekLow?.toFixed(2)} - ${info.fiftyTwoWeekHigh?.toFixed(2)}` : 'N/A')}
                    </div>
                    <div className="dma-signal-card card-style">
                        <h4 style={{ marginTop: 0, marginBottom: '10px' }}>DMA Analysis</h4>
                        <p style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '4px 0' }}>
                            <strong>Signal:</strong>
                            <span className={`signal-badge ${getSignalClassName(currentDma.signal)}`} title={currentDma.signal} style={{ flexShrink: 0 }}>
                                {signalDisplayAliases[currentDma.signal] || currentDma.signal}
                            </span>
                        </p>
                        {renderInfoPair("Last Crossover", currentDma.lastCrossoverDate, formatDate)}
                        {renderInfoPair(`SMA ${SHORT_WINDOW}D`, currentDma.smaShortValue, (v) => v?.toFixed(2))}
                        {renderInfoPair(`SMA ${LONG_WINDOW}D`, currentDma.smaLongValue, (v) => v?.toFixed(2))}
                    </div>
                </div>
            </section>

            {/* --- Chart Section --- */}
            <section className="chart-section" style={{ marginBottom: '30px', borderTop: '1px solid #eee', paddingTop: '20px' }}>
                <h3>Price Chart</h3>
                <div className="card-style" style={{ padding: '5px' }}>
                   {historicalData && historicalData.length > 0 ? (
                       <StockPriceChart 
                           priceData={historicalData}
                           smaShortData={historicalData} // Pass full data
                           smaLongData={historicalData}  // Pass full data
                           volumeData={historicalData} // Pass full data
                           signalMarkers={dmaSignalsHistorical || []} 
                           darkMode={bodyHasDarkMode} // *** REPLACE WITH PROPER CONTEXT/PROP ***
                       />
                   ) : (
                       <div style={{ minHeight: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                          <p>No historical data available to display chart.</p>
                       </div>
                   )}
                </div>
            </section>

            {/* --- Key Metrics & Ratios Section --- */}
            <section className="key-metrics-section" style={{ marginBottom: '30px', borderTop: '1px solid #eee', paddingTop: '20px' }}>
                <h3>Key Metrics & Ratios</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '15px' }}>
                    <div className="valuation-card card-style">
                        <h4 style={{ marginTop: 0, marginBottom: '10px' }}>Valuation</h4>
                        {renderInfoPair("Market Cap", info.marketCap, formatMarketCap)}
                        {renderInfoPair("Enterprise Value", info.enterpriseValue, formatMarketCap)}
                        {renderInfoPair("Trailing P/E", info.trailingPE, (v) => v?.toFixed(2))}
                        {renderInfoPair("Forward P/E", info.forwardPE, (v) => v?.toFixed(2))}
                        {renderInfoPair("PEG Ratio", info.pegRatio, (v) => v?.toFixed(2))}
                        {renderInfoPair("Price/Book (P/B)", info.priceToBook, (v) => v?.toFixed(2))}
                        {renderInfoPair("EV/Revenue", info.enterpriseToRevenue, (v) => v?.toFixed(3))}
                        {renderInfoPair("EV/EBITDA", info.enterpriseToEbitda, (v) => v?.toFixed(2))}
                    </div>
                    <div className="profitability-card card-style">
                        <h4 style={{ marginTop: 0, marginBottom: '10px' }}>Profitability & Growth</h4>
                        {renderInfoPair("Profit Margin", info.profitMargins, (v) => v ? `${(v * 100).toFixed(2)}%` : 'N/A')}
                        {renderInfoPair("Operating Margin", info.operatingMargins, (v) => v ? `${(v * 100).toFixed(2)}%` : 'N/A')}
                        {renderInfoPair("Gross Margin", info.grossMargins, (v) => v ? `${(v * 100).toFixed(2)}%` : 'N/A')}
                        {renderInfoPair("EBITDA Margin", info.ebitdaMargins, (v) => v ? `${(v * 100).toFixed(2)}%` : 'N/A')}
                        {renderInfoPair("Return on Assets (ROA)", info.returnOnAssets, (v) => v ? `${(v * 100).toFixed(2)}%` : 'N/A')}
                        {renderInfoPair("Return on Equity (ROE)", info.returnOnEquity, (v) => v ? `${(v * 100).toFixed(2)}%` : 'N/A')}
                        {renderInfoPair("Revenue Growth (YoY)", info.revenueGrowth, (v) => v ? `${(v * 100).toFixed(2)}%` : 'N/A')}
                        {renderInfoPair("Earnings Growth (Qtr, YoY)", info.earningsQuarterlyGrowth, (v) => v ? `${(v * 100).toFixed(2)}%` : 'N/A')}
                    </div>
                    <div className="financial-health-card card-style">
                        <h4 style={{ marginTop: 0, marginBottom: '10px' }}>Financial Health</h4>
                        {renderInfoPair("Debt/Equity", info.debtToEquity, (v) => v?.toFixed(2))}
                        {renderInfoPair("Current Ratio", info.currentRatio, (v) => v?.toFixed(2))}
                        {renderInfoPair("Quick Ratio", info.quickRatio, (v) => v?.toFixed(2))}
                        {renderInfoPair("Total Cash", info.totalCash, formatMarketCap)}
                        {renderInfoPair("Total Debt", info.totalDebt, formatMarketCap)}
                    </div>
                    <div className="dividend-card card-style">
                        <h4 style={{ marginTop: 0, marginBottom: '10px' }}>Dividends</h4>
                        {renderInfoPair("Dividend Rate", info.dividendRate)}
                        {renderInfoPair("Dividend Yield", info.dividendYield, (v) => v ? `${(v * 100).toFixed(2)}%` : 'N/A')}
                        {renderInfoPair("5Y Avg Yield", info.fiveYearAvgDividendYield, (v) => v ? `${v.toFixed(2)}%` : 'N/A')}
                        {renderInfoPair("Payout Ratio", info.payoutRatio, (v) => v ? `${(v * 100).toFixed(1)}%` : 'N/A')}
                        {renderInfoPair("Ex-Dividend Date", info.exDividendDate, formatDate)}
                    </div>
                    <div className="share-stats-card card-style">
                        <h4 style={{ marginTop: 0, marginBottom: '10px' }}>Shareholding & Stats</h4>
                        {renderInfoPair("Beta", info.beta, (v) => v?.toFixed(2))}
                        {renderInfoPair("Shares Outstanding", info.sharesOutstanding, (v) => v?.toLocaleString())}
                        {renderInfoPair("Float Shares", info.floatShares, (v) => v?.toLocaleString())}
                        <hr style={{ margin: '10px 0' }} />
                        {renderInfoPair("% Held by Insiders", info.heldPercentInsiders, (v) => v ? `${(v * 100).toFixed(2)}%` : 'N/A')}
                        {renderInfoPair("% Held by Institutions", info.heldPercentInstitutions, (v) => v ? `${(v * 100).toFixed(2)}%` : 'N/A')}
                        <p style={{ marginTop: '10px', fontSize: '0.85em' }}>
                            <a href={`https://finance.yahoo.com/quote/${info.ticker}/holders`} target="_blank" rel="noopener noreferrer" title={`View detailed holders for ${info.ticker} on Yahoo Finance`}>
                                View Detailed Holders »
                            </a>
                        </p>
                    </div>
                    <div className="analyst-card card-style">
                        <h4 style={{ marginTop: 0, marginBottom: '10px' }}>Analyst Estimates</h4>
                        {renderInfoPair("Avg Target Price", info.targetMeanPrice, (v) => v?.toFixed(2))}
                        {renderInfoPair("High Target Price", info.targetHighPrice, (v) => v?.toFixed(2))}
                        {renderInfoPair("Low Target Price", info.targetLowPrice, (v) => v?.toFixed(2))}
                        {renderInfoPair("Recommendation", info.recommendationKey?.toUpperCase())}
                        {renderInfoPair("Mean Rec. (1=Buy,5=Sell)", info.recommendationMean, (v) => v?.toFixed(1))}
                        {renderInfoPair("# Analyst Opinions", info.numberOfAnalystOpinions)}
                    </div>
                </div>
            </section>

            {/* --- Financial Statements Section --- */}
            {/* Conditionally render based on existence of financialStatements object and at least one sub-key */}
            {financialStatements && Object.values(financialStatements).some(arr => arr && arr.length > 0) && (
                <section className="financials-section" style={{ marginBottom: '30px', borderTop: '1px solid #eee', paddingTop: '20px' }}>
                    <h3>Financial Statements</h3>
                    <div className="card-style"> {/* Wrap financials in a card */}
                        <FinancialTable
                            title="Income Statement (Annual)"
                            data={financialStatements.incomeStatementAnnual}
                            columnsToShow={['Total Revenue', 'Gross Profit', 'Operating Income', 'Net Income', 'Basic EPS']} // Added EPS
                        />
                        <FinancialTable
                            title="Income Statement (Quarterly)"
                            data={financialStatements.incomeStatementQuarterly}
                            columnsToShow={['Total Revenue', 'Gross Profit', 'Operating Income', 'Net Income', 'Basic EPS']}
                        />
                        <hr style={{ margin: '25px 0' }} />
                        <FinancialTable
                            title="Balance Sheet (Annual)"
                            data={financialStatements.balanceSheetAnnual}
                            columnsToShow={['Total Assets', 'Total Liabilities Net Minority Interest', 'Total Equity Gross Minority Interest', 'Total Debt', 'Cash And Cash Equivalents']}
                        />
                        <FinancialTable
                            title="Balance Sheet (Quarterly)"
                            data={financialStatements.balanceSheetQuarterly}
                            columnsToShow={['Total Assets', 'Total Liabilities Net Minority Interest', 'Total Equity Gross Minority Interest', 'Total Debt', 'Cash And Cash Equivalents']}
                        />
                        <hr style={{ margin: '25px 0' }} />
                        <FinancialTable
                            title="Cash Flow (Annual)"
                            data={financialStatements.cashFlowAnnual}
                            columnsToShow={['Operating Cash Flow', 'Investing Cash Flow', 'Financing Cash Flow', 'Free Cash Flow']}
                        />
                        <FinancialTable
                            title="Cash Flow (Quarterly)"
                            data={financialStatements.cashFlowQuarterly}
                            columnsToShow={['Operating Cash Flow', 'Investing Cash Flow', 'Financing Cash Flow', 'Free Cash Flow']}
                        />
                    </div>
                </section>
            )}

            {/* --- Company Info Section (Summary & Address) --- */}
            <section className="company-info-section" style={{ marginBottom: '30px', borderTop: '1px solid #eee', paddingTop: '20px' }}>
                <h3>About {info.name || info.ticker}</h3>
                {/* Display Website */}
                <div className="company-website-card card-style" style={{ marginBottom: '15px' }}>
                     {renderInfoPair("Website", info.website, (v) => <a href={v} target="_blank" rel="noopener noreferrer">{v}</a>)}
                </div>
                {/* Display Summary if available */}
                {info.longBusinessSummary && (
                    <div className="business-summary-card card-style">
                        <h4 style={{ marginTop: 0, marginBottom: '10px' }}>Business Summary</h4>
                        <p style={{ whiteSpace: 'pre-line', maxHeight: '250px', overflowY: 'auto', fontSize: '0.9em', lineHeight: '1.6', border: '1px solid #f0f0f0', padding: '10px', margin: 0 }}>
                            {info.longBusinessSummary}
                        </p>
                    </div>
                )}
                 {/* Display Address */}
                <div className="company-address-card card-style" style={{ marginTop: '15px' }}>
                    <h4 style={{ marginTop: 0, marginBottom: '10px' }}>Address & Employees</h4>
                    {renderInfoPair("Address", `${info.address1 || ''}${info.city ? ', '+info.city : ''}${info.country ? ', '+info.country : ''}`)}
                    {renderInfoPair("Employees", info.fullTimeEmployees, (v) => v?.toLocaleString())}
                </div>
            </section>

            <RouterLink to="/" className="btn btn-secondary" style={{ display: 'inline-block', marginTop: '20px', marginBottom: '20px' }}>
                Back to Dashboard
            </RouterLink>
        </div>
    );
};

export default StockDetailPage;