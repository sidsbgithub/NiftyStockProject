# Nifty DMA Analyzer

## Project Overview

The Nifty DMA Analyzer is a full-stack web application designed to analyze stocks from the Nifty 50 index using a Dual Moving Average (DMA) crossover strategy. It provides users with buy/sell/hold signals, detailed stock information, historical price charts, and financial statements.

The application consists of:
- A **Python Flask backend** (`nifty_analyzer_backend/`) responsible for fetching stock data from yfinance, calculating DMA signals, and processing financial data.
- A **React frontend** (`nifty_analyzer_frontend/`) built with Vite, providing a user-friendly interface to display the analyzed data, including interactive charts and sortable/filterable tables.

## Features

- **Dashboard View:** Overview of all Nifty 50 stocks with current market price, day's change, volume, and current DMA signal.
    - Search and filter by stock name/ticker or DMA signal.
    - Sortable columns.
    - "Refresh Prices" button for quick CMP/change updates.
    - "Recalculate All" button for a full data refresh including signals.
- **Stock Detail View:**
    - Comprehensive information for individual stocks.
    - Current market snapshot and detailed DMA analysis (signal, crossover date, SMA values).
    - Interactive price chart displaying OHLC data, SMAs (20-day & 50-day), volume, and historical Buy/Sell DMA crossover markers.
    - Key financial metrics and valuation ratios.
    - Tabulated financial statements (Income, Balance Sheet, Cash Flow - Annual & Quarterly).
    - Company profile and business summary.
    - Refresh button for the specific stock's data.
- **Dark Mode / Light Mode** theme toggle.
- **Client-side caching** for improved performance on dashboard navigations.
- **Backend caching** for stock detail data to reduce redundant API calls to yfinance.

## Tech Stack

**Backend:**
- Python
- Flask (for the web framework and API)
- Flask-CORS (for handling Cross-Origin Resource Sharing)
- yfinance (for fetching stock market data)
- pandas (for data manipulation)
- NumPy (for numerical operations)
- ~~requests (for calling external NewsAPI)~~ (Removed if NewsAPI is not used)

**Frontend:**
- React.js (with Vite as the build tool)
- JavaScript (ES6+)
- HTML5 & CSS3
- Axios (for making API calls to the backend)
- Chart.js with `react-chartjs-2` and `chartjs-chart-financial` (for interactive charts)
- `chartjs-plugin-zoom` and `hammerjs` (for chart zooming and panning)
- `date-fns` and `chartjs-adapter-date-fns` (for time scale on charts)
- React Router (for client-side routing)

**Development Tools:**
- Git & GitHub (for version control)
- Visual Studio Code (or your preferred IDE)

## Setup and Running the Project

### Prerequisites
- Python 3.8+
- Node.js and npm (or yarn)
- Git

### Backend Setup (`nifty_analyzer_backend/`)
1. Navigate to the `nifty_analyzer_backend` directory.
2. Create a Python virtual environment: `python -m venv venv`
3. Activate the virtual environment:
   - Windows: `venv\Scripts\activate`
   - macOS/Linux: `source venv/bin/activate`
4. Install dependencies: `pip install -r requirements.txt`
   (If you removed `requests`, regenerate `requirements.txt` after deactivating and reactivating venv: `pip freeze > requirements.txt`)
5. Run the Flask development server: `python app.py`
   (The backend will run on `http://localhost:5000` by default)

### Frontend Setup (`nifty_analyzer_frontend/`)
1. Navigate to the `nifty_analyzer_frontend` directory.
2. Install dependencies: `npm install` (or `yarn install`)
3. Run the Vite development server: `npm run dev` (or `yarn dev`)
   (The frontend will run on `http://localhost:5173` by default and connect to the backend)

### Accessing the Application
Open yourOkay, understood. If you've decided to remove the news fetching functionality entirely (both the yfinance news and the NewsAPI integration) for now, we need to make sure the code reflects that cleanly in both the backend and frontend.

**Step 1: Clean Up Backend (`app.py`)**

1.  **Remove News Fetching Logic from `get_stock_detail`:**
    *   In your `get_stock_detail` function, delete the entire block of code responsible for fetching news. This means removing the `news_data_list = []` initialization and the call to `fetch_news_from_external_api` (if you had added it) or the loop that processed `stock_obj.news`.
    *   Ensure the `detail_payload` no longer includes a `"news"` key, or sets it to an empty list `[]`.

2.  **Remove `fetch_news_from_external_api` Function (if you added it):**
    *   If you had pasted the `fetch_news_from_external_api` helper function for NewsAPI, delete that entire function definition.

3.  **Remove Unused Imports:**
    *   If `requests` and `os` were only imported for NewsAPI, you can remove those import lines from the top of `app.py` if they are no longer used anywhere else.
    *   Remove the `NEWSAPI_KEY` configuration line.

**Modified `get_stock_detail` in `app.py` (example snippet showing removal):**

```python
# app.py
# ... other imports (REMOVE requests, os if no longer needed) ...

# ... NEWSAPI_KEY line REMOVED ...

# ... other functions ...

@app.route('/api/stock_detail/<ticker_symbol>', methods=['GET'])
def browser and go to `http://localhost:5173`.

## Future Enhancements
- User authentication and personalized watchlists.
- More advanced technical indicators on charts.
- Detailed shareholding pattern display.
- Stock comparison features.
- (Optional: Re-integrate news fetching from a reliable source)
- Deployment to a cloud platform.

---
*Disclaimer: This project is for educational and demonstration purposes only. It is not financial advice. Always do your own research before making any investment decisions.*