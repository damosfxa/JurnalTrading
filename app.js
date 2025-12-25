// === BYBIT API CONFIGURATION ===
// ⚠️ HARDCODED API - Only for personal use, don't share this file!
const BYBIT_CONFIG = {
    apiKey: 'MASUKKAN_API_KEY_KAMU_DISINI',
    apiSecret: 'MASUKKAN_API_SECRET_KAMU_DISINI',
    testnet: false
};

// === APP STATE ===
const AppState = {
    trades: [],
    apiConfig: {
        apiKey: BYBIT_CONFIG.apiKey,
        apiSecret: BYBIT_CONFIG.apiSecret,
        connected: BYBIT_CONFIG.apiKey !== 'MASUKKAN_API_KEY_KAMU_DISINI'
    },
    marketData: {},
    settings: {
        takerFee: 0.055,
        makerFee: 0.02
    }
};

let priceUpdateInterval = null;
let clockInterval = null;

// === INITIALIZATION ===
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    initTabNavigation();
    initCalculator();
    initTracker();
    initSettings();
    renderTradeHistory();
    updateStats();
    
    if (AppState.apiConfig.connected) {
        autoConnectApi();
    }
});

// === TAB NAVIGATION ===
function initTabNavigation() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.dataset.tab;
            
            tabButtons.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            
            btn.classList.add('active');
            document.getElementById(targetTab).classList.add('active');
        });
    });
}

// === CALCULATOR LOGIC ===
function initCalculator() {
    loadWalletBalance();
    
    document.getElementById('walletBalance').addEventListener('input', () => {
        autoCalculateRiskAndLeverage();
        updateRiskAmount();
        saveWalletBalance();
    });
    
    autoCalculateRiskAndLeverage();
    updateRiskAmount();
    startRealtimeClock();
}

function saveWalletBalance() {
    const balance = document.getElementById('walletBalance').value;
    localStorage.setItem('cryptoCalculatorWalletBalance', balance);
}

function loadWalletBalance() {
    const savedBalance = localStorage.getItem('cryptoCalculatorWalletBalance');
    if (savedBalance) {
        document.getElementById('walletBalance').value = savedBalance;
    }
}

function updateRiskAmount() {
    const wallet = parseFloat(document.getElementById('walletBalance').value) || 0;
    const riskPct = parseFloat(document.getElementById('riskPercent').value) || 0;
    const riskAmount = (wallet * riskPct) / 100;
    
    document.getElementById('totalRiskAmount').textContent = `$${riskAmount.toFixed(2)}`;
}

// === AUTO CALCULATE RISK & LEVERAGE ===
function autoCalculateRiskAndLeverage() {
    const wallet = parseFloat(document.getElementById('walletBalance').value) || 0;
    
    if (wallet <= 0) {
        document.getElementById('riskPercent').value = '10';
        document.getElementById('defaultLeverage').value = '10';
        return;
    }
    
    const baseRisk = calculateBaseRisk(wallet);
    const baseLeverage = calculateBaseLeverage(wallet);
    
    const marketMultiplier = getMarketVolatilityMultiplier();
    
    const finalRisk = Math.max(3, Math.min(20, baseRisk * marketMultiplier.risk));
    const finalLeverage = Math.max(2, Math.min(20, baseLeverage * marketMultiplier.leverage));
    
    document.getElementById('riskPercent').value = finalRisk.toFixed(1);
    document.getElementById('defaultLeverage').value = Math.round(finalLeverage);
    
    updateMarketConditionIndicator(marketMultiplier.condition);
}

function calculateBaseRisk(wallet) {
    if (wallet <= 100) {
        return 15 - (wallet / 100) * 3;
    } else if (wallet <= 1000) {
        return 12 - ((wallet - 100) / 900) * 4;
    } else if (wallet <= 5000) {
        return 8 - ((wallet - 1000) / 4000) * 3;
    } else {
        return Math.max(3, 5 - ((wallet - 5000) / 10000) * 2);
    }
}

function calculateBaseLeverage(wallet) {
    if (wallet <= 100) {
        return 20 - (wallet / 100) * 2;
    } else if (wallet <= 1000) {
        return 18 - ((wallet - 100) / 900) * 6;
    } else if (wallet <= 5000) {
        return 12 - ((wallet - 1000) / 4000) * 6;
    } else {
        return Math.max(3, 6 - ((wallet - 5000) / 10000) * 3);
    }
}

function getMarketVolatilityMultiplier() {
    const btcData = AppState.marketData?.BTCUSDT;
    
    if (!btcData || !btcData.priceChangePercent) {
        return { condition: 'Normal', risk: 1.0, leverage: 1.0 };
    }
    
    const volatility = Math.abs(parseFloat(btcData.priceChangePercent));
    
    if (volatility < 2) {
        return { condition: 'Low Volatility', risk: 1.2, leverage: 1.1 };
    } else if (volatility < 5) {
        return { condition: 'Normal', risk: 1.0, leverage: 1.0 };
    } else if (volatility < 10) {
        return { condition: 'High Volatility', risk: 0.7, leverage: 0.6 };
    } else {
        return { condition: 'Extreme Volatility', risk: 0.4, leverage: 0.3 };
    }
}

function updateMarketConditionIndicator(condition) {
    const priceStatusEl = document.getElementById('priceStatus');
    if (!priceStatusEl) return;
    
    const currentText = priceStatusEl.textContent;
    if (currentText.includes(condition)) return;
    
    let color, icon;
    switch(condition) {
        case 'Low Volatility':
            color = 'var(--success)';
            icon = '🟢';
            break;
        case 'Normal':
            color = 'var(--accent)';
            icon = '🔵';
            break;
        case 'High Volatility':
            color = 'var(--warning)';
            icon = '🟡';
            break;
        case 'Extreme Volatility':
            color = 'var(--danger)';
            icon = '🔴';
            break;
        default:
            color = 'var(--text-muted)';
            icon = '⚪';
    }
    
    priceStatusEl.innerHTML = `<span style="color: ${color};">${icon}</span> ${condition}`;
    
    priceStatusEl.style.transition = 'transform 0.3s';
    priceStatusEl.style.transform = 'scale(1.05)';
    setTimeout(() => { priceStatusEl.style.transform = 'scale(1)'; }, 300);
    
    console.log(`Market condition changed: ${condition}`);
}

// === REAL-TIME CLOCK ===
function startRealtimeClock() {
    if (clockInterval) clearInterval(clockInterval);
    
    updateClock();
    clockInterval = setInterval(updateClock, 1000);
}

function updateClock() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const timeStr = `${hours}:${minutes}:${seconds}`;
    
    const updateEl = document.getElementById('lastUpdate');
    if (updateEl) updateEl.textContent = timeStr;
}

// === BYBIT API ===
function autoConnectApi() {
    AppState.apiConfig.connected = true;
    updateApiStatus(true);
    
    fetchBTCMarketData();
    startPriceUpdates();
    
    console.log('✓ Auto-connected with hardcoded API credentials');
}

function updateApiStatus(connected) {
    const statusEl = document.getElementById('apiStatus');
    if (connected) {
        statusEl.textContent = '✓ Connected (API from code)';
        statusEl.style.color = 'var(--success)';
    } else {
        statusEl.textContent = '⚠ Not connected - Check API key in app.js';
        statusEl.style.color = 'var(--warning)';
    }
}

async function fetchBTCMarketData() {
    try {
        const response = await fetch('https://api.bybit.com/v5/market/tickers?category=linear&symbol=BTCUSDT');
        const data = await response.json();
        
        if (data.retCode === 0 && data.result.list.length > 0) {
            const ticker = data.result.list[0];
            AppState.marketData.BTCUSDT = {
                priceChangePercent: ticker.price24hPcnt,
                volume24h: ticker.volume24h
            };
            
            autoCalculateRiskAndLeverage();
        }
    } catch (error) {
        console.error('Error fetching BTC data:', error);
    }
}

function startPriceUpdates() {
    if (priceUpdateInterval) clearInterval(priceUpdateInterval);
    
    priceUpdateInterval = setInterval(() => {
        fetchBTCMarketData();
    }, 5000);
    
    console.log('✓ Auto-refresh started: Updates every 5 seconds');
}

// === TRACKER ===
function initTracker() {
    document.getElementById('addManualTradeBtn').addEventListener('click', addManualTrade);
    document.getElementById('exportBtn').addEventListener('click', exportToCSV);
    document.getElementById('clearHistoryBtn').addEventListener('click', clearHistory);
    
    const inputs = ['manualEntry', 'manualTP', 'manualSL', 'manualQty', 'manualType'];
    inputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', updateCalculationPreview);
    });
}

function updateCalculationPreview() {
    const entry = parseFloat(document.getElementById('manualEntry').value) || 0;
    const tp = parseFloat(document.getElementById('manualTP').value) || 0;
    const sl = parseFloat(document.getElementById('manualSL').value) || 0;
    const quantity = parseFloat(document.getElementById('manualQty').value) || 0;
    const type = document.getElementById('manualType').value;
    
    const preview = document.getElementById('calculationPreview');
    
    if (entry > 0 && quantity > 0 && (tp > 0 || sl > 0)) {
        preview.style.display = 'block';
        
        const positionValue = quantity * entry;
        document.getElementById('previewPositionValue').textContent = `${positionValue.toFixed(2)} USDT`;
        
        let tpProfit = 0;
        if (tp > 0) {
            tpProfit = type === 'long' ? (tp - entry) * quantity : (entry - tp) * quantity;
        }
        document.getElementById('previewTPProfit').textContent = tpProfit > 0 ? `+${tpProfit.toFixed(2)} USDT` : '-';
        
        let slLoss = 0;
        if (sl > 0) {
            slLoss = type === 'long' ? (sl - entry) * quantity : (entry - sl) * quantity;
        }
        document.getElementById('previewSLLoss').textContent = slLoss < 0 ? `${slLoss.toFixed(2)} USDT` : '-';
        
        if (tpProfit > 0 && slLoss < 0) {
            const rrRatio = Math.abs(tpProfit / slLoss);
            document.getElementById('previewRR').textContent = `1:${rrRatio.toFixed(2)}`;
        } else {
            document.getElementById('previewRR').textContent = '-';
        }
    } else {
        preview.style.display = 'none';
    }
}

function addManualTrade() {
    const symbol = document.getElementById('manualSymbol').value.trim() || 'UNKNOWN';
    const entry = parseFloat(document.getElementById('manualEntry').value) || 0;
    const tp = parseFloat(document.getElementById('manualTP').value) || 0;
    const sl = parseFloat(document.getElementById('manualSL').value) || 0;
    const quantity = parseFloat(document.getElementById('manualQty').value) || 0;
    const leverage = parseFloat(document.getElementById('manualLeverage').value) || 1;
    const type = document.getElementById('manualType').value;
    const result = document.getElementById('manualResult').value;

    if (entry <= 0 || quantity <= 0) {
        alert('Please fill Entry Price and Quantity');
        return;
    }

    let pnl = 0;
    let exitPrice = 0;
    let rrRatio = 0;
    
    if (result === 'win' && tp > 0) {
        exitPrice = tp;
        pnl = type === 'long' ? (tp - entry) * quantity : (entry - tp) * quantity;
    } else if (result === 'loss' && sl > 0) {
        exitPrice = sl;
        pnl = type === 'long' ? (sl - entry) * quantity : (entry - sl) * quantity;
    } else if (result === 'breakeven') {
        exitPrice = entry;
        pnl = 0;
    }
    
    if (tp > 0 && sl > 0) {
        let tpProfit, slLoss;
        if (type === 'long') {
            tpProfit = (tp - entry) * quantity;
            slLoss = Math.abs((sl - entry) * quantity);
        } else {
            tpProfit = (entry - tp) * quantity;
            slLoss = Math.abs((entry - sl) * quantity);
        }
        rrRatio = (tpProfit / slLoss).toFixed(2);
    }

    const trade = {
        id: Date.now(),
        date: new Date().toISOString(),
        symbol: symbol,
        type: type,
        entry: entry,
        sl: sl,
        tp: tp,
        exit: exitPrice,
        leverage: leverage,
        quantity: quantity,
        pnl: pnl,
        rrRatio: rrRatio || '0',
        result: result
    };

    AppState.trades.unshift(trade);
    saveData();
    renderTradeHistory();
    updateStats();

    document.getElementById('manualSymbol').value = '';
    document.getElementById('manualEntry').value = '';
    document.getElementById('manualTP').value = '';
    document.getElementById('manualSL').value = '';
    document.getElementById('manualQty').value = '';
    document.getElementById('manualLeverage').value = '10';
    document.getElementById('calculationPreview').style.display = 'none';
    
    alert('Trade added successfully!');
}

function renderTradeHistory() {
    const tbody = document.getElementById('tradeTableBody');
    
    if (AppState.trades.length === 0) {
        tbody.innerHTML = '<tr class="empty-state"><td colspan="11">No trades recorded yet. Add your trades above.</td></tr>';
        return;
    }

    tbody.innerHTML = AppState.trades.map(trade => {
        const date = new Date(trade.date).toLocaleDateString();
        const symbol = trade.symbol || '-';
        
        // Simple badges without nested spans
        const typeText = trade.type === 'long' ? 'LONG' : 'SHORT';
        const typeClass = trade.type === 'long' ? 'badge-long' : 'badge-short';
        
        let resultText = '';
        let resultClass = '';
        if (trade.result === 'win') { resultText = 'WIN'; resultClass = 'badge-win'; }
        else if (trade.result === 'loss') { resultText = 'LOSS'; resultClass = 'badge-loss'; }
        else if (trade.result === 'breakeven') { resultText = 'BE'; resultClass = 'badge-breakeven'; }
        else { resultText = 'PENDING'; resultClass = ''; }

        const pnlClass = trade.pnl > 0 ? 'result-profit' : trade.pnl < 0 ? 'result-loss' : '';
        const entryPrice = trade.entry >= 1 ? trade.entry.toFixed(2) : trade.entry.toFixed(6);
        const exitPrice = trade.exit > 0 ? (trade.exit >= 1 ? trade.exit.toFixed(2) : trade.exit.toFixed(6)) : '-';
        const displayQty = trade.quantity.toFixed(2);
        const pnlText = `${trade.pnl >= 0 ? '+' : ''}${trade.pnl.toFixed(2)} USDT`;

        return `
            <tr>
                <td>${date}</td>
                <td>${symbol}</td>
                <td><span class="badge ${typeClass}">${typeText}</span></td>
                <td>$${entryPrice}</td>
                <td>${exitPrice !== '-' ? '$' + exitPrice : '-'}</td>
                <td>${displayQty}</td>
                <td>${trade.leverage}x</td>
                <td class="${pnlClass}">${pnlText}</td>
                <td>1:${trade.rrRatio}</td>
                <td><span class="badge ${resultClass}">${resultText}</span></td>
                <td><button class="btn-icon" onclick="deleteTrade(${trade.id})">Delete</button></td>
            </tr>
        `;
    }).join('');
}

function deleteTrade(id) {
    if (!confirm('Delete this trade?')) return;
    AppState.trades = AppState.trades.filter(t => t.id !== id);
    saveData();
    renderTradeHistory();
    updateStats();
}

function updateStats() {
    const total = AppState.trades.length;
    const wins = AppState.trades.filter(t => t.result === 'win').length;
    const losses = AppState.trades.filter(t => t.result === 'loss').length;
    const winRate = total > 0 ? ((wins / total) * 100).toFixed(1) : '0';
    const totalPnL = AppState.trades.reduce((sum, t) => sum + t.pnl, 0);
    
    const rrValues = AppState.trades.map(t => parseFloat(t.rrRatio) || 0).filter(r => r > 0);
    const avgRR = rrValues.length > 0 ? (rrValues.reduce((a, b) => a + b, 0) / rrValues.length).toFixed(2) : '0';

    document.getElementById('totalTrades').textContent = total;
    document.getElementById('winRate').textContent = `${winRate}%`;
    document.getElementById('totalPnL').textContent = `${totalPnL >= 0 ? '+' : ''}$${totalPnL.toFixed(2)}`;
    document.getElementById('avgRR').textContent = `1:${avgRR}`;
    
    const pnlEl = document.getElementById('totalPnL');
    pnlEl.style.color = totalPnL >= 0 ? 'var(--success)' : 'var(--danger)';

    // Advanced stats
    updateAdvancedStats();
}

function updateAdvancedStats() {
    const trades = AppState.trades;
    
    // Current streak
    let streak = 0;
    let streakType = '';
    if (trades.length > 0) {
        const lastResult = trades[0].result;
        if (lastResult === 'win' || lastResult === 'loss') {
            streakType = lastResult === 'win' ? 'W' : 'L';
            for (let i = 0; i < trades.length; i++) {
                if (trades[i].result === lastResult) {
                    streak++;
                } else {
                    break;
                }
            }
        }
    }
    document.getElementById('currentStreak').textContent = streak > 0 ? `${streak}${streakType}` : '-';
    
    // Best and worst trades
    const pnls = trades.map(t => t.pnl);
    const bestTrade = pnls.length > 0 ? Math.max(...pnls) : 0;
    const worstTrade = pnls.length > 0 ? Math.min(...pnls) : 0;
    
    document.getElementById('bestTrade').textContent = bestTrade > 0 ? `+$${bestTrade.toFixed(2)}` : '-';
    document.getElementById('worstTrade').textContent = worstTrade < 0 ? `$${worstTrade.toFixed(2)}` : '-';
    
    // Average win/loss
    const winTrades = trades.filter(t => t.result === 'win');
    const lossTrades = trades.filter(t => t.result === 'loss');
    
    const avgWin = winTrades.length > 0 
        ? winTrades.reduce((sum, t) => sum + t.pnl, 0) / winTrades.length 
        : 0;
    const avgLoss = lossTrades.length > 0 
        ? lossTrades.reduce((sum, t) => sum + t.pnl, 0) / lossTrades.length 
        : 0;
    
    document.getElementById('avgWin').textContent = avgWin > 0 ? `+$${avgWin.toFixed(2)}` : '-';
    document.getElementById('avgLoss').textContent = avgLoss < 0 ? `$${avgLoss.toFixed(2)}` : '-';
    
    // Profit factor
    const totalWins = winTrades.reduce((sum, t) => sum + t.pnl, 0);
    const totalLosses = Math.abs(lossTrades.reduce((sum, t) => sum + t.pnl, 0));
    const profitFactor = totalLosses > 0 ? (totalWins / totalLosses).toFixed(2) : totalWins > 0 ? '∞' : '-';
    
    document.getElementById('profitFactor').textContent = profitFactor;
}

function exportToCSV() {
    if (AppState.trades.length === 0) {
        alert('No trades to export');
        return;
    }

    const headers = ['Date', 'Symbol', 'Type', 'Entry', 'Exit', 'Quantity', 'Leverage', 'P&L', 'R:R', 'Result'];
    const rows = AppState.trades.map(t => [
        new Date(t.date).toLocaleDateString(),
        t.symbol,
        t.type,
        t.entry,
        t.exit || '',
        t.quantity,
        t.leverage,
        t.pnl.toFixed(2),
        `1:${t.rrRatio}`,
        t.result
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trades_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
}

function clearHistory() {
    if (!confirm('Clear all trade history? This cannot be undone.')) return;
    AppState.trades = [];
    saveData();
    renderTradeHistory();
    updateStats();
}

// === SETTINGS ===
function initSettings() {
    document.getElementById('saveFeesBtn').addEventListener('click', saveFees);
    document.getElementById('exportDataBtn').addEventListener('click', exportData);
    document.getElementById('importDataBtn').addEventListener('click', () => document.getElementById('importFileInput').click());
    document.getElementById('importFileInput').addEventListener('change', importData);
    document.getElementById('resetBtn').addEventListener('click', resetData);
    
    document.getElementById('takerFee').value = AppState.settings.takerFee;
    document.getElementById('makerFee').value = AppState.settings.makerFee;
}

function saveFees() {
    AppState.settings.takerFee = parseFloat(document.getElementById('takerFee').value) || 0.055;
    AppState.settings.makerFee = parseFloat(document.getElementById('makerFee').value) || 0.02;
    saveData();
    alert('Fees saved!');
}

function exportData() {
    const data = { trades: AppState.trades, settings: AppState.settings };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `calculator_data_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
}

function importData(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            AppState.trades = data.trades || [];
            AppState.settings = data.settings || AppState.settings;
            saveData();
            renderTradeHistory();
            updateStats();
            alert('Data imported successfully!');
        } catch (error) {
            alert('Invalid data file');
        }
    };
    reader.readAsText(file);
}

function resetData() {
    if (!confirm('Reset ALL data? This will delete everything and cannot be undone.')) return;
    localStorage.clear();
    location.reload();
}

// === DATA PERSISTENCE ===
function saveData() {
    localStorage.setItem('cryptoCalculatorTrades', JSON.stringify(AppState.trades));
    localStorage.setItem('cryptoCalculatorSettings', JSON.stringify(AppState.settings));
}

function loadData() {
    const trades = localStorage.getItem('cryptoCalculatorTrades');
    const settings = localStorage.getItem('cryptoCalculatorSettings');
    
    if (trades) AppState.trades = JSON.parse(trades);
    if (settings) AppState.settings = JSON.parse(settings);
}