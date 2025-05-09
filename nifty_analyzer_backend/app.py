# app.py

from flask import Flask, jsonify, request
from flask_cors import CORS
import yfinance as yf
import pandas as pd
from datetime import datetime, timedelta, date
import time
import numpy as np # For checking NaN safely
import requests 
import os       

app = Flask(__name__)
CORS(app)

# --- Cache Configuration ---
stock_detail_cache = {}
CACHE_TTL_SECONDS = 15 * 60 # 15 minutes

 


# --- Configuration ---
NIFTY50_TICKERS = [
    "ADANIENT.NS", "ADANIPORTS.NS", "APOLLOHOSP.NS", "ASIANPAINT.NS", "AXISBANK.NS",
    "BAJAJ-AUTO.NS", "BAJFINANCE.NS", "BAJAJFINSV.NS", "BPCL.NS", "BHARTIARTL.NS",
    "BRITANNIA.NS", "CIPLA.NS", "COALINDIA.NS", "DIVISLAB.NS", "DRREDDY.NS",
    "EICHERMOT.NS", "GRASIM.NS", "HCLTECH.NS", "HDFCBANK.NS", "HDFCLIFE.NS",
    "HEROMOTOCO.NS", "HINDALCO.NS", "HINDUNILVR.NS", "ICICIBANK.NS", "ITC.NS",
    "INDUSINDBK.NS", "INFY.NS", "JSWSTEEL.NS", "KOTAKBANK.NS", "LTIM.NS", 
    "LT.NS", "M&M.NS", "MARUTI.NS", "NTPC.NS", "NESTLEIND.NS", "ONGC.NS",
    "POWERGRID.NS", "RELIANCE.NS", "SBILIFE.NS", "SBIN.NS", "SUNPHARMA.NS",
    "TATAMOTORS.NS", "TCS.NS", "TATASTEEL.NS", "TECHM.NS", "TITAN.NS",
    "ULTRACEMCO.NS", "UPL.NS", "WIPRO.NS","VOLTAS.NS"
]

SHORT_WINDOW = 20
LONG_WINDOW = 50
HISTORY_PERIOD_DAYS = max(LONG_WINDOW, SHORT_WINDOW) * 3 + 90

# --- DMA Signal Nuance Parameters ---
RECENT_CROSSOVER_DAYS = 5
MA_SPREAD_STRONG_THRESHOLD = 0.015
MA_SPREAD_NEUTRAL_THRESHOLD = 0.005

# --- Helper function to process financial statement DataFrames ---
def format_financial_statement(df):
    if df is None or df.empty:
        return None
    try:
        df_transposed = df.transpose().reset_index()
        if 'index' in df_transposed.columns:
            df_transposed = df_transposed.rename(columns={'index': 'Period'})
        elif df_transposed.columns[0] != 'Period': 
             df_transposed = df_transposed.rename(columns={df_transposed.columns[0]: 'Period'})

        if pd.api.types.is_datetime64_any_dtype(df_transposed['Period']):
             df_transposed['Period'] = df_transposed['Period'].dt.strftime('%Y-%m-%d')
        else: 
            df_transposed['Period'] = df_transposed['Period'].astype(str).str.split(' ').str[0]

        for col in df_transposed.columns:
            if col != 'Period':
                df_transposed[col] = pd.to_numeric(df_transposed[col], errors='coerce')
        
        df_processed = df_transposed.replace({np.nan: None, pd.NaT: None})
        return df_processed.to_dict(orient='records')
    except Exception as e:
        print(f"Error formatting financial statement: {e}")
        import traceback
        traceback.print_exc()
        return None

# --- Helper Function to Get Stock Data and DMA Signal ---
def get_stock_data_and_signal(ticker_symbol):
    print(f"Processing {ticker_symbol} for nuanced signal...")
    try:
        stock = yf.Ticker(ticker_symbol)
        hist_data_end = datetime.now()
        hist_data_start = hist_data_end - timedelta(days=HISTORY_PERIOD_DAYS + 60)
        hist_df = stock.history(start=hist_data_start.strftime('%Y-%m-%d'), 
                                end=hist_data_end.strftime('%Y-%m-%d'), 
                                interval="1d")

        if hist_df.empty or len(hist_df) < LONG_WINDOW:
            print(f"  WARN: Not enough historical data for {ticker_symbol} (got {len(hist_df)}, need {LONG_WINDOW}).")
            try:
                info = stock.info
                return {
                    "ticker": ticker_symbol, "name": info.get('shortName', ticker_symbol),
                    "cmp": info.get('currentPrice', info.get('regularMarketPrice', 0)),
                    "dayChangePercent": (info.get('regularMarketChangePercent', 0)) * 100,
                    "dayChangeAbs": info.get('regularMarketChange', 0), "volume": info.get('volume', 0),
                    "dmaSignal": "N/A (Data)", "lastSignalDate": None, "smaShort": None, "smaLong": None,
                }
            except Exception: return None 

        hist_df[f'SMA_{SHORT_WINDOW}'] = hist_df['Close'].rolling(window=SHORT_WINDOW, min_periods=1).mean()
        hist_df[f'SMA_{LONG_WINDOW}'] = hist_df['Close'].rolling(window=LONG_WINDOW, min_periods=1).mean()
        valid_ma_hist = hist_df.dropna(subset=[f'SMA_{SHORT_WINDOW}', f'SMA_{LONG_WINDOW}'])
        
        current_signal, date_of_signal, sma_short_latest, sma_long_latest = "N/A (Logic)", None, None, None

        if len(valid_ma_hist) < 2:
            if len(valid_ma_hist) == 1:
                 sma_short_latest, sma_long_latest = valid_ma_hist.iloc[-1][f'SMA_{SHORT_WINDOW}'], valid_ma_hist.iloc[-1][f'SMA_{LONG_WINDOW}']
                 current_signal = "INITIAL" 
        else:
            sma_short_col, sma_long_col = f'SMA_{SHORT_WINDOW}', f'SMA_{LONG_WINDOW}'
            hist_with_signals = valid_ma_hist.copy()
            hist_with_signals['BuyCrossover'] = (hist_with_signals[sma_short_col] > hist_with_signals[sma_long_col]) & (hist_with_signals[sma_short_col].shift(1) <= hist_with_signals[sma_long_col].shift(1))
            hist_with_signals['SellCrossover'] = (hist_with_signals[sma_short_col] < hist_with_signals[sma_long_col]) & (hist_with_signals[sma_short_col].shift(1) >= hist_with_signals[sma_long_col].shift(1))
            last_buy_event_date = hist_with_signals[hist_with_signals['BuyCrossover']].index.max() if not hist_with_signals[hist_with_signals['BuyCrossover']].empty else pd.NaT
            last_sell_event_date = hist_with_signals[hist_with_signals['SellCrossover']].index.max() if not hist_with_signals[hist_with_signals['SellCrossover']].empty else pd.NaT
            sma_short_latest, sma_long_latest = valid_ma_hist.iloc[-1][sma_short_col], valid_ma_hist.iloc[-1][sma_long_col]
            days_since_last_buy = (date.today() - last_buy_event_date.date()).days if pd.notna(last_buy_event_date) else float('inf')
            days_since_last_sell = (date.today() - last_sell_event_date.date()).days if pd.notna(last_sell_event_date) else float('inf')
            ma_spread = (sma_short_latest - sma_long_latest) / sma_long_latest if sma_long_latest != 0 and pd.notna(sma_long_latest) else 0

            if pd.notna(sma_short_latest) and pd.notna(sma_long_latest):
                if sma_short_latest > sma_long_latest: 
                    date_of_signal = last_buy_event_date.strftime('%Y-%m-%d') if pd.notna(last_buy_event_date) else None
                    if pd.notna(last_buy_event_date) and (pd.isna(last_sell_event_date) or last_buy_event_date > last_sell_event_date):
                        if days_since_last_buy <= RECENT_CROSSOVER_DAYS and ma_spread >= MA_SPREAD_STRONG_THRESHOLD: current_signal = "STRONG BUY"
                        elif days_since_last_buy <= RECENT_CROSSOVER_DAYS: current_signal = "RECENT BUY"
                        else: current_signal = "BUY (Uptrend)"
                    else: current_signal, date_of_signal = "POTENTIAL BUY / RECOVERY", None
                elif sma_short_latest < sma_long_latest: 
                    date_of_signal = last_sell_event_date.strftime('%Y-%m-%d') if pd.notna(last_sell_event_date) else None
                    if pd.notna(last_sell_event_date) and (pd.isna(last_buy_event_date) or last_sell_event_date > last_buy_event_date):
                        if days_since_last_sell <= RECENT_CROSSOVER_DAYS and abs(ma_spread) >= MA_SPREAD_STRONG_THRESHOLD: current_signal = "STRONG SELL"
                        elif days_since_last_sell <= RECENT_CROSSOVER_DAYS: current_signal = "RECENT SELL"
                        else: current_signal = "SELL (Downtrend)"
                    else: current_signal, date_of_signal = "POTENTIAL SELL / DECLINE", None
                else: 
                    current_signal = "NEUTRAL / SIDEWAYS"
                    if pd.notna(last_buy_event_date) and pd.notna(last_sell_event_date): date_of_signal = max(last_buy_event_date, last_sell_event_date).strftime('%Y-%m-%d')
                    elif pd.notna(last_buy_event_date): date_of_signal = last_buy_event_date.strftime('%Y-%m-%d')
                    elif pd.notna(last_sell_event_date): date_of_signal = last_sell_event_date.strftime('%Y-%m-%d')
                if abs(ma_spread) < MA_SPREAD_NEUTRAL_THRESHOLD and not (current_signal in ["STRONG BUY", "STRONG SELL"] and (days_since_last_buy <= RECENT_CROSSOVER_DAYS or days_since_last_sell <= RECENT_CROSSOVER_DAYS)):
                    current_signal = "NEUTRAL / SIDEWAYS"
                    if pd.notna(last_buy_event_date) and pd.notna(last_sell_event_date): date_of_signal = max(last_buy_event_date, last_sell_event_date).strftime('%Y-%m-%d')
                    elif pd.notna(last_buy_event_date): date_of_signal = last_buy_event_date.strftime('%Y-%m-%d')
                    elif pd.notna(last_sell_event_date): date_of_signal = last_sell_event_date.strftime('%Y-%m-%d')
            else: current_signal, date_of_signal = "N/A (Logic)", None
            if current_signal == "N/A (Logic)" and pd.notna(sma_short_latest) and pd.notna(sma_long_latest):
                if sma_short_latest > sma_long_latest: current_signal = "BUY (Trend)"
                elif sma_short_latest < sma_long_latest: current_signal = "SELL (Trend)"
                else: current_signal = "NEUTRAL"
        
        latest_close_price, stock_name, cmp, day_change_abs, day_change_percent, current_volume = hist_df.iloc[-1]['Close'] if not hist_df.empty else np.nan, ticker_symbol, hist_df.iloc[-1]['Close'] if not hist_df.empty else np.nan, 0.0, 0.0, hist_df.iloc[-1]['Volume'] if not hist_df.empty and 'Volume' in hist_df.columns else 0
        try:
            info = stock.info
            stock_name, cmp, prev_close = info.get('shortName', ticker_symbol), info.get('currentPrice', info.get('regularMarketPrice', latest_close_price)), info.get('previousClose')
            if pd.notna(prev_close) and pd.notna(cmp) and prev_close != 0: day_change_abs, day_change_percent = cmp - prev_close, ((cmp - prev_close) / prev_close) * 100
            vol_info = info.get('volume', info.get('regularMarketVolume'))
            current_volume = int(vol_info) if pd.notna(vol_info) else (int(current_volume) if pd.notna(current_volume) else 0)
        except Exception as e_info:
            print(f"  WARN: Could not fetch detailed stock.info for {ticker_symbol}. Using historical. Error: {e_info}")
            if len(hist_df) >= 2: day_change_abs, prev_close_for_calc = hist_df.iloc[-1]['Close'] - hist_df.iloc[-2]['Close'], hist_df.iloc[-2]['Close']; day_change_percent = ((day_change_abs / prev_close_for_calc) * 100) if pd.notna(prev_close_for_calc) and prev_close_for_calc != 0 else 0.0
        return {"ticker": ticker_symbol, "name": stock_name, "cmp": round(cmp, 2) if pd.notna(cmp) else None, "dayChangePercent": round(day_change_percent, 2) if pd.notna(day_change_percent) else None, "dayChangeAbs": round(day_change_abs, 2) if pd.notna(day_change_abs) else None, "volume": int(current_volume) if pd.notna(current_volume) else None, "dmaSignal": current_signal, "lastSignalDate": date_of_signal, "smaShort": round(sma_short_latest, 2) if pd.notna(sma_short_latest) else None, "smaLong": round(sma_long_latest, 2) if pd.notna(sma_long_latest) else None}
    except Exception as e_main: print(f"  ERROR: Main processing in get_stock_data_and_signal for {ticker_symbol}: {str(e_main)}"); import traceback; traceback.print_exc(); return None

# --- Helper for Quick Info ---
def get_stock_quick_info(ticker_symbol):
    try: 
        stock = yf.Ticker(ticker_symbol)
        info = stock.info 
        cmp = info.get('currentPrice', info.get('regularMarketPrice'))
        prev_close = info.get('previousClose')       
        day_change_abs = None
        day_change_percent = None
        if pd.notna(cmp) and pd.notna(prev_close) and prev_close != 0 :
            day_change_abs = cmp - prev_close
            day_change_percent = (day_change_abs / prev_close) * 100
        
        volume = info.get('volume', info.get('regularMarketVolume', 0))
        return {
            "ticker": ticker_symbol,
            "name": info.get('shortName', ticker_symbol),
            "cmp": round(cmp, 2) if pd.notna(cmp) else None,
            "dayChangePercent": round(day_change_percent, 2) if pd.notna(day_change_percent) else None,
            "dayChangeAbs": round(day_change_abs, 2) if pd.notna(day_change_abs) else None,
            "volume": int(volume) if pd.notna(volume) else None
        }
    except Exception as e:
        print(f"  ERROR fetching quick info for {ticker_symbol}: {str(e)}")
        return {"ticker": ticker_symbol, "name": ticker_symbol.replace(".NS", ""), "cmp": None, "dayChangePercent": None, "dayChangeAbs": None, "volume": None, "error": True, "errorMessage": str(e)}

# --- API Endpoints ---
@app.route('/api/stock_overview_data', methods=['GET'])
def get_stock_overview():
    all_overview_data = []
    tickers_to_process = NIFTY50_TICKERS 
    print(f"\n--- Processing {len(tickers_to_process)} tickers for overview ---")
    start_time_total = time.time()
    for i, ticker in enumerate(tickers_to_process): 
        stock_info = get_stock_data_and_signal(ticker) 
        if stock_info: all_overview_data.append(stock_info)
        time.sleep(0.1) 
        if (i + 1) % 10 == 0: print(f"Processed {i+1}/{len(tickers_to_process)}."); time.sleep(0.3) 
    end_time_total = time.time(); print(f"--- Finished overview in {end_time_total - start_time_total:.2f}s ---")
    if not all_overview_data: return jsonify({"error": "Could not fetch overview data."}), 500
    return jsonify(all_overview_data)

@app.route('/api/stock_quick_updates', methods=['GET'])
def get_stock_quick_updates_endpoint():
    quick_updates = []
    tickers_to_process = NIFTY50_TICKERS
    print(f"\n--- Fetching quick updates for {len(tickers_to_process)} tickers ---")
    start_time_total = time.time()
    for i, ticker in enumerate(tickers_to_process): 
        info = get_stock_quick_info(ticker)
        quick_updates.append(info)
        time.sleep(0.05)
        if (i + 1) % 20 == 0: print(f"Processed quick update {i+1}/{len(tickers_to_process)}."); time.sleep(0.2)
    end_time_total = time.time(); print(f"--- Finished quick updates in {end_time_total - start_time_total:.2f}s ---")
    if all(item.get("error") for item in quick_updates if item): return jsonify({"error": "Could not fetch quick data."}), 500
    return jsonify(quick_updates)

@app.route('/api/nifty50_list', methods=['GET'])
def get_nifty50_list_actual():
    return jsonify([{"ticker": t, "name": t.replace(".NS","")} for t in NIFTY50_TICKERS])

# --- NEW API ENDPOINT FOR SINGLE STOCK QUICK INFO ---
@app.route('/api/stock_quick_info/<ticker_symbol>', methods=['GET'])
def get_single_stock_quick_info_endpoint(ticker_symbol):
    # Add .NS if it's not already there (assuming your frontend might send it without)
    # Or ensure frontend always sends with .NS
    if not ticker_symbol.endswith(".NS") and ".NS" not in ticker_symbol.upper(): # Basic check
        ticker_symbol_to_fetch = ticker_symbol.upper() + ".NS"
    else:
        ticker_symbol_to_fetch = ticker_symbol.upper()

    print(f"\n--- Fetching SINGLE quick update for {ticker_symbol_to_fetch} ---")
    quick_info = get_stock_quick_info(ticker_symbol_to_fetch)
    
    if quick_info and not quick_info.get("error"):
        return jsonify(quick_info)
    else:
        # Return a clear error if data for this specific ticker couldn't be fetched
        return jsonify({"error": f"Could not fetch quick info for {ticker_symbol_to_fetch}", "details": quick_info}), 404
# --- END NEW API ENDPOINT ---


# --- UPDATED Stock Detail Endpoint ---
@app.route('/api/stock_detail/<ticker_symbol>', methods=['GET'])
def get_stock_detail(ticker_symbol):
    print(f"\n--- Requesting EXTENDED detail for {ticker_symbol} ---")
    force_refresh = request.args.get('refresh', 'false').lower() == 'true'
    
    cached_entry = stock_detail_cache.get(ticker_symbol)
    if not force_refresh and cached_entry:
        data, timestamp = cached_entry
        if (time.time() - timestamp) < CACHE_TTL_SECONDS:
            print(f"  CACHE HIT for {ticker_symbol}")
            return jsonify(data)
        else:
            print(f"  CACHE STALE for {ticker_symbol}. Re-fetching.")
            if ticker_symbol in stock_detail_cache: del stock_detail_cache[ticker_symbol]
    elif force_refresh:
        print(f"  CACHE REFRESH FORCED for {ticker_symbol}")
        if ticker_symbol in stock_detail_cache: del stock_detail_cache[ticker_symbol]
    else:
        print(f"  CACHE MISS for {ticker_symbol}. Fetching data.")

    base_stock_data = get_stock_data_and_signal(ticker_symbol) 
    if not base_stock_data:
        try:
            stock_obj_fallback = yf.Ticker(ticker_symbol)
            info_fallback = stock_obj_fallback.info
            if info_fallback:
                 print("  WARN: Base signal calc failed, returning only very basic info from fallback.")
                 return jsonify({
                     "info": {"ticker": ticker_symbol, "name": info_fallback.get('shortName', ticker_symbol), "error": "Signal/History Fetch Failed"},
                     "currentMarketData": {"cmp": info_fallback.get('currentPrice')}, 
                     "currentDma": {"signal": "N/A (Error)"},
                     "historicalData": [], "dmaSignalsHistorical": [], "financialStatements": {}, "news": []
                 })
            else: return jsonify({"error": f"Could not fetch any data for {ticker_symbol}"}), 404
        except Exception as fallback_e:
            print(f"  ERROR: Fallback info fetch also failed for {ticker_symbol}: {fallback_e}")
            return jsonify({"error": f"Could not fetch any data for {ticker_symbol}"}), 404
    
    stock_obj = yf.Ticker(ticker_symbol)
    stock_info_obj = {} 
    financials_annual, financials_quarterly, balance_sheet_annual, balance_sheet_quarterly, cash_flow_annual, cash_flow_quarterly = None, None, None, None, None, None
    news_data_list = [] # Initialize here
    historical_data_for_chart, dma_signals_historical = [], [] # Initialize here

    try: # Main try for yfinance object data (info, financials)
        stock_info_obj = stock_obj.info
        if not stock_info_obj: 
            print(f"  WARN: stock.info was empty for {ticker_symbol}.")
            stock_info_obj = {} 
        
        # Fetch financial statements
        try:
            financials_annual = format_financial_statement(stock_obj.financials)
            financials_quarterly = format_financial_statement(stock_obj.quarterly_financials)
            balance_sheet_annual = format_financial_statement(stock_obj.balance_sheet)
            balance_sheet_quarterly = format_financial_statement(stock_obj.quarterly_balance_sheet)
            cash_flow_annual = format_financial_statement(stock_obj.cashflow)
            cash_flow_quarterly = format_financial_statement(stock_obj.quarterly_cashflow)
        except Exception as e_fin:
            print(f"  WARN: Error fetching one or more financial statements for {ticker_symbol}: {e_fin}")
    
    except Exception as e_yf_main:
        print(f"  ERROR: Major error fetching yfinance object data (info/financials) for {ticker_symbol}: {e_yf_main}")
        if not isinstance(stock_info_obj, dict): stock_info_obj = {} # Ensure it's a dict

        
    # Fetch Historical data for chart 
    try:
        hist_data_end_detail = datetime.now()
        hist_data_start_detail = hist_data_end_detail - timedelta(days=365*2 + 60)
        detailed_hist_df = stock_obj.history(start=hist_data_start_detail.strftime('%Y-%m-%d'), 
                                             end=hist_data_end_detail.strftime('%Y-%m-%d'), 
                                             interval="1d")
        
        if not detailed_hist_df.empty:
            detailed_hist_df[f'SMA_{SHORT_WINDOW}'] = detailed_hist_df['Close'].rolling(window=SHORT_WINDOW, min_periods=1).mean()
            detailed_hist_df[f'SMA_{LONG_WINDOW}'] = detailed_hist_df['Close'].rolling(window=LONG_WINDOW, min_periods=1).mean()
            
            for index, row in detailed_hist_df.iterrows():
                historical_data_for_chart.append({
                    "time": index.strftime('%Y-%m-%d'), 
                    "open": round(row['Open'], 2) if pd.notna(row['Open']) else None,
                    "high": round(row['High'], 2) if pd.notna(row['High']) else None,
                    "low": round(row['Low'], 2) if pd.notna(row['Low']) else None,
                    "close": round(row['Close'], 2) if pd.notna(row['Close']) else None,
                    "volume": int(row['Volume']) if pd.notna(row['Volume']) else None,
                    "smaShort": round(row.get(f'SMA_{SHORT_WINDOW}'), 2) if pd.notna(row.get(f'SMA_{SHORT_WINDOW}')) else None,
                    "smaLong": round(row.get(f'SMA_{LONG_WINDOW}'), 2) if pd.notna(row.get(f'SMA_{LONG_WINDOW}')) else None,
                })
            
            if len(detailed_hist_df) > 1:
                sma_short_col_detail, sma_long_col_detail = f'SMA_{SHORT_WINDOW}', f'SMA_{LONG_WINDOW}'
                if sma_short_col_detail in detailed_hist_df.columns and sma_long_col_detail in detailed_hist_df.columns: # Ensure columns exist
                    chart_hist_df = detailed_hist_df[[sma_short_col_detail, sma_long_col_detail, 'Close']].copy()
                    chart_hist_df = chart_hist_df.dropna(subset=[sma_short_col_detail, sma_long_col_detail])
                    if len(chart_hist_df) > 1:
                        chart_hist_df['BuyCrossover'] = (chart_hist_df[sma_short_col_detail] > chart_hist_df[sma_long_col_detail]) & (chart_hist_df[sma_short_col_detail].shift(1) <= chart_hist_df[sma_long_col_detail].shift(1))
                        chart_hist_df['SellCrossover'] = (chart_hist_df[sma_short_col_detail] < chart_hist_df[sma_long_col_detail]) & (chart_hist_df[sma_short_col_detail].shift(1) >= chart_hist_df[sma_long_col_detail].shift(1))
                        for index, row_data in chart_hist_df[chart_hist_df['BuyCrossover']].iterrows(): dma_signals_historical.append({"time": index.strftime('%Y-%m-%d'), "type": "BUY", "priceAtSignal": round(row_data['Close'], 2) if pd.notna(row_data['Close']) else None})
                        for index, row_data in chart_hist_df[chart_hist_df['SellCrossover']].iterrows(): dma_signals_historical.append({"time": index.strftime('%Y-%m-%d'), "type": "SELL", "priceAtSignal": round(row_data['Close'], 2) if pd.notna(row_data['Close']) else None})
                        dma_signals_historical.sort(key=lambda x: x['time'])
    except Exception as e_hist:
        print(f"  ERROR: Could not fetch/process historical chart data for {ticker_symbol}: {e_hist}")
   

    # --- Construct the Final Payload ---
    # (This construction remains largely the same, ensure all keys are .get() for safety)
    detail_payload = { 
        "info": { 
            "ticker": base_stock_data.get("ticker", ticker_symbol), 
            "name": base_stock_data.get("name", stock_info_obj.get('shortName', ticker_symbol)), 
            "sector": stock_info_obj.get('sector'), "industry": stock_info_obj.get('industry'), "longBusinessSummary": stock_info_obj.get('longBusinessSummary'), "website": stock_info_obj.get('website'), "address1": stock_info_obj.get('address1'), "city": stock_info_obj.get('city'), "country": stock_info_obj.get('country'), "fullTimeEmployees": stock_info_obj.get('fullTimeEmployees'), "marketCap": stock_info_obj.get('marketCap'), "enterpriseValue": stock_info_obj.get('enterpriseValue'), "beta": stock_info_obj.get('beta'), "trailingPE": stock_info_obj.get('trailingPE'), "forwardPE": stock_info_obj.get('forwardPE'), "pegRatio": stock_info_obj.get('pegRatio'), "priceToBook": stock_info_obj.get('priceToBook'), "enterpriseToRevenue": stock_info_obj.get('enterpriseToRevenue'), "enterpriseToEbitda": stock_info_obj.get('enterpriseToEbitda'), "bookValue": stock_info_obj.get('bookValue'), "dividendRate": stock_info_obj.get('dividendRate'), "dividendYield": stock_info_obj.get('dividendYield'), "payoutRatio": stock_info_obj.get('payoutRatio'), "fiveYearAvgDividendYield": stock_info_obj.get('fiveYearAvgDividendYield'), "exDividendDate": datetime.fromtimestamp(stock_info_obj['exDividendDate']).strftime('%Y-%m-%d') if stock_info_obj.get('exDividendDate') else None, "profitMargins": stock_info_obj.get('profitMargins'), "grossMargins": stock_info_obj.get('grossMargins'), "ebitdaMargins": stock_info_obj.get('ebitdaMargins'), "operatingMargins": stock_info_obj.get('operatingMargins'), "returnOnAssets": stock_info_obj.get('returnOnAssets'), "returnOnEquity": stock_info_obj.get('returnOnEquity'), "debtToEquity": stock_info_obj.get('debtToEquity'), "quickRatio": stock_info_obj.get('quickRatio'), "currentRatio": stock_info_obj.get('currentRatio'), "totalCash": stock_info_obj.get('totalCash'), "totalDebt": stock_info_obj.get('totalDebt'), "revenueGrowth": stock_info_obj.get('revenueGrowth'), "earningsQuarterlyGrowth": stock_info_obj.get('earningsQuarterlyGrowth'), "sharesOutstanding": stock_info_obj.get('sharesOutstanding'), "floatShares": stock_info_obj.get('floatShares'), "heldPercentInsiders": stock_info_obj.get('heldPercentInsiders'), "heldPercentInstitutions": stock_info_obj.get('heldPercentInstitutions'), "targetMeanPrice": stock_info_obj.get('targetMeanPrice'), "targetHighPrice": stock_info_obj.get('targetHighPrice'), "targetLowPrice": stock_info_obj.get('targetLowPrice'), "recommendationMean": stock_info_obj.get('recommendationMean'), "recommendationKey": stock_info_obj.get('recommendationKey'), "numberOfAnalystOpinions": stock_info_obj.get('numberOfAnalystOpinions'), "dayHigh": stock_info_obj.get('dayHigh'), "dayLow": stock_info_obj.get('dayLow'), "fiftyTwoWeekHigh": stock_info_obj.get('fiftyTwoWeekHigh'), "fiftyTwoWeekLow": stock_info_obj.get('fiftyTwoWeekLow'), "averageVolume": stock_info_obj.get('averageVolume', stock_info_obj.get('averageDailyVolume10Day')),
        }, 
        "currentMarketData": { 
            "cmp": base_stock_data.get("cmp", stock_info_obj.get('currentPrice')), 
            "dayChangePercent": base_stock_data.get("dayChangePercent"), 
            "dayChangeAbs": base_stock_data.get("dayChangeAbs"), 
            "volume": base_stock_data.get("volume"), 
            "openPrice": stock_info_obj.get('open'), 
            "previousClosePrice": stock_info_obj.get('previousClose') 
        }, 
        "historicalData": historical_data_for_chart, 
        "dmaSignalsHistorical": dma_signals_historical, 
        "currentDma": { 
            "signal": base_stock_data.get("dmaSignal"), 
            "smaShortValue": base_stock_data.get("smaShort"), 
            "smaLongValue": base_stock_data.get("smaLong"), 
            "lastSignalDate": base_stock_data.get("lastSignalDate")
        }, 
        "financialStatements": { 
            "incomeStatementAnnual": financials_annual, 
            "incomeStatementQuarterly": financials_quarterly, 
            "balanceSheetAnnual": balance_sheet_annual, 
            "balanceSheetQuarterly": balance_sheet_quarterly, 
            "cashFlowAnnual": cash_flow_annual, 
            "cashFlowQuarterly": cash_flow_quarterly,
        }, 
        "news": news_data_list # Use the variable assigned from NewsAPI
    }
    
    stock_detail_cache[ticker_symbol] = (detail_payload, time.time())
    print(f"  EXTENDED DATA (with NewsAPI) FETCHED and cached for {ticker_symbol}")
    return jsonify(detail_payload)

# --- Main Execution ---
if __name__ == '__main__':
    # --- TEMPORARY TEST FOR NEWSAPI ---
    print("-" * 30)

    app.run(debug=True, port=5000, threaded=True)