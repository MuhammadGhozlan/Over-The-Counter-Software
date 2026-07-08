# Finance Planner Desktop User Manual

## Purpose

Finance Planner Desktop helps you record wages, expenses, and savings goals, then turns that information into a monthly plan. The app estimates how much you can save, whether your goals are realistic, which categories need limits, and which expenses are best to reduce first.

## Opening the application

1. Open the `Finance Application` folder.
2. Double-click `launch.bat`.
3. If Node.js is available, the app opens at `http://localhost:5177` or the next available local port.
4. If Node.js is not available, the launcher opens `index.html` directly in your default browser.

The application works locally. When opened with `launch.bat`, your data is automatically saved to `finance-data.json` in the `Finance Application` folder. Your data stays on this computer unless you export and share the backup file.

## Dashboard

The dashboard summarizes your monthly money picture.

- Monthly income shows wages and other money coming in after all frequencies are converted to monthly values.
- Monthly expenses shows bills and spending converted to monthly values.
- Goal savings needed shows the amount required each month to reach your savings goals by their deadlines.
- Daily safe spend estimates how much can be spent per day after expenses and goal savings.

The Autopilot panel tells you whether you are on track, close to the limit, or short of your savings target.

## Adding wages and income

1. Select `Money In`.
2. Enter the income name, amount, frequency, and type.
3. Select `Save income`.

Use this section for salary, hourly wages, freelance work, side income, investment income, or recurring support payments.

## Adding expenses

1. Select `Expenses`.
2. Enter the expense name, amount, frequency, category, due day, priority, and notes.
3. Select `Save expense`.

Priorities affect the generated plan:

- Essential means the expense should be protected first.
- Flexible means the expense may be reduced but probably cannot be removed.
- Optional means the expense is a strong candidate for cutting when a savings gap exists.

## Adding savings goals

1. Select `Savings Goals`.
2. Enter the goal name, target amount, amount already saved, deadline, and goal type.
3. Select `Save goal`.

The app calculates the monthly amount needed for each goal. For example, if a goal needs $1,200 and has 6 months left, the app plans for $200 per month.

## Monthly Plan

The Monthly Plan uses your income, expenses, and goals to create a spending strategy.

- Plan summary shows whether your goals fit inside the current budget.
- Category caps show recommended monthly and weekly limits by spending category.
- Cut list identifies flexible and optional expenses with the highest impact.

If the plan says there is a savings gap, reduce optional expenses, lower flexible category caps, or add income until the gap is closed.

## What-if Lab

The What-if Lab is the app's scenario feature. Use sliders to test:

- Lower food spending.
- Lower subscription spending.
- Lower shopping spending.
- Lower entertainment spending.
- Added side income.
- A wage increase.

The app shows the projected monthly improvement, new savings capacity, estimated goal speed-up, and annual upside.

## Reports

The Reports section creates a printable monthly brief with cash position, largest categories, savings goals, and recommended actions.

Use `Print report` to print or save as PDF from your browser's print dialog.

## Backup and restore

When the app is opened through `launch.bat`, it saves automatically to `finance-data.json` in the same folder as the app. This is the main save file. JSON is used because it preserves every setting, income item, expense item, savings goal, and note.

Use `Export finance data` to download an extra JSON backup. Use `Export CSV tables` to create a spreadsheet-friendly CSV copy of income, expenses, and goals. Use `Import finance data` to restore a JSON backup later.

Keep backups in a secure place because they contain private financial information.

## Settings

Settings let you change:

- Display name.
- Currency.
- Starting savings.
- Planning month start day.
- Planning style.

Planning styles affect how category reductions are recommended:

- Balanced uses steady reductions.
- Aggressive suggests stronger cuts to reach goals faster.
- Comfort protects lifestyle categories more and makes softer recommendations.

## Privacy

The app does not upload data to a cloud service or external database. When launched through `launch.bat`, the included local server reads and writes only the `finance-data.json` file inside the app folder. If you open `index.html` directly without `launch.bat`, the app falls back to browser local storage, and clearing browser data can remove saved finance records.

## Good monthly workflow

1. Add or update wages.
2. Add new expenses and remove old ones.
3. Update savings goal balances.
4. Review the Dashboard.
5. Open Monthly Plan and follow the category caps.
6. Use What-if Lab when a goal is not on track.
7. Confirm the top status says `Saved to finance-data.json`.
8. Export a backup after major updates.
