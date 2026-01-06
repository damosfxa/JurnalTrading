// === APP STATE ===
const AppState = {
    currentMonthTrades: [],
    monthlyArchives: [], // Format: { year: 2026, month: 1, monthName: 'January', ... }
    settings: {
        takerFee: 0.055,
        makerFee: 0.02,
        targetROI: 120,
        withdrawalPercent: 67,
        compoundPercent: 33
    },
    currentMonth: getCurrentMonthKey(),
    monthStartBalance: 100,
    charts: { equityCurve: null, winRate: null, withdrawal: null }
};

let calculationDebounceTimer = null;

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// === HELPER FUNCTIONS ===
function getCurrentMonthKey() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function getMonthName(monthKey) {
    const [year, month] = monthKey.split('-');
    const date = new Date(year, parseInt(month) - 1);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

// === INITIALIZATION ===
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Crypto Trading Calculator - Auto-Archive Version');
    
    loadData();
    autoArchiveCheck(); // Check if month changed
    initTabNavigation();
    initWalletBalance();
    initTracker();
    initSettings();
    initMonthlyReports();
    renderTradeHistory();
    updateStats();
    updateGoalProgress();
    updateCurrentMonthDisplay();
    fetchBTCPrice();
    
    console.log('✅ Initialized with auto-archive!');
});

// === AUTO-ARCHIVE SYSTEM ===
function autoArchiveCheck() {
    const savedMonth = localStorage.getItem('cryptoCalculatorCurrentMonth');
    const currentMonth = getCurrentMonthKey();
    
    if (savedMonth && savedMonth !== currentMonth) {
        console.log(`📅 Month changed: ${savedMonth} → ${currentMonth}`);
        
        // Auto archive old month if has trades
        if (AppState.currentMonthTrades.length > 0) {
            const [year, month] = savedMonth.split('-');
            autoArchiveMonth(parseInt(year), parseInt(month));
        }
    }
    
    localStorage.setItem('cryptoCalculatorCurrentMonth', currentMonth);
    AppState.currentMonth = currentMonth;
}

function autoArchiveMonth(year, month) {
    const trades = [...AppState.currentMonthTrades];
    const stats = calculateStats(trades);
    const wallet = AppState.monthStartBalance || 100;
    const targetROI = AppState.settings.targetROI || 120;
    const targetProfit = (wallet * targetROI) / 100;
    const withdrawPct = AppState.settings.withdrawalPercent || 67;
    const compoundPct = AppState.settings.compoundPercent || 33;
    
    const withdrawn = (stats.totalPnL * withdrawPct) / 100;
    const compounded = (stats.totalPnL * compoundPct) / 100;
    const endBalance = wallet + compounded;
    
    const archive = {
        year: year,
        month: month,
        monthName: MONTH_NAMES[month - 1],
        archivedDate: new Date().toISOString(),
        trades: trades,
        stats: stats,
        startBalance: wallet,
        targetProfit: targetProfit,
        actualProfit: stats.totalPnL,
        withdrawn: withdrawn,
        compounded: compounded,
        endBalance: endBalance
    };
    
    // Add to archives
    AppState.monthlyArchives.push(archive);
    
    // Clear current month
    AppState.currentMonthTrades = [];
    
    // Update wallet for new month
    document.getElementById('walletBalance').value = endBalance.toFixed(2);
    localStorage.setItem('cryptoCalculatorWalletBalance', endBalance.toFixed(2));
    AppState.monthStartBalance = endBalance;
    
    saveData();
    
    console.log(`✅ Auto-archived: ${MONTH_NAMES[month - 1]} ${year}`);
    alert(`✅ ${MONTH_NAMES[month - 1]} ${year} auto-archived!\n\nNew wallet: $${endBalance.toFixed(2)}`);
}

function updateCurrentMonthDisplay() {
    const monthName = getMonthName(AppState.currentMonth);
    const monthTitle = document.getElementById('currentMonthTitle');
    const goalMonthName = document.getElementById('goalMonthName');
    
    if (monthTitle) monthTitle.textContent = `📅 ${monthName}`;
    if (goalMonthName) goalMonthName.textContent = monthName;
}

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
            
            if (targetTab === 'monthly') {
                renderMonthlyReports();
                renderCharts();
            }
        });
    });
}

// === WALLET BALANCE ===
function initWalletBalance() {
    const walletInput = document.getElementById('walletBalance');
    
    const savedBalance = localStorage.getItem('cryptoCalculatorWalletBalance');
    if (savedBalance) {
        walletInput.value = savedBalance;
        AppState.monthStartBalance = parseFloat(savedBalance);
    }
    
    walletInput.addEventListener('input', () => {
        const balance = parseFloat(walletInput.value) || 100;
        localStorage.setItem('cryptoCalculatorWalletBalance', balance);
        updateTargetDisplays();
        updateGoalProgress();
    });
    
    updateTargetDisplays();
}

function updateTargetDisplays() {
    const wallet = parseFloat(document.getElementById('walletBalance').value) || 100;
    const targetROI = AppState.settings.targetROI || 120;
    const targetProfit = (wallet * targetROI) / 100;
    const endBalance = wallet + targetProfit;
    
    const quickTarget = document.getElementById('quickTarget');
    const quickEndBalance = document.getElementById('quickEndBalance');
    
    if (quickTarget) quickTarget.textContent = `$${targetProfit.toFixed(0)}`;
    if (quickEndBalance) quickEndBalance.textContent = `$${endBalance.toFixed(0)}`;
}

// === BTC PRICE ===
async function fetchBTCPrice() {
    try {
        const response = await fetch('https://api.bybit.com/v5/market/tickers?category=linear&symbol=BTCUSDT');
        const data = await response.json();
        
        if (data.retCode === 0 && data.result.list.length > 0) {
            const price = parseFloat(data.result.list[0].lastPrice);
            document.getElementById('btcPriceMini').textContent = `$${price.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
        }
    } catch (error) {
        document.getElementById('btcPriceMini').textContent = 'Offline';
    }
    
    setTimeout(fetchBTCPrice, 30000);
}

// === TRACKER ===
function initTracker() {
    document.getElementById('addManualTradeBtn').addEventListener('click', addManualTrade);
    document.getElementById('exportBtn').addEventListener('click', exportToCSV);
    document.getElementById('clearHistoryBtn').addEventListener('click', clearHistory);
    document.getElementById('timeFilter').addEventListener('change', filterTrades);
    
    const inputs = ['manualEntry', 'manualTP', 'manualSL', 'manualQty', 'manualType'];
    inputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', () => {
                clearTimeout(calculationDebounceTimer);
                calculationDebounceTimer = setTimeout(updateCalculationPreview, 300);
            });
        }
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
        document.getElementById('previewTPProfit').textContent = tpProfit > 0 ? `+${tpProfit.toFixed(2)}` : '-';
        
        let slLoss = 0;
        if (sl > 0) {
            slLoss = type === 'long' ? (sl - entry) * quantity : (entry - sl) * quantity;
        }
        document.getElementById('previewSLLoss').textContent = slLoss < 0 ? `${slLoss.toFixed(2)}` : '-';
        
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
    const symbol = document.getElementById('manualSymbol').value.trim().toUpperCase() || 'UNKNOWN';
    const entry = parseFloat(document.getElementById('manualEntry').value) || 0;
    const tp = parseFloat(document.getElementById('manualTP').value) || 0;
    const sl = parseFloat(document.getElementById('manualSL').value) || 0;
    const quantity = parseFloat(document.getElementById('manualQty').value) || 0;
    const leverage = parseFloat(document.getElementById('manualLeverage').value) || 1;
    const type = document.getElementById('manualType').value;
    const result = document.getElementById('manualResult').value;

    if (entry <= 0 || quantity <= 0) {
        alert('⚠️ Please fill Entry Price and Quantity');
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

    AppState.currentMonthTrades.unshift(trade);
    saveData();
    renderTradeHistory();
    updateStats();
    updateGoalProgress();

    document.getElementById('manualSymbol').value = '';
    document.getElementById('manualEntry').value = '';
    document.getElementById('manualTP').value = '';
    document.getElementById('manualSL').value = '';
    document.getElementById('manualQty').value = '';
    document.getElementById('manualLeverage').value = '10';
    document.getElementById('calculationPreview').style.display = 'none';
    
    console.log('✅ Trade added!');
}

function filterTrades() {
    const filter = document.getElementById('timeFilter').value;
    let filteredTrades = [...AppState.currentMonthTrades];
    
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    
    switch(filter) {
        case 'today':
            filteredTrades = AppState.currentMonthTrades.filter(t => new Date(t.date) >= todayStart);
            break;
        case 'week':
            filteredTrades = AppState.currentMonthTrades.filter(t => new Date(t.date) >= weekStart);
            break;
        case 'month':
            filteredTrades = AppState.currentMonthTrades.filter(t => new Date(t.date) >= monthStart);
            break;
    }
    
    renderTradeHistory(filteredTrades);
}

function renderTradeHistory(tradesToRender = null) {
    const tbody = document.getElementById('tradeTableBody');
    const trades = tradesToRender || AppState.currentMonthTrades;
    
    if (trades.length === 0) {
        tbody.innerHTML = '<tr class="empty-state"><td colspan="11">No trades yet. Add your first trade above! 👆</td></tr>';
        return;
    }

    tbody.innerHTML = trades.map(trade => {
        const date = new Date(trade.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const time = new Date(trade.date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        
        const entryPrice = trade.entry >= 1 ? trade.entry.toFixed(2) : trade.entry.toFixed(6);
        const exitPrice = trade.exit > 0 ? (trade.exit >= 1 ? trade.exit.toFixed(2) : trade.exit.toFixed(6)) : '-';
        
        const pnlClass = trade.pnl > 0 ? 'result-profit' : trade.pnl < 0 ? 'result-loss' : '';
        const pnlText = `${trade.pnl >= 0 ? '+' : ''}${trade.pnl.toFixed(2)}`;
        
        const typeClass = trade.type === 'long' ? 'badge-long' : 'badge-short';
        const typeText = trade.type.toUpperCase();
        
        let resultClass = '', resultText = '';
        if (trade.result === 'win') { 
            resultText = 'WIN'; 
            resultClass = 'badge-win'; 
        } else if (trade.result === 'loss') { 
            resultText = 'LOSS'; 
            resultClass = 'badge-loss'; 
        } else if (trade.result === 'breakeven') { 
            resultText = 'BE'; 
            resultClass = 'badge-breakeven'; 
        } else { 
            resultText = 'PENDING'; 
        }

        return `
            <tr>
                <td>
                    <div style="font-size: 12px;">${date}</div>
                    <div style="font-size: 10px; color: var(--text-muted);">${time}</div>
                </td>
                <td><strong>${trade.symbol}</strong></td>
                <td><span class="badge ${typeClass}">${typeText}</span></td>
                <td>$${entryPrice}</td>
                <td>${exitPrice !== '-' ? '$' + exitPrice : '-'}</td>
                <td>${trade.quantity.toFixed(2)}</td>
                <td>${trade.leverage}x</td>
                <td class="${pnlClass}"><strong>${pnlText}</strong></td>
                <td>1:${trade.rrRatio}</td>
                <td><span class="badge ${resultClass}">${resultText}</span></td>
                <td><button class="btn-icon" onclick="deleteTrade(${trade.id})">Del</button></td>
            </tr>
        `;
    }).join('');
}

function deleteTrade(id) {
    if (!confirm('Delete this trade?')) return;
    AppState.currentMonthTrades = AppState.currentMonthTrades.filter(t => t.id !== id);
    saveData();
    renderTradeHistory();
    updateStats();
    updateGoalProgress();
}

function calculateStats(trades) {
    const total = trades.length;
    const wins = trades.filter(t => t.result === 'win').length;
    const winRate = total > 0 ? ((wins / total) * 100).toFixed(1) : '0';
    const totalPnL = trades.reduce((sum, t) => sum + t.pnl, 0);
    
    const rrValues = trades.map(t => parseFloat(t.rrRatio) || 0).filter(r => r > 0);
    const avgRR = rrValues.length > 0 ? (rrValues.reduce((a, b) => a + b, 0) / rrValues.length).toFixed(2) : '0';
    
    const pnls = trades.map(t => t.pnl);
    const bestTrade = pnls.length > 0 ? Math.max(...pnls) : 0;
    const worstTrade = pnls.length > 0 ? Math.min(...pnls) : 0;
    
    const winTrades = trades.filter(t => t.result === 'win');
    const lossTrades = trades.filter(t => t.result === 'loss');
    
    const avgWin = winTrades.length > 0 ? winTrades.reduce((sum, t) => sum + t.pnl, 0) / winTrades.length : 0;
    const avgLoss = lossTrades.length > 0 ? lossTrades.reduce((sum, t) => sum + t.pnl, 0) / lossTrades.length : 0;
    
    const totalWins = winTrades.reduce((sum, t) => sum + t.pnl, 0);
    const totalLosses = Math.abs(lossTrades.reduce((sum, t) => sum + t.pnl, 0));
    const profitFactor = totalLosses > 0 ? (totalWins / totalLosses).toFixed(2) : totalWins > 0 ? '∞' : '-';
    
    let streak = 0, streakType = '';
    if (trades.length > 0) {
        const lastResult = trades[0].result;
        if (lastResult === 'win' || lastResult === 'loss') {
            streakType = lastResult === 'win' ? 'W' : 'L';
            for (let i = 0; i < trades.length; i++) {
                if (trades[i].result === lastResult) streak++;
                else break;
            }
        }
    }
    
    return { total, wins, winRate, totalPnL, avgRR, bestTrade, worstTrade, avgWin, avgLoss, profitFactor, streak, streakType };
}

function updateStats() {
    const stats = calculateStats(AppState.currentMonthTrades);
    
    document.getElementById('totalTrades').textContent = stats.total;
    document.getElementById('winRate').textContent = `${stats.winRate}%`;
    document.getElementById('totalPnL').textContent = `${stats.totalPnL >= 0 ? '+' : ''}$${stats.totalPnL.toFixed(2)}`;
    document.getElementById('avgRR').textContent = `1:${stats.avgRR}`;
    
    const pnlEl = document.getElementById('totalPnL');
    pnlEl.style.color = stats.totalPnL >= 0 ? 'var(--success)' : 'var(--danger)';
    
    document.getElementById('currentStreak').textContent = stats.streak > 0 ? `${stats.streak}${stats.streakType}` : '-';
    document.getElementById('bestTrade').textContent = stats.bestTrade > 0 ? `+$${stats.bestTrade.toFixed(2)}` : '-';
    document.getElementById('worstTrade').textContent = stats.worstTrade < 0 ? `$${stats.worstTrade.toFixed(2)}` : '-';
    document.getElementById('avgWin').textContent = stats.avgWin > 0 ? `+$${stats.avgWin.toFixed(2)}` : '-';
    document.getElementById('avgLoss').textContent = stats.avgLoss < 0 ? `$${stats.avgLoss.toFixed(2)}` : '-';
    document.getElementById('profitFactor').textContent = stats.profitFactor;
}

function exportToCSV() {
    if (AppState.currentMonthTrades.length === 0) {
        alert('No trades to export');
        return;
    }

    const headers = ['Date', 'Symbol', 'Type', 'Entry', 'Exit', 'Qty', 'Lev', 'P&L', 'R:R', 'Result'];
    const rows = AppState.currentMonthTrades.map(t => [
        new Date(t.date).toLocaleString(),
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
    a.download = `trades_${getMonthName(AppState.currentMonth).replace(' ', '_')}.csv`;
    a.click();
}

function clearHistory() {
    if (!confirm('Clear all trades this month?')) return;
    AppState.currentMonthTrades = [];
    saveData();
    renderTradeHistory();
    updateStats();
    updateGoalProgress();
}

// === GOAL PROGRESS ===
function updateGoalProgress() {
    const wallet = parseFloat(document.getElementById('walletBalance').value) || 100;
    const targetROI = AppState.settings.targetROI || 120;
    const targetProfit = (wallet * targetROI) / 100;
    const endBalance = wallet + targetProfit;
    
    const stats = calculateStats(AppState.currentMonthTrades);
    const currentProfit = stats.totalPnL;
    const currentBalance = wallet + currentProfit;
    const remaining = targetProfit - currentProfit;
    const percent = Math.min(100, Math.max(0, (currentProfit / targetProfit) * 100));
    
    document.getElementById('goalStartBalance').textContent = `$${wallet.toFixed(0)}`;
    document.getElementById('goalTargetProfit').textContent = `$${targetProfit.toFixed(0)}`;
    document.getElementById('goalCurrentProfit').textContent = `$${currentProfit.toFixed(2)}`;
    document.getElementById('goalCurrentProfit').style.color = currentProfit >= 0 ? 'var(--success)' : 'var(--danger)';
    document.getElementById('goalCurrentBalance').textContent = `$${currentBalance.toFixed(2)}`;
    document.getElementById('goalRemaining').textContent = `$${Math.abs(remaining).toFixed(2)}`;
    document.getElementById('goalRemaining').style.color = remaining > 0 ? 'var(--warning)' : 'var(--success)';
    document.getElementById('goalPercent').textContent = `${percent.toFixed(1)}%`;
    
    const progressFill = document.getElementById('goalProgressFill');
    const progressText = document.getElementById('goalProgressText');
    const goalBadge = document.getElementById('goalBadge');
    
    if (progressFill) {
        progressFill.style.width = `${percent}%`;
        progressFill.classList.toggle('achieved', percent >= 100);
    }
    
    if (progressText) progressText.textContent = `${percent.toFixed(1)}%`;
    if (goalBadge) goalBadge.style.display = percent >= 100 ? 'block' : 'none';
}

// === ORGANIZED MONTHLY REPORTS ===
function initMonthlyReports() {
    document.getElementById('closeModalBtn').addEventListener('click', closeMonthModal);
    document.getElementById('exportMonthBtn').addEventListener('click', exportMonthCSV);
    document.getElementById('deleteMonthBtn').addEventListener('click', deleteMonthArchive);
    
    document.getElementById('monthlyDetailModal').addEventListener('click', (e) => {
        if (e.target.id === 'monthlyDetailModal') closeMonthModal();
    });
}

function renderMonthlyReports() {
    const container = document.getElementById('monthlyReportsContainer');
    
    if (AppState.monthlyArchives.length === 0) {
        container.innerHTML = `
            <div class="empty-state-monthly">
                <div style="text-align: center; padding: 60px 20px;">
                    <div style="font-size: 48px; margin-bottom: 16px;">📊</div>
                    <h3 style="color: var(--text-secondary);">No Archives Yet</h3>
                    <p style="color: var(--text-muted); font-size: 14px; margin-top: 8px;">
                        Archives will appear here automatically at month-end
                    </p>
                </div>
            </div>
        `;
        return;
    }
    
    // Organize by month (1-12)
    const organized = {};
    for (let m = 1; m <= 12; m++) {
        organized[m] = [];
    }
    
    AppState.monthlyArchives.forEach(archive => {
        organized[archive.month].push(archive);
    });
    
    // Render each month group
    let html = '';
    for (let m = 1; m <= 12; m++) {
        const archives = organized[m];
        const monthName = MONTH_NAMES[m - 1];
        
        html += `
            <div class="month-group">
                <div class="month-group-header">📅 ${monthName}</div>
                <div class="year-list">
        `;
        
        if (archives.length === 0) {
            html += `<div class="empty-year-list">No data yet</div>`;
        } else {
            // Sort by year descending
            archives.sort((a, b) => b.year - a.year);
            
            archives.forEach(archive => {
                const pnlColor = archive.actualProfit >= 0 ? 'var(--success)' : 'var(--danger)';
                html += `
                    <div class="year-item" onclick="openMonthModal(${archive.year}, ${archive.month})">
                        <div class="year-item-icon">📊</div>
                        <div class="year-item-text" style="color: ${pnlColor};">${archive.year}</div>
                    </div>
                `;
            });
        }
        
        html += `
                </div>
            </div>
        `;
    }
    
    container.innerHTML = html;
}

let currentViewingArchive = null;

function openMonthModal(year, month) {
    const archive = AppState.monthlyArchives.find(a => a.year === year && a.month === month);
    if (!archive) return;
    
    currentViewingArchive = { year, month };
    
    document.getElementById('modalMonthTitle').textContent = `${archive.monthName} ${archive.year}`;
    document.getElementById('modalStartBalance').textContent = `$${archive.startBalance.toFixed(0)}`;
    document.getElementById('modalTotalProfit').textContent = `$${archive.actualProfit.toFixed(2)}`;
    document.getElementById('modalWithdrawn').textContent = `$${archive.withdrawn.toFixed(2)}`;
    document.getElementById('modalCompounded').textContent = `$${archive.compounded.toFixed(2)}`;
    document.getElementById('modalEndBalance').textContent = `$${archive.endBalance.toFixed(2)}`;
    
    document.getElementById('modalTotalTrades').textContent = archive.stats.total;
    document.getElementById('modalWinRate').textContent = `${archive.stats.winRate}%`;
    document.getElementById('modalBestTrade').textContent = archive.stats.bestTrade > 0 ? `+$${archive.stats.bestTrade.toFixed(2)}` : '-';
    document.getElementById('modalAvgRR').textContent = `1:${archive.stats.avgRR}`;
    
    const tbody = document.getElementById('modalTradeTableBody');
    tbody.innerHTML = archive.trades.map(trade => {
        const date = new Date(trade.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const time = new Date(trade.date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        const entryPrice = trade.entry >= 1 ? trade.entry.toFixed(2) : trade.entry.toFixed(6);
        const exitPrice = trade.exit > 0 ? (trade.exit >= 1 ? trade.exit.toFixed(2) : trade.exit.toFixed(6)) : '-';
        const pnlClass = trade.pnl > 0 ? 'result-profit' : trade.pnl < 0 ? 'result-loss' : '';
        const pnlText = `${trade.pnl >= 0 ? '+' : ''}${trade.pnl.toFixed(2)}`;
        const typeClass = trade.type === 'long' ? 'badge-long' : 'badge-short';
        const typeText = trade.type.toUpperCase();
        
        let resultClass = '', resultText = '';
        if (trade.result === 'win') { 
            resultText = 'WIN'; 
            resultClass = 'badge-win'; 
        } else if (trade.result === 'loss') { 
            resultText = 'LOSS'; 
            resultClass = 'badge-loss'; 
        } else if (trade.result === 'breakeven') { 
            resultText = 'BE'; 
            resultClass = 'badge-breakeven'; 
        } else { 
            resultText = 'PENDING'; 
        }

        return `
            <tr>
                <td>
                    <div style="font-size: 12px;">${date}</div>
                    <div style="font-size: 10px; color: var(--text-muted);">${time}</div>
                </td>
                <td><strong>${trade.symbol}</strong></td>
                <td><span class="badge ${typeClass}">${typeText}</span></td>
                <td>$${entryPrice}</td>
                <td>${exitPrice !== '-' ? '$' + exitPrice : '-'}</td>
                <td>${trade.quantity.toFixed(2)}</td>
                <td>${trade.leverage}x</td>
                <td class="${pnlClass}"><strong>${pnlText}</strong></td>
                <td>1:${trade.rrRatio}</td>
                <td><span class="badge ${resultClass}">${resultText}</span></td>
            </tr>
        `;
    }).join('');
    
    document.getElementById('monthlyDetailModal').style.display = 'flex';
}

function closeMonthModal() {
    document.getElementById('monthlyDetailModal').style.display = 'none';
    currentViewingArchive = null;
}

function exportMonthCSV() {
    if (!currentViewingArchive) return;
    const archive = AppState.monthlyArchives.find(a => a.year === currentViewingArchive.year && a.month === currentViewingArchive.month);
    if (!archive) return;
    
    const headers = ['Date', 'Symbol', 'Type', 'Entry', 'Exit', 'Qty', 'Lev', 'P&L', 'R:R', 'Result'];
    const rows = archive.trades.map(t => [
        new Date(t.date).toLocaleString(),
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
    a.download = `${archive.monthName}_${archive.year}_trades.csv`;
    a.click();
}

function deleteMonthArchive() {
    if (!currentViewingArchive) return;
    const archive = AppState.monthlyArchives.find(a => a.year === currentViewingArchive.year && a.month === currentViewingArchive.month);
    if (!archive) return;
    
    if (!confirm(`Delete ${archive.monthName} ${archive.year}?`)) return;
    
    AppState.monthlyArchives = AppState.monthlyArchives.filter(a => !(a.year === currentViewingArchive.year && a.month === currentViewingArchive.month));
    saveData();
    closeMonthModal();
    renderMonthlyReports();
    renderCharts();
}

// === CHARTS ===
function renderCharts() {
    if (AppState.monthlyArchives.length === 0) {
        document.getElementById('chartsSection').style.display = 'none';
        return;
    }
    
    document.getElementById('chartsSection').style.display = 'block';
    
    // Sort archives chronologically
    const sorted = [...AppState.monthlyArchives].sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year;
        return a.month - b.month;
    });
    
    renderEquityCurve(sorted);
    renderWinRateChart(sorted);
    renderWithdrawalChart(sorted);
}

function renderEquityCurve(sorted) {
    const ctx = document.getElementById('equityCurveChart');
    if (!ctx) return;
    
    if (AppState.charts.equityCurve) AppState.charts.equityCurve.destroy();
    
    let cumulative = 0;
    const labels = [];
    const data = [];
    
    sorted.forEach(archive => {
        labels.push(`${archive.monthName.substr(0, 3)} ${archive.year}`);
        cumulative += archive.actualProfit;
        data.push(cumulative);
    });
    
    AppState.charts.equityCurve = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Cumulative Profit',
                data: data,
                borderColor: '#4a9eff',
                backgroundColor: 'rgba(74, 158, 255, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, grid: { color: '#252a3a' }, ticks: { color: '#94a3b8' } },
                x: { grid: { color: '#252a3a' }, ticks: { color: '#94a3b8' } }
            }
        }
    });
}

function renderWinRateChart(sorted) {
    const ctx = document.getElementById('winRateChart');
    if (!ctx) return;
    
    if (AppState.charts.winRate) AppState.charts.winRate.destroy();
    
    const labels = sorted.map(a => `${a.monthName.substr(0, 3)} ${a.year}`);
    const data = sorted.map(a => parseFloat(a.stats.winRate));
    
    AppState.charts.winRate = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Win Rate %',
                data: data,
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, max: 100, grid: { color: '#252a3a' }, ticks: { color: '#94a3b8' } },
                x: { grid: { color: '#252a3a' }, ticks: { color: '#94a3b8' } }
            }
        }
    });
}

function renderWithdrawalChart(sorted) {
    const ctx = document.getElementById('withdrawalChart');
    if (!ctx) return;
    
    if (AppState.charts.withdrawal) AppState.charts.withdrawal.destroy();
    
    const labels = sorted.map(a => `${a.monthName.substr(0, 3)} ${a.year}`);
    const withdrawnData = sorted.map(a => a.withdrawn);
    const compoundedData = sorted.map(a => a.compounded);
    
    AppState.charts.withdrawal = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                { label: 'Withdrawn', data: withdrawnData, backgroundColor: '#f59e0b', borderRadius: 6 },
                { label: 'Compounded', data: compoundedData, backgroundColor: '#4a9eff', borderRadius: 6 }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: true } },
            scales: {
                y: { beginAtZero: true, stacked: true, grid: { color: '#252a3a' }, ticks: { color: '#94a3b8' } },
                x: { stacked: true, grid: { display: false }, ticks: { color: '#94a3b8' } }
            }
        }
    });
}

// === SETTINGS ===
function initSettings() {
    document.getElementById('saveTargetBtn').addEventListener('click', saveTarget);
    document.getElementById('saveWithdrawalBtn').addEventListener('click', saveWithdrawal);
    document.getElementById('saveFeesBtn').addEventListener('click', saveFees);
    document.getElementById('exportDataBtn').addEventListener('click', exportData);
    document.getElementById('importDataBtn').addEventListener('click', () => document.getElementById('importFileInput').click());
    document.getElementById('importFileInput').addEventListener('change', importData);
    document.getElementById('resetBtn').addEventListener('click', resetData);
    
    document.getElementById('targetROIPercent').value = AppState.settings.targetROI;
    document.getElementById('withdrawalPercent').value = AppState.settings.withdrawalPercent;
    document.getElementById('compoundPercent').value = AppState.settings.compoundPercent;
    document.getElementById('takerFee').value = AppState.settings.takerFee;
    document.getElementById('makerFee').value = AppState.settings.makerFee;
    
    document.getElementById('withdrawalPercent').addEventListener('input', (e) => {
        const withdraw = parseFloat(e.target.value) || 67;
        document.getElementById('compoundPercent').value = 100 - withdraw;
    });
}

function saveTarget() {
    AppState.settings.targetROI = parseFloat(document.getElementById('targetROIPercent').value) || 120;
    saveData();
    updateTargetDisplays();
    updateGoalProgress();
    alert('✅ Target saved!');
}

function saveWithdrawal() {
    AppState.settings.withdrawalPercent = parseFloat(document.getElementById('withdrawalPercent').value) || 67;
    AppState.settings.compoundPercent = parseFloat(document.getElementById('compoundPercent').value) || 33;
    saveData();
    alert('✅ Withdrawal strategy saved!');
}

function saveFees() {
    AppState.settings.takerFee = parseFloat(document.getElementById('takerFee').value) || 0.055;
    AppState.settings.makerFee = parseFloat(document.getElementById('makerFee').value) || 0.02;
    saveData();
    alert('✅ Fees saved!');
}

function exportData() {
    const data = { 
        currentMonthTrades: AppState.currentMonthTrades,
        monthlyArchives: AppState.monthlyArchives,
        settings: AppState.settings,
        monthStartBalance: AppState.monthStartBalance,
        currentMonth: AppState.currentMonth,
        exportDate: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
}

function importData(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            AppState.currentMonthTrades = data.currentMonthTrades || [];
            AppState.monthlyArchives = data.monthlyArchives || [];
            AppState.settings = data.settings || AppState.settings;
            AppState.monthStartBalance = data.monthStartBalance || 100;
            
            saveData();
            renderTradeHistory();
            updateStats();
            updateGoalProgress();
            renderMonthlyReports();
            renderCharts();
            
            document.getElementById('walletBalance').value = AppState.monthStartBalance;
            document.getElementById('targetROIPercent').value = AppState.settings.targetROI;
            document.getElementById('withdrawalPercent').value = AppState.settings.withdrawalPercent;
            document.getElementById('compoundPercent').value = AppState.settings.compoundPercent;
            
            alert('✅ Data imported!');
        } catch (error) {
            alert('❌ Invalid file');
        }
    };
    reader.readAsText(file);
}

function resetData() {
    if (!confirm('⚠️ Reset ALL data?')) return;
    if (!confirm('⚠️ This will delete EVERYTHING!')) return;
    localStorage.clear();
    alert('✅ Reset complete!');
    location.reload();
}

// === DATA PERSISTENCE ===
function saveData() {
    localStorage.setItem('cryptoCalculatorCurrentMonthTrades', JSON.stringify(AppState.currentMonthTrades));
    localStorage.setItem('cryptoCalculatorMonthlyArchives', JSON.stringify(AppState.monthlyArchives));
    localStorage.setItem('cryptoCalculatorSettings', JSON.stringify(AppState.settings));
    localStorage.setItem('cryptoCalculatorCurrentMonth', AppState.currentMonth);
    localStorage.setItem('cryptoCalculatorMonthStartBalance', AppState.monthStartBalance);
}

function loadData() {
    const currentMonthTrades = localStorage.getItem('cryptoCalculatorCurrentMonthTrades');
    const monthlyArchives = localStorage.getItem('cryptoCalculatorMonthlyArchives');
    const settings = localStorage.getItem('cryptoCalculatorSettings');
    const monthStartBalance = localStorage.getItem('cryptoCalculatorMonthStartBalance');
    
    if (currentMonthTrades) AppState.currentMonthTrades = JSON.parse(currentMonthTrades);
    if (monthlyArchives) AppState.monthlyArchives = JSON.parse(monthlyArchives);
    if (settings) AppState.settings = JSON.parse(settings);
    if (monthStartBalance) AppState.monthStartBalance = parseFloat(monthStartBalance);
}

console.log('✅ App ready with auto-archive & organized monthly reports!');