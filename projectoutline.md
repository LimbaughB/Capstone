Project Outline: "Vesto" - A Stock Market Simulator
1. Project Overview & Vision (Module 1 & 2)
Application Name: Vesto

Core Idea: A web application that allows users to practice stock trading in a realistic, simulated environment using real-time market data but fake money.

Value Proposition: Provides a risk-free way for beginners to learn the fundamentals of stock trading, test investment strategies, and build confidence before using real money.

Target Audience: Students, aspiring investors, and anyone curious about the stock market.

2. Core Features & Functional Requirements (Module 4)
These are the essential functions the app must perform.

User Authentication:

Users can create an account (email/password).

Upon registration, each user is automatically credited with a starting "cash" balance (e.g., $100,000 in virtual currency).

Users can log in and log out securely.

Portfolio Management:

A main dashboard displays the user's total portfolio value (cash + value of all stock holdings).

The dashboard shows a list of stocks the user currently owns, including the number of shares, the current market price per share, and the total value of that holding.

A clear display of the user's remaining "cash" balance.

Stock Trading Simulation:

Users can search for any real-world stock using its ticker symbol (e.g., AAPL, GOOL, TSLA).

The app will fetch and display the current market price for the selected stock.

Users can "buy" a specific number of shares, which will deduct the total cost from their cash balance and add the stock to their portfolio.

Users can "sell" shares they own, which will add the proceeds to their cash balance and remove the stock from their portfolio.

Transaction History:

A separate page or section that lists a chronological history of all buy and sell transactions a user has made.

3. Technology Stack
Front-End: HTML5, CSS3, JavaScript

Back-End: Node.js with the Express.js framework

Database: MySQL

Financial Data API: Alpha Vantage (Provides a free API key for real-time and historical stock market data, which is perfect for this student project).

Version Control: Git & GitHub

4. Front-End Design & UI Prototype (Module 5)
Page 1: Login/Registration Page

A clean, secure form for signing in or creating an account.

Page 2: Main Dashboard (Portfolio View)

Header: App name, logged-in user, and a logout button.

Key Metrics: Large, clear display of Total Portfolio Value and a separate display for available Cash.

Holdings Table: A table listing each stock owned, with columns for: Ticker, Company Name, Shares, Current Price, and Total Value.

Page 3: Stock Trading Page

A prominent search bar to look up stock tickers.

A "Trade Terminal" section that displays the current price of the searched stock.

Input fields for the user to enter the number of shares they want to buy or sell.

Clearly labeled "Buy" and "Sell" buttons.

5. Back-End & Database Design (Module 3 & 6)
Database Schema (MySQL)
users table:

id (Primary Key, INT, Auto-Increment)

email (VARCHAR, UNIQUE)

password_hash (VARCHAR)

cash_balance (DECIMAL, default: 100000.00)

created_at (TIMESTAMP)

holdings table: (Represents the stocks a user currently owns)

id (Primary Key, INT, Auto-Increment)

user_id (Foreign Key to users.id)

stock_symbol (VARCHAR)

shares (INT)

transactions table: (A historical log of all trades)

id (Primary Key, INT, Auto-Increment)

user_id (Foreign Key to users.id)

stock_symbol (VARCHAR)

transaction_type (ENUM('BUY', 'SELL'))

shares (INT)

price_per_share (DECIMAL)

timestamp (TIMESTAMP)

6. Project Timeline & Syllabus Alignment
Weeks 1-3 (Due 9/8): Finalize this project plan. Sketch out wireframes for the UI pages. Sign up for a free API key from Alpha Vantage.

Weeks 4-5 (Due 9/22): Design the database schema above. Use MySQL to create the database and the three tables (users, holdings, transactions).

Weeks 6-7 (Due 10/6): Write out the formal Functional Requirements (using Section 2 of this outline) and plan the app's logic flow.

Weeks 8-9 (Due 10/20): Front-End Prototype. Build the static HTML and CSS for the Login, Dashboard, and Trading pages. This will be a non-functional visual prototype.

Weeks 10-11 (Due 11/3): Back-End Setup. Create the Node.js/Express server. Implement the logic for user registration, login, and connecting to your MySQL database.

Weeks 12-14 (Due 11/24): Integration Phase. This is the biggest part.

Connect the front-end to the back-end.

Write the JavaScript to fetch data from the Alpha Vantage API.

Implement the core "buy" and "sell" logic on the server.

Make the dashboard display real data from the user's portfolio.

Weeks 15-16 (Due 12/5): Finalize the application, deploy it to a web host (as required by the syllabus), and prepare your final presentation.