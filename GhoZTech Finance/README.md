# Finance Planner Desktop

Finance Planner Desktop is a local-first budgeting application for tracking wages, expenses, savings goals, and monthly plans. It runs without a database or cloud service. When started with `launch.bat`, data is automatically saved to `finance-data.json` in this folder. If opened directly as `index.html`, the app falls back to browser local storage.

## Start the app

- Double-click `launch.bat` for the desktop-style local server.
- If Node.js is not installed, the launcher opens `index.html` directly.
- You can also open `index.html` manually in a browser.

## Main features

- Add recurring wages and income with weekly, biweekly, semimonthly, monthly, quarterly, yearly, or one-time frequency.
- Add expenses by category, priority, due day, and notes.
- Create savings goals for the end of the month, end of the year, or a custom date.
- Generate a monthly saving plan with category caps and recommended cuts.
- Use the What-if Lab to test spending cuts, side income, and wage growth.
- Print a monthly report or export/import your saved finance data.
- Automatically save to `finance-data.json` when launched through the local server.
- Export spreadsheet-friendly CSV tables.

## Files

- `index.html` is the application shell.
- `styles.css` controls the interface.
- `app.js` contains the finance calculations and app behavior.
- `server.js` runs a small local server.
- `launch.bat` starts the desktop-style version on Windows.
- `finance-data.json` stores the saved finance data when the app is launched through `launch.bat`.
- `Finance Planner User Manual.html` and `Finance Planner User Manual.md` are the guide documents.
