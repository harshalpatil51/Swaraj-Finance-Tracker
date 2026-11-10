# GitHub Copilot Context & Instructions for FinanceFlow

## 📌 Project Overview
**FinanceFlow** is a responsive personal finance app that tracks **Income**, **Expenses**, and **Savings / Investments** with month/year dashboard filters, transaction search and advanced filters, monthly budgets, trend charts, and typed delete confirmation.

---

## 📁 Repository Directory Structure

```text
finance-tracker/
├── frontend/
│   ├── index.html             # Application markup and page dependencies
│   ├── js/
│   │   └── app.js             # Application logic and Firebase integration
│   ├── styles/tailwind.css    # Tailwind source
│   ├── tailwind.config.cjs    # Tailwind configuration
│   ├── assets/app.css         # Generated production stylesheet
│   ├── package.json           # Frontend build tooling
│   └── package-lock.json      # Locked frontend dependencies
├── firestore.rules            # Owner-scoped Firestore access rules
├── firebase.json              # Firebase CLI rules configuration
├── .firebaserc                 # Default Firebase project
└── README.md                  # Project setup & documentation
```

> **Deployment Note (Vercel):** When configuring Vercel deployment, set the **Root Directory** setting to `frontend`.
> There is no backend service. Do not create backend infrastructure unless the architecture is intentionally changed.

---

## 🛠️ Tech Stack & Key Libraries

- **Frontend Core**: Static HTML5 + Vanilla JavaScript (ES6+), separated into page markup and application logic.
- **Styling**: Tailwind CSS compiled and minified from local source with dark/light mode toggle.
- **Charts & Data Visualization**: Version-pinned Chart.js CDN.
- **Icons**: FontAwesome 6 (`https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css`).
- **Authentication**: Firebase Authentication with email/password.
- **Data Storage**: Cloud Firestore, scoped under the authenticated user's UID:
  - Transactions: `users/{uid}/transactions/{transactionId}`
  - Budgets and custom categories: `users/{uid}/settings/app`
  - Firestore rules are maintained in `firestore.rules`; deploy with `firebase deploy --only firestore:rules`.
---

## 📊 Primary Transaction Data Schema

```javascript
{
  id: string,               // Unique timestamp or ID string
  type: 'Income' | 'Expense' | 'Savings',
  title: string,            // Short description/title
  amount: number,           // Monetary numeric value
  category: string,         // Standard or user-defined custom category
  paymentMethod: string,    // e.g. "HDFC Bank", "Credit Card", "UPI / Wallet", "Cash"
  date: string,             // YYYY-MM-DD
  notes?: string            // Optional extra notes
}
```

---

## 🎯 Categories Mapping

```javascript
const INITIAL_CATEGORIES = {
  Income: ['Side Income', 'Monthly Salary'],
  Expense: ['Food / Diet', 'Fun & Vacation', 'Groceries', 'Other', 'PG Rent', 'Recharge', 'Self Education', 'Sent to Home', 'Transportation', 'Unplanned'],
  Savings: ['Bank Account', 'Cash', 'Emergency Fund', 'Mutual Funds', 'Stocks']
};
```

---

## 🤖 Guidelines & Rules for GitHub Copilot

1. **Frontend Structure**: Keep page markup in `frontend/index.html`, application behavior in `frontend/js/app.js`, and Tailwind source in `frontend/styles/tailwind.css`.
2. **No Native Alert Dialogs**: Do not use `alert()` or `confirm()`. Use modal dialogues, inline notification banners, or HTML forms.
3. **Responsive Design Rules**: Always utilize Tailwind CSS breakpoint prefixes (`sm:`, `md:`, `lg:`) to ensure proper rendering across mobile devices and desktops.
4. **Data Safety & Fallbacks**: Always handle missing attributes safely (`t.notes || ''`), validate numerical input values, and never fall back to fabricated demo data when Firebase is unavailable.
5. **Firebase Security**: Keep Firestore data scoped to `request.auth.uid`; never weaken production rules to public access. Never put service-account credentials in frontend code.
6. **Chart Re-rendering**: When adding, modifying, or deleting transactions, always call `refreshDashboard()` to recalculate KPIs, update progress bars, and destroy/re-render Chart.js instances cleanly.
7. **Production Build**: Run `npm ci` and `npm run build` in `frontend/` before deployment so the generated Tailwind stylesheet is current.
8. **Transaction Safety**: Preserve owner-scoped Firestore access, validate data before writes, and require the typed `DELETE` confirmation before deleting an entry.