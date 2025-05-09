// src/components/StockPriceChart.jsx (Using Chart.js with Zoom/Pan and Annotations)
import React, { useRef } from 'react'; 
import { Chart } from 'react-chartjs-2'; 
import {
  Chart as ChartJS, 
  CategoryScale, LinearScale, PointElement, LineElement, BarElement,
  Title, Tooltip, Legend, TimeScale, Filler 
} from 'chart.js';
import { CandlestickController, CandlestickElement, OhlcController, OhlcElement } from 'chartjs-chart-financial'; 
import 'chartjs-adapter-date-fns'; 
import zoomPlugin from 'chartjs-plugin-zoom'; 
import annotationPlugin from 'chartjs-plugin-annotation'; // --- IMPORT ANNOTATION PLUGIN ---
import Hammer from 'hammerjs'; // Keep if installed

// Register necessary components with ChartJS
ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement, BarElement,
  Title, Tooltip, Legend, TimeScale, Filler,
  CandlestickController, CandlestickElement, OhlcController, OhlcElement,
  zoomPlugin, 
  annotationPlugin // --- REGISTER ANNOTATION PLUGIN ---
);

// Using hardcoded values here. Ideally import from utils if they match.
const SHORT_WINDOW = 20; 
const LONG_WINDOW = 50; 

// --- Helper Formatting Functions (Defined OUTSIDE the component) ---
const formatCandlestickDataChartJS = (data = []) => { 
    return data
        .filter(d => d.time && d.open !== null && d.high !== null && d.low !== null && d.close !== null)
        .map(d => ({ x: new Date(d.time).getTime(), o: d.open, h: d.high, l: d.low, c: d.close })) 
        .sort((a, b) => a.x - b.x);
};
const formatLineDataChartJS = (data = [], key) => { 
    return data
        .filter(d => d.time && d[key] !== null && !isNaN(d[key]))
        .map(d => ({ x: new Date(d.time).getTime(), y: d[key] })) 
        .sort((a, b) => a.x - b.x);
};
const formatVolumeDataChartJS = (data = []) => {
    return data
        .filter(d => d.time && d.volume !== null && !isNaN(d.volume))
        .map((d, index, arr) => ({
            x: new Date(d.time).getTime(),
            y: d.volume,
            backgroundColor: index > 0 && arr[index-1]?.close !== null && d.close !== null && d.close < arr[index-1].close 
                ? 'rgba(239, 83, 80, 0.5)' // Lighter Red
                : 'rgba(38, 166, 154, 0.5)', // Lighter Green
        }))
        .sort((a, b) => a.x - b.x);
};
// --- End Formatting Functions ---


// --- Chart Component ---
const StockPriceChart = ({ priceData = [], smaShortData = [], smaLongData = [], volumeData = [], signalMarkers = [], darkMode = false }) => {
    const chartRef = useRef(null); 

    if (!priceData || priceData.length === 0) {
        return <div style={{ minHeight: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><p>No historical data for chart.</p></div>;
    }

    // Prepare datasets
    const candlestickData = formatCandlestickDataChartJS(priceData);
    const smaShortLineData = formatLineDataChartJS(smaShortData, 'smaShort');
    const smaLongLineData = formatLineDataChartJS(smaLongData, 'smaLong');
    const volumeBarData = formatVolumeDataChartJS(volumeData);

    // --- Prepare Annotations ---
    const annotations = (signalMarkers || []).map(marker => {
        const markerTime = new Date(marker.time).getTime(); 
        const markerPrice = marker.priceAtSignal;
        if (isNaN(markerTime) || markerPrice === null || isNaN(markerPrice)) return null; 
        const isBuy = marker.type === 'BUY';
        
        return {
            type: 'point', 
            xValue: markerTime,
            yValue: markerPrice,
            // Position the annotation relative to the main price scale
            xScaleID: 'x', // Attach to the main time scale
            yScaleID: 'yPrice', // Attach to the main price scale
            
            // Style the point
            backgroundColor: isBuy ? 'rgba(38, 166, 154, 0.7)' : 'rgba(239, 83, 80, 0.7)', // Semi-transparent Green/Red
            borderColor: isBuy ? '#1a9688' : '#c53030', // Darker border green/red
            borderWidth: 1,
            radius: 6, // Slightly larger marker
            
            // Optional: Add hover effects or labels later if needed
            // E.g., drawTime: 'afterDatasetsDraw' // Draw markers on top
        };
    }).filter(Boolean); // Remove null entries
    // --- End Prepare Annotations ---


    const chartData = {
        datasets: [
            // Order matters for drawing layers
             { label: 'Volume', data: volumeBarData, type: 'bar', yAxisID: 'yVolume', order: 4 }, // Draw volume first (behind lines)
             { label: `SMA ${LONG_WINDOW}`, data: smaLongLineData, type: 'line', borderColor: darkMode ? '#63b3ed' : '#2962ff', borderWidth: 1.5, pointRadius: 0, tension: 0.1, yAxisID: 'yPrice', order: 3 },
             { label: `SMA ${SHORT_WINDOW}`, data: smaShortLineData, type: 'line', borderColor: darkMode ? '#ffc107' : '#ffa726', borderWidth: 1.5, pointRadius: 0, tension: 0.1, yAxisID: 'yPrice', order: 2 },
             { label: 'Price', data: candlestickData, type: 'candlestick', yAxisID: 'yPrice', order: 1, color: { up: darkMode ? '#26a69a' : '#26a69a', down: darkMode ? '#ef5350' : '#ef5350', unchanged: '#999999'} }
        ]
    };

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false, 
        interaction: { mode: 'index', intersect: false },
        plugins: {
            legend: { position: 'top', labels: { color: darkMode ? '#D1D4DC' : '#333' } },
            title: { display: true, text: 'Stock Price, SMAs & Volume', color: darkMode ? '#D1D4DC' : '#333' },
            tooltip: { /* Customize if needed */ },
            zoom: { // Keep zoom/pan config
                zoom: { wheel: { enabled: true, speed: 0.1 }, pinch: { enabled: true }, mode: 'x' },
                pan: { enabled: true, mode: 'x', threshold: 5 },
                limits: { x: { min: 'original', max: 'original', minRange: 50 * 24 * 60 * 60 * 1000 } },
            },
            // --- ADD ANNOTATION CONFIG ---
            annotation: {
                // drawTime: 'afterDatasetsDraw', // Draw annotations on top of datasets
                annotations: annotations // The array of points we prepared
            }
            // --- END ANNOTATION CONFIG ---
        },
        scales: {
            x: {
                type: 'time',
                time: { unit: 'day', tooltipFormat: 'PP', displayFormats: { day: 'MMM d, yy'} },
                ticks: { color: darkMode ? '#D1D4DC' : '#555', maxRotation: 0, autoSkip: true, autoSkipPadding: 15 }, 
                grid: { color: darkMode ? '#2d3748' : '#E6E6E6' }
            },
            yPrice: { 
                type: 'linear', position: 'left',
                ticks: { color: darkMode ? '#D1D4DC' : '#555' },
                grid: { color: darkMode ? '#2d3748' : '#E6E6E6' },
            },
            yVolume: { 
                type: 'linear', position: 'right', 
                ticks: { 
                    color: darkMode ? '#D1D4DC' : '#555',
                    callback: function(value) { 
                        if (value >= 1e7) return (value / 1e7).toFixed(1) + 'Cr';
                        if (value >= 1e5) return (value / 1e5).toFixed(0) + 'L';
                        if (value >= 1e3) return (value / 1e3).toFixed(0) + 'K';
                        return value;
                    }
                 },
                grid: { drawOnChartArea: false }, 
                min: 0, 
                weight: 0.3 
            }
        }
    };

    return (
        <div style={{ height: '450px', position: 'relative' }}>
            {/* Using Chart component from react-chartjs-2 */}
            <Chart 
                ref={chartRef} // Assign ref if you need to access chart instance later
                type='candlestick' // Base type
                options={chartOptions} 
                data={chartData} 
            /> 
        </div>
    );
};

export default StockPriceChart;