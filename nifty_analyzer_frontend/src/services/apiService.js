// src/services/apiService.js
import axios from 'axios';

//const API_BASE_URL = 'http://localhost:5000/api'; // Your backend URL
const API_BASE_URL = 'https://nifty-analyzer-backend.onrender.com/api';

// Instance for general API calls
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// --- Client-Side Cache for Stock Overview Data ---
let overviewCache = {
  data: null,
  timestamp: 0,
};
// Cache overview data for 5 minutes (adjust as needed)
const OVERVIEW_CACHE_TTL_MINUTES = 60; 

export const getStockOverviewData = async (forceRefresh = false) => {
  const now = Date.now();
  if (!forceRefresh && overviewCache.data && (now - overviewCache.timestamp < OVERVIEW_CACHE_TTL_MINUTES * 60 * 1000)) {
    console.log("Serving stock overview data from client-side cache.");
    return overviewCache.data;
  }
  try {
    console.log("Fetching fresh stock overview data from backend (full recalculation)...");
    const response = await apiClient.get('/stock_overview_data');
    overviewCache = { 
      data: response.data,
      timestamp: Date.now(),
    };
    return response.data;
  } catch (error) {
    console.error("Error fetching stock overview data:", error);
    throw error;
  }
};

// --- NEW FUNCTION FOR QUICK UPDATES ---
export const getStockQuickUpdates = async () => {
  try {
    console.log("Fetching quick stock updates from backend...");
    const response = await apiClient.get('/stock_quick_updates');
    return response.data;
  } catch (error) {
    console.error("Error fetching quick stock updates:", error);
    // If the backend returns a 500 with an error message in data,
    // it might be useful to propagate that. Otherwise, just throw the axios error.
    if (error.response && error.response.data && error.response.data.error) {
        throw new Error(error.response.data.error);
    }
    throw error;
  }
};
// --- END NEW FUNCTION ---

// Function to explicitly clear the client-side overview cache (can be removed if DashboardPage doesn't call it)
// export const clearStockOverviewCache = () => {
//   console.log("Client-side stock overview cache cleared.");
//   overviewCache = {
//     data: null,
//     timestamp: 0,
//   };
// };


// Data for the individual stock detail page
export const getStockDetailData = async (tickerSymbol, forceBackendRefresh = false) => {
  try {
    const url = forceBackendRefresh 
                ? `/stock_detail/${tickerSymbol}?refresh=true` 
                : `/stock_detail/${tickerSymbol}`;
    const response = await apiClient.get(url);
    return response.data;
  } catch (error) {
    console.error(`Error fetching stock detail data for ${tickerSymbol}:`, error);
    throw error;
  }
};

// src/services/apiService.js
// ... (apiClient, getStockOverviewData, getStockDetailData, etc.) ...

export const getSingleStockQuickInfo = async (tickerSymbol) => {
    try {
      // console.log(`Fetching single quick info for ${tickerSymbol}...`);
      const response = await apiClient.get(`/stock_quick_info/${tickerSymbol}`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching single quick info for ${tickerSymbol}:`, error);
      // If backend returns a 404 with an error object, we can use that
      if (error.response && error.response.data && error.response.data.error) {
          throw new Error(error.response.data.error);
      }
      throw error; // Re-throw original error if no specific backend error message
    }
  };
  
// Nifty 50 List
export const getNifty50List = async () => {
  try {
    const response = await apiClient.get('/nifty50_list');
    return response.data;
  } catch (error) {
    console.error("Error fetching Nifty 50 list:", error);
    throw error;
  }
};