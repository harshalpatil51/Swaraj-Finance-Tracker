# FinanceFlow

FinanceFlow is a responsive personal finance tracker for income, expenses, savings, budgets, and monthly trends. All amounts are entered and displayed in Indian rupees (INR). It is a static HTML/JavaScript app that uses Firebase Authentication and Cloud Firestore so a signed-in user's data can be accessed across devices.

## Project structure

- `frontend/index.html` — application markup and page dependencies.
- `frontend/js/app.js` — application behavior and Firebase integration.
- `firestore.rules` — owner-scoped Firestore access and data validation.
- `firebase.json`, `.firebaserc` — Firebase CLI rules deployment configuration.
- `frontend/package.json`, `frontend/package-lock.json` — pinned frontend build tooling.
- `frontend/styles/tailwind.css`, `frontend/tailwind.config.cjs` — Tailwind source and configuration; classes are scanned from the HTML and JavaScript.
- `frontend/assets/app.css` — generated production CSS.

The app has no separate application backend; authentication and database access use the Firebase client SDK and Firestore security rules.

The dashboard month and year selectors filter totals, charts, transactions, and category-budget spending together. Each selector can independently show all months or all years; choosing both narrows the dashboard to a specific month. Monthly budget limits are scaled by the number of months in the selected period.
Transaction records can be searched by ID, title/details, category, type, payment method, date, or amount. Advanced filters support date ranges, payment method, and minimum/maximum amount; type and category filters are also available. Active transaction filters can be removed individually or cleared together.

## Default categories

- **Income:** Side Income, Monthly Salary
- **Expenses:** Food / Diet, Fun & Vacation, Groceries, Other, PG Rent, Recharge, Self Education, Sent to Home, Transportation, Unplanned
- **Savings:** Bank Account, Cash, Emergency Fund, Mutual Funds, Stocks

Existing transactions keep their saved categories; categories found on existing transactions remain available in the app.
Legacy transaction categories **Mutual Fund**, **Mutual Funds & Stocks**, and their capitalization variants are normalized to **Mutual Funds**; **Stock** is normalized to **Stocks**; and **Bank Account / Cash** is normalized to **Bank Account** when loaded. These changes are saved to the signed-in user's Firestore records. The **Total Savings** card sums all Savings-type entries. **Savings Rate** is Total Savings divided by Total Income for the selected period, shown as a percentage (0% when income is zero).
**Salary** is no longer an Income choice. Existing transactions with that category are preserved and can still be edited. **Monthly Salary** remains an available Income choice.

## Run locally

With Node.js 22 or later installed, build the production stylesheet, then serve the `frontend` directory over HTTP (don't open the HTML file directly):

```bash
cd frontend
npm ci
npm run build
python3 -m http.server 8000
```

Open `http://localhost:8000`. If port 8000 is already in use, use another port such as 8001. Firebase, Chart.js, and Font Awesome load from version-pinned CDNs, so an internet connection is required.

## Firebase setup

This repository is a copy of the FinanceFlow app, configured for the separate Firebase project `swaraj-finance-tracker`. It is independent of the original FinanceFlow Firebase project.

1. In Firebase Authentication, enable the **Email/Password** provider.
2. In Firebase Authentication settings, add the app's origin to **Authorized domains** if it is not already listed. For local development, use `localhost`; add the deployed domain before deployment.
3. Keep Cloud Firestore in **Production mode**. Deploy the owner-scoped rules in `firestore.rules`:

   ```bash
   firebase deploy --only firestore:rules
   ```

4. Deploy `frontend` as the static site root (for example, set the Vercel Root Directory to `frontend`, Build Command to `npm run build`, and Output Directory to `.`).

The Firebase web configuration in `frontend/js/app.js` is client-side configuration, not a service-account credential. Do not put service-account private keys in the frontend or commit them. Restrict the web API key to the app's expected referrers and required Firebase APIs, then verify sign-in still works. Firestore rules restrict each account to its own data. Review and test rules before inviting other users.

Tailwind CSS is compiled and minified for deployment. Firebase, Chart.js, and Font Awesome are loaded from version-pinned CDNs and require internet access. Validate the deployed domain, authentication, Firestore rules, backups, and mobile layout before inviting users.

## Data and backups

Transactions are stored at `users/{uid}/transactions`; budgets and custom categories are stored at `users/{uid}/settings/app`. Data is loaded only after sign-in. New accounts start empty; demo entries are not included. Older browser-only data is not uploaded automatically—export it from the earlier version before switching if you need to keep it.

Use the dashboard's JSON backup export to save a copy. Importing a JSON backup replaces the signed-in account's transaction list after an explicit confirmation.
Deleting a transaction requires typing `DELETE` in the confirmation dialog before the permanent delete button is enabled.

Excel workbooks and other local financial source files are ignored by Git because they may contain private data.
