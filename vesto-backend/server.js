// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fetch = require('node-fetch');
const morgan = require('morgan');
const path = require('path');
const { ObjectId } = require('mongodb');
const { connectToDb, getDb } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// --- Middleware ---
app.use(cors());
app.use(express.json());
app.use(morgan(':date[iso] :method :url :status :response-time ms'));
app.use(express.static(path.join(__dirname, 'public')));


// --- Database Connection ---
let db;
connectToDb((err) => {
    if (!err) {
        db = getDb();
        app.listen(PORT, () => {
            console.log(`[INFO] Server listening on port ${PORT}`);
        });
    } else {
        console.error('[ERROR] Failed to start server due to database connection error.');
        process.exit(1);
    }
});

app.use((req, res, next) => {
    if (req.path.startsWith('/api')) {
        if (db) {
            return next();
        }
        return res.status(503).json({ message: 'Service is temporarily unavailable. Database is not ready.' });
    }
    return next();
});


// --- Helper Functions ---

async function getHistoricalData(symbol) {
    console.log(`[API] Fetching historical data for ${symbol} from FMP...`);
    const url = `https://financialmodelingprep.com/api/v3/historical-price-full/${symbol}?apikey=${process.env.FINANCIAL_MODELING_PREP_KEY}`;
    const response = await fetch(url);
    const data = await response.json();

    if (!data || !data.historical || data.historical.length === 0) {
        throw new Error(`No historical data found for ${symbol}`);
    }
    
    return data.historical;
}

function adaptFmpToFrontendFormat(symbol, fmpHistoricalData) {
    const timeSeries = {};
    fmpHistoricalData.forEach(day => {
        timeSeries[day.date] = {
            '1. open': day.open.toString(),
            '2. high': day.high.toString(),
            '3. low': day.low.toString(),
            '4. close': day.close.toString(),
            '5. adjusted close': day.adjClose.toString(), 
            '6. volume': day.volume.toString(),
        };
    });
    
    const lastRefreshed = fmpHistoricalData.length > 0 ? fmpHistoricalData[0].date : new Date().toISOString().split('T')[0];

    return {
        'Meta Data': {
            '1. Information': 'Daily Prices (open, high, low, close) and Volumes',
            '2. Symbol': symbol.toUpperCase(),
            '3. Last Refreshed': lastRefreshed,
            '4. Output Size': 'Full size',
            '5. Time Zone': 'US/Eastern'
        },
        'Time Series (Daily)': timeSeries
    };
}

async function handleBuy(req, res, user, { symbol, shareCount, price }) {
    const totalCost = shareCount * price;
    if (user.cashBalance < totalCost) {
        return res.status(400).json({ message: 'Not enough cash to make this purchase.' });
    }

    const newTransaction = createTransaction(symbol, shareCount, price, 'BUY');
    const newCashBalance = user.cashBalance - totalCost;
    const users = db.collection('users');
    const existingHolding = user.holdings.find(h => h.stockSymbol === symbol);

    if (existingHolding) {
        const currentTotalValue = existingHolding.avgCost * existingHolding.shares;
        const newTotalValue = currentTotalValue + totalCost;
        const newTotalShares = existingHolding.shares + shareCount;
        const newAvgCost = newTotalValue / newTotalShares;

        await users.updateOne(
            { _id: user._id, "holdings.stockSymbol": symbol },
            { 
                $inc: { "holdings.$.shares": shareCount },
                $set: { "holdings.$.avgCost": newAvgCost, cashBalance: newCashBalance },
                $push: { transactions: newTransaction }
            }
        );
    } else {
        const newHolding = { 
            stockSymbol: symbol, 
            shares: shareCount,
            avgCost: price
        };
        await users.updateOne(
            { _id: user._id },
            { 
                $set: { cashBalance: newCashBalance },
                $push: { holdings: newHolding, transactions: newTransaction }
            }
        );
    }
    res.status(200).json({ message: 'Trade executed successfully!' });
}

async function handleSell(req, res, user, { symbol, shareCount, price }) {
    const existingHolding = user.holdings.find(h => h.stockSymbol === symbol);
    if (!existingHolding || existingHolding.shares < shareCount) {
        return res.status(400).json({ message: 'Not enough shares to sell.' });
    }
    
    const totalCredit = shareCount * price;
    const newTransaction = createTransaction(symbol, shareCount, price, 'SELL');
    const newCashBalance = user.cashBalance + totalCredit;
    const users = db.collection('users');

    if (existingHolding.shares === shareCount) {
        await users.updateOne(
            { _id: user._id },
            { 
                $set: { cashBalance: newCashBalance },
                $pull: { holdings: { stockSymbol: symbol } },
                $push: { transactions: newTransaction }
            }
        );
    } else {
        await users.updateOne(
            { _id: user._id, "holdings.stockSymbol": symbol },
            { 
                $inc: { "holdings.$.shares": -shareCount },
                $set: { cashBalance: newCashBalance },
                $push: { transactions: newTransaction }
            }
        );
    }
    res.status(200).json({ message: 'Trade executed successfully!' });
}

function createTransaction(symbol, shares, price, type) {
    return {
        transactionId: new ObjectId(),
        stockSymbol: symbol,
        shares: shares,
        pricePerShare: price,
        transactionType: type,
        timestamp: new Date()
    };
}


// --- Authentication Middleware (JWT Protection) ---
const protect = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
            const token = authHeader.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            if (!ObjectId.isValid(decoded.userId)) {
                return res.status(401).json({ message: 'Not authorized, invalid token' });
            }
            req.user = { userId: decoded.userId };
            next();
        } catch (error) {
            res.status(401).json({ message: 'Not authorized, token failed' });
        }
    } else {
        res.status(401).json({ message: 'Not authorized, no token' });
    }
};


// --- API Endpoints ---
app.post('/api/register', async (req, res) => {
    const { fullName, email, password } = req.body;
    if (!fullName || !email || !password) {
        return res.status(400).json({ message: 'Please provide all required fields.' });
    }
    try {
        const usersCollection = db.collection('users');
        const existingUser = await usersCollection.findOne({ email });
        if (existingUser) {
            return res.status(409).json({ message: 'An account with this email already exists.' });
        }
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        const newUser = {
            fullName,
            email,
            password: hashedPassword,
            cashBalance: 100000.00,
            createdAt: new Date(),
            holdings: [],
            transactions: []
        };
        const result = await usersCollection.insertOne(newUser);
        res.status(201).json({ message: 'User registered successfully!', userId: result.insertedId });
    } catch (error) {
        console.error('Registration Error:', error);
        res.status(500).json({ message: 'Server error during registration.' });
    }
});

app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ message: 'Please provide both email and password.' });
    }
    try {
        const user = await db.collection('users').findOne({ email });
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ message: 'Invalid credentials.' });
        }
        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
        res.status(200).json({
            message: 'Login successful!',
            token,
            user: { id: user._id, fullName: user.fullName, createdAt: user.createdAt }
        });
    } catch (error) {
        console.error('Login Error:', error);
        res.status(500).json({ message: 'Server error during login.' });
    }
});

app.get('/api/portfolio', protect, async (req, res) => {
    try {
        const user = await db.collection('users').findOne(
            { _id: new ObjectId(req.user.userId) },
            { projection: { cashBalance: 1, holdings: 1, createdAt: 1 } }
        );
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }
        res.status(200).json({ cashBalance: user.cashBalance, holdings: user.holdings, createdAt: user.createdAt });
    } catch (error) {
        console.error('Portfolio Fetch Error:', error);
        res.status(500).json({ message: 'Server error fetching portfolio data.' });
    }
});

app.get('/api/search/:symbol', protect, async (req, res) => {
    const { symbol } = req.params;
    try {
        const historicalData = await getHistoricalData(symbol);
        const adaptedData = adaptFmpToFrontendFormat(symbol, historicalData);
        res.status(200).json(adaptedData);
    } catch (error) {
        console.error(`Search failed for ${symbol}:`, error.message);
        res.status(404).json({ message: `Stock symbol '${symbol}' not found.` });
    }
});

// ---> NEW TRENDING ROUTE <---
app.get('/api/trending', protect, async (req, res) => {
    try {
        // Fetch "Most Active" stocks from FMP
        const url = `https://financialmodelingprep.com/api/v3/stock_market/actives?apikey=${process.env.FINANCIAL_MODELING_PREP_KEY}`;
        const response = await fetch(url);
        const data = await response.json();

        // Return top 5 trending stocks
        const trending = data.slice(0, 5).map(stock => ({
            symbol: stock.symbol,
            name: stock.name,
            price: stock.price,
            change: stock.change
        }));

        res.status(200).json(trending);
    } catch (error) {
        console.error('Error fetching trending stocks:', error);
        res.status(500).json({ message: 'Failed to load trending stocks' });
    }
});


app.post('/api/quotes', protect, async (req, res) => {
    const { symbols } = req.body;
    if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
        return res.status(400).json({ message: 'A list of symbols is required.' });
    }
    try {
        const url = `https://financialmodelingprep.com/api/v3/quote/${symbols.join(',')}?apikey=${process.env.FINANCIAL_MODELING_PREP_KEY}`;
        const response = await fetch(url);
        const data = await response.json();
        
        const quotesArray = Array.isArray(data) ? data : [data];
        
        const prices = quotesArray.reduce((acc, quote) => {
            if (quote.symbol) {
                acc[quote.symbol] = {
                    price: quote.price,
                    change: quote.change
                };
            }
            return acc;
        }, {});
        res.status(200).json(prices);
    } catch (error) {
        console.error('Failed to fetch quotes:', error);
        res.status(500).json({ message: 'Error fetching live prices.' });
    }
});

app.get('/api/portfolio-history', protect, async (req, res) => {
    try {
        const user = await db.collection('users').findOne({ _id: new ObjectId(req.user.userId) });
        if (!user || !user.transactions || user.transactions.length === 0) {
            return res.status(200).json([]);
        }

        const history = {};
        const startDate = new Date(user.createdAt);
        const endDate = new Date();

        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
            const dateStr = d.toISOString().split('T')[0];
            history[dateStr] = { cash: 100000, holdings: {} };
        }

        let currentCash = 100000;
        const currentHoldings = {};
        const sortedTransactions = [...user.transactions].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

        for (const trx of sortedTransactions) {
            const trxDate = new Date(trx.timestamp);
            if (trx.transactionType === 'BUY') {
                currentCash -= trx.shares * trx.pricePerShare;
                currentHoldings[trx.stockSymbol] = (currentHoldings[trx.stockSymbol] || 0) + trx.shares;
            } else { // SELL
                currentCash += trx.shares * trx.pricePerShare;
                currentHoldings[trx.stockSymbol] -= trx.shares;
            }

            for (let d = new Date(trxDate); d <= endDate; d.setDate(d.getDate() + 1)) {
                const futureDateStr = d.toISOString().split('T')[0];
                if (history[futureDateStr]) {
                    history[futureDateStr].cash = currentCash;
                    history[futureDateStr].holdings = { ...currentHoldings };
                }
            }
        }
        
        const allSymbolsEverHeld = new Set();
        Object.values(history).forEach(day => {
            Object.keys(day.holdings).forEach(symbol => {
                if (day.holdings[symbol] > 0) {
                    allSymbolsEverHeld.add(symbol);
                }
            });
        });

        const historicalPrices = {};
        for (const symbol of allSymbolsEverHeld) {
            try {
                const prices = await getHistoricalData(symbol);
                historicalPrices[symbol] = prices.reduce((acc, day) => {
                    acc[day.date] = day.close;
                    return acc;
                }, {});
            } catch (e) {
                console.warn(`Could not fetch historical data for ${symbol} in portfolio history.`);
            }
        }

        const portfolioHistory = Object.entries(history).map(([date, dailyState]) => {
            let holdingsValue = 0;
            for (const [symbol, shares] of Object.entries(dailyState.holdings)) {
                if (shares <= 0) continue;

                if (historicalPrices[symbol] && historicalPrices[symbol][date]) {
                    holdingsValue += shares * historicalPrices[symbol][date];
                } else {
                    let lastKnownPrice = 0;
                    for (let i = 1; i < 7; i++) {
                        const prevDate = new Date(date);
                        prevDate.setDate(prevDate.getDate() - i);
                        const prevDateStr = prevDate.toISOString().split('T')[0];
                        if (historicalPrices[symbol] && historicalPrices[symbol][prevDateStr]) {
                            lastKnownPrice = historicalPrices[symbol][prevDateStr];
                            break;
                        }
                    }
                     holdingsValue += shares * lastKnownPrice;
                }
            }
            return { date, value: dailyState.cash + holdingsValue };
        }).filter(day => day.value > 0);

        res.status(200).json(portfolioHistory);
    } catch (error) {
        console.error('Error generating portfolio history:', error);
        res.status(500).json({ message: 'Could not generate portfolio history.' });
    }
});

app.post('/api/trade', protect, async (req, res) => {
    const { symbol, shares, price, type } = req.body;
    const shareCount = parseInt(shares, 10);

    if (!symbol || !shareCount || !price || !type || shareCount <= 0 || price <= 0) {
        return res.status(400).json({ message: 'Invalid trade request. Please check all fields.' });
    }

    try {
        const users = db.collection('users');
        const user = await users.findOne({ _id: new ObjectId(req.user.userId) });
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        if (type.toUpperCase() === 'BUY') {
            await handleBuy(req, res, user, { symbol, shareCount, price });
        } else if (type.toUpperCase() === 'SELL') {
            await handleSell(req, res, user, { symbol, shareCount, price });
        } else {
            return res.status(400).json({ message: 'Invalid trade type specified.' });
        }
    } catch (error) {
        console.error('Trade Error:', error);
        res.status(500).json({ message: 'Server error during trade execution.' });
    }
});

// --- Catch-all Route for Frontend ---

// 1. Route for the App Dashboard (Login/Trading)
app.get('/app', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'main.html'));
});

// 2. Catch-all: Send everything else to the Landing Page (index.html)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});