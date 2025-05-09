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

