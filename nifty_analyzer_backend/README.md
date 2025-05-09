# Nifty DMA Analyzer - Backend

This directory contains the Python Flask backend for the Nifty DMA Analyzer application.

## Functionality
- Serves API endpoints for stock data.
- Fetches real-time and historical stock data using `yfinance`.
- Calculates Dual Moving Average (DMA) signals (20-day and 50-day).
- Retrieves company information and financial statements.
- Implements backend caching for stock detail data.

## API Endpoints
- `/api/stock_overview_data`: Gets overview data for all Nifty 50 stocks.
- `/api/stock_quick_updates`: Gets quick price/volume updates for all Nifty 50 stocks.
- `/api/stock_quick_info/<ticker_symbol>`: Gets quick price/volume update for a single stock.
- `/api/stock_detail/<ticker_symbol>`: Gets comprehensive data for a single stock (excluding news).
- `/api/nifty50_list`: Gets a simple list of Nifty 50 tickers.

## Setup
1. Ensure Python 3.8+ is installed.
2. Create and activate a virtual environment:
   ```bash
   python -m venv venv
   # Windows: venv\Scripts\activate
   # macOS/Linux: source venv/bin/activate