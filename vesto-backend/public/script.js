document.addEventListener('DOMContentLoaded', () => {

    // --- CONFIGURATION ---
    const API_CONFIG = {
        BASE_URL: '/api',
    };

    // --- STATE ---
    let appState = {
        token: null,
        user: {
            createdAt: null
        },
        portfolio: {
            cashBalance: 0,
            holdings: [],
        },
        currentStock: null,
        tradeType: 'BUY', // 'BUY' or 'SELL'
        chart: null,
        portfolioPerformanceChart: null
    };

    // --- DOM ELEMENT SELECTORS ---
    const
        // Pages & Views
        authPage = document.getElementById('authPage'),
        mainApp = document.getElementById('mainApp'),
        dashboardPage = document.getElementById('dashboardPage'),
        tradePage = document.getElementById('tradePage'),
        // Auth Forms & Controls
        signupTab = document.getElementById('signupTab'),
        loginTab = document.getElementById('loginTab'),
        signupForm = document.getElementById('signupForm'),
        loginForm = document.getElementById('loginForm'),
        authMessage = document.getElementById('authMessage'),
        rememberMe = document.getElementById('rememberMe'),
        switchToLoginLink = document.getElementById('switchToLoginLink'),
        switchToSignupLink = document.getElementById('switchToSignupLink'),
        // Main App Navigation
        navLinks = {
            dashboard: [document.getElementById('navDashboard'), document.getElementById('mobileNavDashboard')],
            trade: [document.getElementById('navTrade'), document.getElementById('mobileNavTrade')]
        },
        logoutButtons = [document.getElementById('logoutButton'), document.getElementById('mobileLogoutButton')],
        // Mobile Menu
        mobileMenuBtn = document.getElementById('mobileMenuBtn'),
        mobileMenu = document.getElementById('mobileMenu'),
        // Theme Toggles
        themeToggles = [document.getElementById('themeToggleInput'), document.getElementById('mobileThemeToggleInput')],
        // Dashboard Elements
        portfolioValueEl = document.getElementById('portfolioValue'),
        dayGainLossEl = document.getElementById('dayGainLoss'),
        totalGainLossEl = document.getElementById('totalGainLoss'),
        buyingPowerEl = document.getElementById('buyingPower'),
        holdingsTableBodyEl = document.getElementById('holdingsTableBody'),
        portfolioPerformanceCanvas = document.getElementById('portfolioPerformanceChart'),
        // Trade Page Elements
        searchInput = document.getElementById('searchInput'),
        searchButton = document.getElementById('searchButton'),
        stockInfoEl = document.getElementById('stockInfo'),
        tradeWelcomeMessage = document.getElementById('tradeWelcomeMessage'),
        stockDataEl = document.getElementById('stockData'),
        stockNotFoundEl = document.getElementById('stockNotFound'),
        stockNameEl = document.getElementById('stockName'),
        stockPriceEl = document.getElementById('stockPriceDisplay'),
        stockPriceChangeEl = document.getElementById('stockPriceChange'),
        stockHighEl = document.getElementById('stockHigh'),
        stockLowEl = document.getElementById('stockLow'),
        stockVolumeEl = document.getElementById('stockVolume'),
        quickTradeList = document.getElementById('quickTradeList'),
        rangeSelector = document.querySelector('.range-selector'),
        // Trade Terminal
        tradeTerminal = document.getElementById('tradeTerminal'),
        buyToggle = document.getElementById('buyToggle'),
        sellToggle = document.getElementById('sellToggle'),
        quantityPresets = document.getElementById('quantityPresets'),
        tradeBuyingPowerEl = document.getElementById('tradeBuyingPower'),
        tradeTerminalSymbolEl = document.getElementById('tradeTerminalStockSymbol'),
        tradeTerminalSharesEl = document.getElementById('tradeTerminalSharesOwned'),
        quantityInput = document.getElementById('quantityInput'),
        estimateLabel = document.getElementById('estimateLabel'),
        estimatedValueEl = document.getElementById('estimatedValue'),
        tradeButton = document.getElementById('tradeButton'),
        // Notifications
        notificationArea = document.getElementById('notificationArea');


    // --- UI HELPER FUNCTIONS ---

    function showAuthTab(tabName) {
        if (authMessage) authMessage.style.display = 'none';
        const isLogin = tabName === 'login';
        
        loginTab.classList.toggle('tab-active', isLogin);
        signupTab.classList.toggle('tab-active', !isLogin);
        loginForm.style.display = isLogin ? 'block' : 'none';
        signupForm.style.display = isLogin ? 'none' : 'block';
    }
    
    async function showMainPage(pageName) {
        const isTrade = pageName === 'trade';
        
        if (tradePage) tradePage.style.display = isTrade ? 'grid' : 'none';
        if (dashboardPage) dashboardPage.style.display = isTrade ? 'none' : 'grid';

        Object.values(navLinks).flat().forEach(link => link.classList.remove('nav-active'));
        navLinks[pageName].forEach(link => link.classList.add('nav-active'));
        
        if (mobileMenu) mobileMenu.classList.remove('open');
        if (mobileMenuBtn) mobileMenuBtn.setAttribute('aria-expanded', 'false');
        
        if(isTrade) {
            await renderQuickTradePanel();
        } else {
            await updateDashboardUI();
        }
    }

    function displayAuthMessage(message, isSuccess) {
        if (authMessage) {
            authMessage.textContent = message;
            authMessage.className = `message-area ${isSuccess ? 'message-success' : 'message-error'}`;
            authMessage.style.display = 'block';
        }
    }

    function showNotification(message, isSuccess) {
        const notification = document.createElement('div');
        notification.className = `notification ${isSuccess ? 'success' : 'error'}`;
        notification.textContent = message;
        notificationArea.appendChild(notification);

        setTimeout(() => {
            notification.remove();
        }, 5000);
    }

    // --- API & DATA FUNCTIONS ---

    function fetchWithTimeout(url, options, timeout = 15000) {
        return Promise.race([
            fetch(url, options),
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Request timed out')), timeout)
            )
        ]);
    }

    async function fetchPortfolioData() {
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        if (!token) return null;
        try {
            const response = await fetch(`${API_CONFIG.BASE_URL}/portfolio`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) return await response.json();
            if (response.status === 401) handleLogout();
            return null;
        } catch (error) {
            console.error('Failed to fetch portfolio:', error);
            return null;
        }
    }

    async function fetchPortfolioHistory() {
        try {
            const response = await fetch(`${API_CONFIG.BASE_URL}/portfolio-history`, {
                headers: { 'Authorization': `Bearer ${appState.token}` }
            });
            if (response.ok) return await response.json();
            return null;
        } catch (error) {
            console.error('Failed to fetch portfolio history:', error);
            return null;
        }
    }

    async function fetchQuotes(symbols) {
        if (!symbols || symbols.length === 0) return {};
        try {
            const response = await fetchWithTimeout(`${API_CONFIG.BASE_URL}/quotes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${appState.token}` },
                body: JSON.stringify({ symbols }),
            });
            if (response.ok) return await response.json();
            return null;
        } catch (error) {
            console.error('Failed to fetch quotes (or timed out):', error);
            showNotification('Could not update live prices. The server may be busy.', false);
            return null;
        }
    }
    
    async function loadStock(symbol) {
        tradeWelcomeMessage.style.display = 'none';
        stockDataEl.style.display = 'none';
        stockNotFoundEl.style.display = 'none';
        
        tradeButton.disabled = true;
        quantityInput.disabled = true;

        try {
            const response = await fetch(`${API_CONFIG.BASE_URL}/search/${symbol}`, {
                headers: { 'Authorization': `Bearer ${appState.token}` }
            });
            const data = await response.json();

            if (!response.ok) {
                stockNotFoundEl.textContent = data.message;
                stockNotFoundEl.style.display = 'block';
                return;
            }

            const timeSeries = data['Time Series (Daily)'];
            const dates = Object.keys(timeSeries);
            const latestData = timeSeries[dates[0]];
            const previousData = timeSeries[dates[1]];

            appState.currentStock = {
                symbol: data['Meta Data']['2. Symbol'],
                price: parseFloat(latestData['4. close']),
                change: parseFloat(latestData['4. close']) - parseFloat(previousData['4. close']),
                changePercent: ((parseFloat(latestData['4. close']) - parseFloat(previousData['4. close'])) / parseFloat(previousData['4. close'])) * 100,
                high: parseFloat(latestData['2. high']),
                low: parseFloat(latestData['3. low']),
                volume: parseInt(latestData['6. volume']),
                timeSeries: timeSeries
            };
            
            updateStockInfoUI();
            updateTradeTerminalUI();
            
        } catch (error) {
            showNotification('Error fetching stock data.', false);
            console.error(error);
        }
    }
    
    async function handleTrade() {
        const type = appState.tradeType;
        if (!appState.currentStock) {
            showNotification('Please search for a stock first.', false);
            return;
        }

        const shares = parseInt(quantityInput.value, 10);
        if (!shares || shares <= 0) {
            showNotification('Please enter a valid quantity.', false);
            return;
        }

        const { symbol, price } = appState.currentStock;

        try {
            const response = await fetch(`${API_CONFIG.BASE_URL}/trade`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${appState.token}`
                },
                body: JSON.stringify({ symbol, shares, price, type }),
            });

            const data = await response.json();
            if (response.ok) {
                showNotification(data.message, true);
                quantityInput.value = '';
                await initializeUserSession(true);
            } else {
                showNotification(data.message, false);
            }
        } catch (error) {
            showNotification('An error occurred while executing the trade.', false);
        }
    }

    // --- AUTHENTICATION & SESSION ---

    async function handleRegistration(event) { 
        event.preventDefault(); 
        const formData = new FormData(signupForm); 
        const { name, email, password } = Object.fromEntries(formData.entries()); 
        if (!name || !email || !password) { 
            displayAuthMessage('Please fill out all fields.', false); 
            return; 
        } 
        try { 
            const response = await fetch(`${API_CONFIG.BASE_URL}/register`, { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify({ fullName: name, email, password }), 
            }); 
            const data = await response.json(); 
            if (response.ok) { 
                displayAuthMessage(data.message, true); 
                signupForm.reset(); 
                showAuthTab('login'); 
            } else { 
                displayAuthMessage(data.message || 'An error occurred during registration.', false); 
            } 
        } catch (error) { 
            displayAuthMessage('Could not connect to the server.', false); 
        } 
    }

    async function handleLogin(event) { 
        event.preventDefault(); 
        const formData = new FormData(loginForm); 
        const { email, password } = Object.fromEntries(formData.entries()); 
        if (!email || !password) { 
            displayAuthMessage('Please fill out all fields.', false); 
            return; 
        } 
        try { 
            const response = await fetch(`${API_CONFIG.BASE_URL}/login`, { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify({ email, password }), 
            }); 
            const data = await response.json(); 
            if (response.ok) { 
                const storage = rememberMe.checked ? localStorage : sessionStorage; 
                storage.setItem('token', data.token); 
                await initializeUserSession(); 
            } else { 
                displayAuthMessage(data.message || 'An error occurred.', false); 
            } 
        } catch (error) { 
            displayAuthMessage('Could not connect to the server.', false); 
        } 
    }

    function handleLogout() { 
        localStorage.removeItem('token'); 
        sessionStorage.removeItem('token'); 
        appState = { token: null, user: null, portfolio: { cashBalance: 0, holdings: [] } }; 
        mainApp.style.display = 'none'; 
        authPage.style.display = 'flex'; 
        if(loginForm) loginForm.reset(); 
        showAuthTab('login'); 
    }

    async function initializeUserSession(stayOnTradePage = false) {
        appState.token = localStorage.getItem('token') || sessionStorage.getItem('token');
        if (appState.token) {
            const portfolioData = await fetchPortfolioData();
            if (portfolioData) {
                appState.portfolio = portfolioData;
                appState.user.createdAt = portfolioData.createdAt;
                authPage.style.display = 'none';
                mainApp.style.display = 'block';

                if (stayOnTradePage) {
                    await showMainPage('trade');
                } else {
                    await showMainPage('dashboard');
                }
                updateTradeTerminalUI();
            }
        }
    }

    // --- CHART & UI RENDERING ---

    function updateStockInfoUI() {
        const stock = appState.currentStock;
        const formatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
        
        stockNameEl.textContent = `${stock.symbol}`;
        stockPriceEl.textContent = formatter.format(stock.price);
        
        const changeText = `${formatter.format(stock.change)} (${stock.changePercent.toFixed(2)}%)`;
        stockPriceChangeEl.textContent = changeText;
        stockPriceChangeEl.className = `stock-price-change ${stock.change >= 0 ? 'text-gain' : 'text-loss'}`;

        stockHighEl.textContent = formatter.format(stock.high);
        stockLowEl.textContent = formatter.format(stock.low);
        stockVolumeEl.textContent = stock.volume.toLocaleString();
        
        stockDataEl.style.display = 'block';
        renderPriceChart('1M');
        
        quantityInput.disabled = false;
        updateTradeTerminalUI();
    }
    
    function updateTradeTerminalUI() {
        const formatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
        tradeBuyingPowerEl.textContent = formatter.format(appState.portfolio.cashBalance);
        
        const isBuy = appState.tradeType === 'BUY';
        tradeTerminal.classList.toggle('buy-mode', isBuy);
        tradeTerminal.classList.toggle('sell-mode', !isBuy);
        buyToggle.classList.toggle('active', isBuy);
        sellToggle.classList.toggle('active', !isBuy);

        if (appState.currentStock) {
            tradeTerminalSymbolEl.textContent = appState.currentStock.symbol;
            const holding = appState.portfolio.holdings.find(h => h.stockSymbol === appState.currentStock.symbol);
            tradeTerminalSharesEl.textContent = holding ? holding.shares.toLocaleString() : '0';
        } else {
            tradeTerminalSymbolEl.textContent = '--';
            tradeTerminalSharesEl.textContent = '0';
        }
        
        updateEstimatedValue();
    }
    
    function updateEstimatedValue() {
        const quantity = parseInt(quantityInput.value, 10) || 0;
        let value = 0;
        
        if (appState.currentStock) {
            value = quantity * appState.currentStock.price;
        }
        
        const formatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
        estimatedValueEl.textContent = formatter.format(value);

        if (quantity > 0 && appState.currentStock) {
            tradeButton.disabled = false;
            tradeButton.textContent = `${appState.tradeType} ${quantity.toLocaleString()} ${appState.currentStock.symbol}`;
        } else {
            tradeButton.disabled = true;
            tradeButton.textContent = `Enter a quantity`;
        }

        estimateLabel.textContent = appState.tradeType === 'BUY' ? 'Estimated Cost' : 'Estimated Proceeds';
    }

    async function renderQuickTradePanel() {
        const { holdings } = appState.portfolio;
        if (!holdings || holdings.length === 0) {
            quickTradeList.innerHTML = `<p class="text-muted" style="padding: 1rem;">You have no holdings to trade.</p>`;
            return;
        }
        
        quickTradeList.innerHTML = `<p class="text-muted" style="padding: 1rem;">Loading prices...</p>`;
        
        const symbols = holdings.map(h => h.stockSymbol);
        const quotes = await fetchQuotes(symbols);

        if (quotes === null) {
            quickTradeList.innerHTML = `<p class="message-area message-error" style="display: block;">Could not load prices.</p>`;
            return;
        }
        
        const formatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
        
        quickTradeList.innerHTML = holdings.map(holding => {
            const quote = quotes[holding.stockSymbol];
            const price = (quote && typeof quote.price === 'number') ? quote.price : 0;
            const value = holding.shares * price;
            
            return `
                <div class="quick-trade-item" data-symbol="${holding.stockSymbol}">
                    <div class="quick-trade-symbol">${holding.stockSymbol}</div>
                    <div class="quick-trade-shares">${holding.shares.toLocaleString()} Shares</div>
                    <div class="quick-trade-price">${formatter.format(price)}</div>
                    <div class="quick-trade-value">${formatter.format(value)}</div>
                </div>
            `;
        }).join('');
        
        document.querySelectorAll('.quick-trade-item').forEach(item => {
            item.addEventListener('click', () => {
                const symbol = item.dataset.symbol;
                searchInput.value = symbol;
                loadStock(symbol);
            });
        });
    }

    async function updateDashboardUI() { 
        if (!appState.portfolio) return; 
        const { cashBalance, holdings } = appState.portfolio; 
        const formatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }); 
        buyingPowerEl.textContent = formatter.format(cashBalance || 0); 
        
        const historyData = await fetchPortfolioHistory();
        renderPortfolioPerformanceChart(historyData); 

        if (holdings && holdings.length > 0) { 
            holdingsTableBodyEl.innerHTML = holdings.map(h => `
                <tr data-symbol="${h.stockSymbol}">
                    <td class="align-left">${h.stockSymbol}</td>
                    <td class="align-right">${h.shares.toLocaleString()}</td>
                    <td class="align-right"><span class="loading-dots">...</span></td>
                    <td class="align-right"><span class="loading-dots">...</span></td>
                    <td class="align-right"><span class="loading-dots">...</span></td>
                    <td class="align-right"><span class="loading-dots">...</span></td>
                    <td class="align-right"><span class="loading-dots">...</span></td>
                </tr>`).join(''); 
            portfolioValueEl.textContent = 'Calculating...'; 

            const symbols = holdings.map(h => h.stockSymbol); 
            const quotes = await fetchQuotes(symbols); 

            if (quotes === null) { 
                holdingsTableBodyEl.innerHTML = `<td colspan="7" class="text-muted" style="text-align: center; padding: 2rem;">Error loading market data.</td>`;
                portfolioValueEl.textContent = 'Data Unavailable'; 
                return; 
            } 
            let totalHoldingsValue = 0; 
            let totalDayChange = 0;

            holdingsTableBodyEl.innerHTML = '';
            holdings.forEach(h => {
                const quote = quotes[h.stockSymbol];
                const row = document.createElement('tr');
                row.dataset.symbol = h.stockSymbol;
                
                const avgCostText = (h.avgCost && typeof h.avgCost === 'number') ? formatter.format(h.avgCost) : '<span class="text-muted">N/A</span>';
                let priceText = '<span class="text-muted">N/A</span>';
                let valueText = '<span class="text-muted">N/A</span>';
                let dayChangeText = '<span class="text-muted">N/A</span>';
                let gainLossText = '<span class="text-muted">N/A</span>';

                if (quote && typeof quote.price === 'number') { 
                    const totalValue = h.shares * quote.price; 
                    totalHoldingsValue += totalValue; 
                    priceText = formatter.format(quote.price); 
                    valueText = formatter.format(totalValue); 
                    
                    if (typeof quote.change === 'number') {
                        const dayChange = h.shares * quote.change;
                        totalDayChange += dayChange;
                        const dayChangeClass = dayChange >= 0 ? 'text-gain' : 'text-loss';
                        dayChangeText = `<span class="${dayChangeClass}">${formatter.format(dayChange)}</span>`;
                    }
                    
                    if (h.avgCost && typeof h.avgCost === 'number') {
                        const totalGainLoss = (quote.price - h.avgCost) * h.shares;
                        const gainLossClass = totalGainLoss >= 0 ? 'text-gain' : 'text-loss';
                        gainLossText = `<span class="${gainLossClass}">${formatter.format(totalGainLoss)}</span>`;
                    }
                } 
                
                row.innerHTML = `
                    <td class="align-left">${h.stockSymbol}</td>
                    <td class="align-right">${h.shares.toLocaleString()}</td>
                    <td class="align-right">${avgCostText}</td>
                    <td class="align-right">${priceText}</td>
                    <td class="align-right">${valueText}</td>
                    <td class="align-right">${dayChangeText}</td>
                    <td class="align-right">${gainLossText}</td>
                `;
                holdingsTableBodyEl.appendChild(row);
            }); 
            
            holdingsTableBodyEl.querySelectorAll('tr').forEach(row => {
                row.addEventListener('click', () => {
                    const symbol = row.dataset.symbol;
                    showMainPage('trade').then(() => {
                        searchInput.value = symbol;
                        loadStock(symbol);
                    });
                });
            });

            const totalPortfolioValue = (cashBalance || 0) + totalHoldingsValue; 
            portfolioValueEl.textContent = formatter.format(totalPortfolioValue); 
            dayGainLossEl.textContent = formatter.format(totalDayChange);
            dayGainLossEl.classList.toggle('text-gain', totalDayChange >= 0);
            dayGainLossEl.classList.toggle('text-loss', totalDayChange < 0);
        } else { 
            holdingsTableBodyEl.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2rem;">No holdings to display.</td></tr>'; 
            portfolioValueEl.textContent = formatter.format(cashBalance || 0); 
            dayGainLossEl.textContent = formatter.format(0); 
            totalGainLossEl.textContent = formatter.format(0); 
        } 
    }

    function renderPortfolioPerformanceChart(historyData) { 
        if (!historyData || historyData.length < 1) {
             if (appState.portfolioPerformanceChart) appState.portfolioPerformanceChart.destroy();
            return;
        } 
        if (appState.portfolioPerformanceChart) { 
            appState.portfolioPerformanceChart.destroy(); 
        } 
        const dataPoints = historyData.map(day => ({ x: new Date(day.date), y: day.value })); 
        const latestValue = dataPoints[dataPoints.length - 1].y; 
        
        const totalGainLoss = latestValue - 100000; 
        const formatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }); 
        
        totalGainLossEl.textContent = formatter.format(totalGainLoss); 
        totalGainLossEl.classList.toggle('text-gain', totalGainLoss >= 0); 
        totalGainLossEl.classList.toggle('text-loss', totalGainLoss < 0); 
        
        const computedStyle = getComputedStyle(document.body); 
        const gainColor = computedStyle.getPropertyValue('--gain-color').trim(); 
        const lossColor = computedStyle.getPropertyValue('--loss-color').trim(); 
        const chartColor = latestValue >= 100000 ? gainColor : lossColor; 
        const ctx = portfolioPerformanceCanvas.getContext('2d'); 
        appState.portfolioPerformanceChart = new Chart(ctx, { 
            type: 'line', 
            data: { 
                datasets: [{ 
                    label: 'Portfolio Value', 
                    data: dataPoints, 
                    borderColor: chartColor, 
                    borderWidth: 2, 
                    pointRadius: 0, 
                    tension: 0.1, 
                    fill: true, 
                    backgroundColor: (context) => { 
                        const chart = context.chart; 
                        const { ctx, chartArea } = chart; 
                        if (!chartArea) { 
                            return null; 
                        } 
                        const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top); 
                        gradient.addColorStop(0, 'rgba(0, 0, 0, 0)'); 
                        gradient.addColorStop(1, `${chartColor}33`); 
                        return gradient; 
                    } 
                }] 
            }, 
            options: { 
                responsive: true, 
                maintainAspectRatio: false, 
                scales: { 
                    x: { type: 'time', time: { unit: 'day' }, grid: { display: false } }, 
                    y: { grid: { color: 'var(--border-color)' } } 
                }, 
                plugins: { legend: { display: false } } 
            } 
        }); 
    }

    function renderPriceChart(range) {
        if (!appState.currentStock) return;
        if (appState.chart) appState.chart.destroy();
        
        const timeSeries = appState.currentStock.timeSeries;
        let allDates = Object.keys(timeSeries);

        const endDate = new Date(allDates[0]);
        let startDate;

        switch (range) {
            case '1M':
                startDate = new Date(endDate);
                startDate.setMonth(startDate.getMonth() - 1);
                break;
            case '6M':
                startDate = new Date(endDate);
                startDate.setMonth(startDate.getMonth() - 6);
                break;
            case '1Y':
                startDate = new Date(endDate);
                startDate.setFullYear(startDate.getFullYear() - 1);
                break;
            case 'ALL':
            default:
                startDate = new Date(allDates[allDates.length - 1]);
                break;
        }

        const filteredDates = allDates.filter(date => new Date(date) >= startDate);
        const dataPoints = filteredDates.map(date => ({
            x: new Date(date),
            y: parseFloat(timeSeries[date]['4. close'])
        })).reverse();

        const ctx = document.getElementById('priceChart').getContext('2d');
        appState.chart = new Chart(ctx, {
            type: 'line',
            data: {
                datasets: [{
                    label: appState.currentStock.symbol,
                    data: dataPoints,
                    borderColor: appState.currentStock.change >= 0 ? 'var(--gain-color)' : 'var(--loss-color)',
                    borderWidth: 2,
                    pointRadius: 0,
                    tension: 0.1
                }]
            },
            options: {
                scales: {
                    x: { type: 'time', time: { unit: 'day' }, grid: { display: false } },
                    y: { grid: { color: 'var(--border-color)' } }
                },
                plugins: { legend: { display: false } }
            }
        });
        
        document.querySelectorAll('.range-btn').forEach(btn => {
            btn.classList.toggle('range-btn-active', btn.dataset.range === range);
        });
    }

    // --- EVENT LISTENERS & INITIALIZATION ---

    function setupEventListeners() {
        if (signupTab) signupTab.addEventListener('click', () => showAuthTab('signup'));
        if (loginTab) loginTab.addEventListener('click', () => showAuthTab('login'));
        if (signupForm) signupForm.addEventListener('submit', handleRegistration);
        if (loginForm) loginForm.addEventListener('submit', handleLogin);
        if (switchToLoginLink) switchToLoginLink.addEventListener('click', (e) => { e.preventDefault(); showAuthTab('login'); });
        if (switchToSignupLink) switchToSignupLink.addEventListener('click', (e) => { e.preventDefault(); showAuthTab('signup'); });

        if (navLinks.dashboard) navLinks.dashboard.forEach(el => el.addEventListener('click', () => showMainPage('dashboard')));
        if (navLinks.trade) navLinks.trade.forEach(el => el.addEventListener('click', () => showMainPage('trade')));
        if (logoutButtons) logoutButtons.forEach(el => el.addEventListener('click', handleLogout));
        
        if (mobileMenuBtn) {
            mobileMenuBtn.addEventListener('click', () => {
                const isExpanded = mobileMenuBtn.getAttribute('aria-expanded') === 'true';
                mobileMenu.classList.toggle('open');
                mobileMenuBtn.setAttribute('aria-expanded', !isExpanded);
            });
        }

        if (themeToggles) {
            themeToggles.forEach(toggle => {
                toggle.addEventListener('change', (event) => {
                    const isChecked = event.target.checked;
                    document.body.classList.toggle('dark-mode', isChecked);
                    themeToggles[0].checked = isChecked;
                    themeToggles[1].checked = isChecked;
                    localStorage.setItem('vesto-theme', isChecked ? 'dark' : 'light');
                });
            });
        }
        
        searchButton.addEventListener('click', () => loadStock(searchInput.value));
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') loadStock(searchInput.value);
        });

        buyToggle.addEventListener('click', () => {
            appState.tradeType = 'BUY';
            updateTradeTerminalUI();
        });
        sellToggle.addEventListener('click', () => {
            appState.tradeType = 'SELL';
            updateTradeTerminalUI();
        });

        quantityInput.addEventListener('input', updateEstimatedValue);
        tradeButton.addEventListener('click', handleTrade);
        
        quantityPresets.addEventListener('click', (e) => {
            if (e.target.classList.contains('preset-btn') && appState.currentStock) {
                const percentage = parseFloat(e.target.dataset.value);
                let quantity = 0;
                
                if (appState.tradeType === 'BUY') {
                    const maxAffordable = Math.floor(appState.portfolio.cashBalance / appState.currentStock.price);
                    quantity = Math.floor(maxAffordable * percentage);
                } else { // SELL
                    const holding = appState.portfolio.holdings.find(h => h.stockSymbol === appState.currentStock.symbol);
                    const maxSellable = holding ? holding.shares : 0;
                    quantity = Math.floor(maxSellable * percentage);
                }
                
                quantityInput.value = quantity > 0 ? quantity : '';
                updateEstimatedValue();
            }
        });
        
        rangeSelector.addEventListener('click', (e) => {
            if (e.target.classList.contains('range-btn')) {
                const range = e.target.dataset.range;
                renderPriceChart(range);
            }
        });
    }

    function applyInitialTheme() {
        const savedTheme = localStorage.getItem('vesto-theme');
        if (savedTheme === 'dark') {
            document.body.classList.add('dark-mode');
            themeToggles.forEach(toggle => toggle.checked = true);
        } else {
            document.body.classList.remove('dark-mode');
            themeToggles.forEach(toggle => toggle.checked = false);
        }
    }

    applyInitialTheme();
    setupEventListeners();
    initializeUserSession();
});

