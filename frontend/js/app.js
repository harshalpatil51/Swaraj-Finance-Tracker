        const firebaseConfig = {
            apiKey: "AIzaSyC4qr6m4Vlrdjd5kd1puMmcQgSRrQQIDyk",
            authDomain: "swaraj-finance-tracker.firebaseapp.com",
            projectId: "swaraj-finance-tracker",
            storageBucket: "swaraj-finance-tracker.firebasestorage.app",
            messagingSenderId: "355556144086",
            appId: "1:355556144086:web:e00f1b29de3fd929656a77"
        };
        firebase.initializeApp(firebaseConfig);
        const auth = firebase.auth();
        const db = firebase.firestore();
        const currencyFormatter = new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
        const chartCurrencyFormatter = new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            notation: 'compact',
            maximumFractionDigits: 1
        });

        function formatCurrency(amount) {
            return currencyFormatter.format(amount);
        }

        // Pre-loaded categories
        const INITIAL_CATEGORIES = {
            'Income': ['Side Income', 'Monthly Salary'],
            'Expense': ['Food / Diet', 'Fun & Vacation', 'Groceries', 'Other', 'PG Rent', 'Recharge', 'Self Education', 'Sent to Home', 'Transportation', 'Unplanned'],
            'Savings': ['Bank Account', 'Cash', 'Emergency Fund', 'Mutual Funds', 'Stocks']
        };

        const ADD_CUSTOM_OPTION = '+ Add Custom Category';

        let transactions = [];
        let categoriesMap = JSON.parse(JSON.stringify(INITIAL_CATEGORIES));
        let categoryBudgets = {};
        let currentSelectedType = 'Expense';
        let chartCategoryView = 'Expense';
        let trendChartInstance = null;
        let categoryChartInstance = null;
        let authMode = 'signin';
        let pendingImport = null;
        let pendingDeleteEntryId = null;

        // Initialize App
        window.onload = function() {
            if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
                document.documentElement.classList.add('dark');
                const themeIcon = document.getElementById('themeIcon');
                if (themeIcon) themeIcon.className = 'fa-solid fa-sun';
            }

            const entryDateElem = document.getElementById('entryDate');
            if (entryDateElem) entryDateElem.valueAsDate = new Date();

            document.getElementById('authForm').addEventListener('submit', handleAuthSubmit);
            document.getElementById('authModeToggle').addEventListener('click', toggleAuthMode);
            document.getElementById('resetPasswordButton').addEventListener('click', resetPassword);
            document.getElementById('retryLoadButton').addEventListener('click', loadAuthenticatedApp);
            document.getElementById('loadErrorSignOutButton').addEventListener('click', signOutUser);
            document.getElementById('deleteConfirmInput').addEventListener('input', updateDeleteConfirmation);
            auth.onAuthStateChanged(async user => {
                if (!user) {
                    currentUser = null;
                    document.getElementById('appContent').classList.add('hidden');
                    document.getElementById('authScreen').classList.remove('hidden');
                    document.getElementById('loadErrorActions').classList.add('hidden');
                    document.getElementById('authForm').classList.remove('hidden');
                    document.getElementById('authModeToggle').classList.remove('hidden');
                    document.getElementById('resetPasswordButton').classList.toggle('hidden', authMode === 'signup');
                    document.getElementById('authSubmit').textContent = authMode === 'signup' ? 'Create account' : 'Sign in';
                    document.getElementById('authSubtitle').textContent = authMode === 'signup'
                        ? 'Create an account to keep your data private and synced.'
                        : 'Sign in to access your private financial data.';
                    document.getElementById('authModeToggle').textContent = authMode === 'signup'
                        ? 'Already have an account? Sign in'
                        : 'Create an account';
                    setAuthMessage('');
                    return;
                }
                currentUser = user;
                await loadAuthenticatedApp();
            });
        };

        let currentUser = null;

        function setAuthMessage(message, isError = true) {
            const element = document.getElementById('authMessage');
            element.textContent = message;
            element.className = message
                ? `rounded-xl p-3 text-sm ${isError ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'}`
                : 'hidden';
        }

        function setAppMessage(message, isError = true) {
            const element = document.getElementById('appMessage');
            element.textContent = message;
            element.className = message
                ? `rounded-xl p-3 text-sm ${isError ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'}`
                : 'hidden';
        }

        function categoryKey(category) {
            return category.trim().toLocaleLowerCase('en-IN');
        }

        function canonicalSavingsCategory(category) {
            const key = categoryKey(category);
            if (['mutual fund', 'mutual funds', 'mutual funds & stocks', 'mutual funds and stocks'].includes(key)) {
                return 'Mutual Funds';
            }
            if (['stock', 'stocks'].includes(key)) return 'Stocks';
            if (['bank account / cash', 'bank account and cash'].includes(key)) return 'Bank Account';
            return category.trim();
        }

        function isRemovedIncomeCategory(category) {
            return categoryKey(category) === 'salary';
        }

        function isValidDate(date) {
            if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
            const parsedDate = new Date(`${date}T00:00:00Z`);
            return Number.isFinite(parsedDate.getTime()) && parsedDate.toISOString().slice(0, 10) === date;
        }

        function toggleAuthMode() {
            authMode = authMode === 'signin' ? 'signup' : 'signin';
            const isSignUp = authMode === 'signup';
            document.getElementById('authSubmit').textContent = isSignUp ? 'Create account' : 'Sign in';
            document.getElementById('authSubtitle').textContent = isSignUp
                ? 'Create an account to keep your data private and synced.'
                : 'Sign in to access your private financial data.';
            document.getElementById('authModeToggle').textContent = isSignUp
                ? 'Already have an account? Sign in'
                : 'Create an account';
            document.getElementById('resetPasswordButton').classList.toggle('hidden', isSignUp);
            document.getElementById('authPassword').autocomplete = isSignUp ? 'new-password' : 'current-password';
            setAuthMessage('');
        }

        function authErrorMessage(error) {
            const messages = {
                'auth/email-already-in-use': 'An account already exists for this email. Try signing in.',
                'auth/invalid-email': 'Enter a valid email address.',
                'auth/invalid-credential': 'Email or password is incorrect.',
                'auth/user-not-found': 'No account was found for this email.',
                'auth/wrong-password': 'Email or password is incorrect.',
                'auth/weak-password': 'Choose a password with at least 6 characters.',
                'auth/too-many-requests': 'Too many attempts. Wait a while and try again.',
                'auth/network-request-failed': 'Network error. Check your connection and try again.',
                'auth/operation-not-allowed': 'Email/password sign-in is disabled. Enable it in Firebase Authentication settings.',
                'auth/unauthorized-domain': 'This site is not authorized for Firebase sign-in. Add its domain in Firebase Authentication settings.'
            };
            return messages[error.code] || 'Authentication failed. Please try again.';
        }

        async function handleAuthSubmit(event) {
            event.preventDefault();
            const email = document.getElementById('authEmail').value.trim();
            const password = document.getElementById('authPassword').value;
            const submitButton = document.getElementById('authSubmit');
            submitButton.disabled = true;
            setAuthMessage('');
            try {
                if (authMode === 'signup') await auth.createUserWithEmailAndPassword(email, password);
                else await auth.signInWithEmailAndPassword(email, password);
            } catch (error) {
                setAuthMessage(authErrorMessage(error));
            } finally {
                submitButton.disabled = false;
            }
        }

        async function resetPassword() {
            const email = document.getElementById('authEmail').value.trim();
            if (!email) {
                setAuthMessage('Enter your email first, then choose Forgot password.');
                return;
            }
            try {
                await auth.sendPasswordResetEmail(email);
                setAuthMessage('If an account exists for that email, a password reset link has been sent.', false);
            } catch (error) {
                setAuthMessage(authErrorMessage(error));
            }
        }

        async function signOutUser() {
            try {
                await auth.signOut();
            } catch (error) {
                setAppMessage('Could not sign out. Please try again.');
            }
        }

        async function loadAuthenticatedApp() {
            if (!currentUser) return;
            const appContent = document.getElementById('appContent');
            const authScreen = document.getElementById('authScreen');
            const actions = document.getElementById('loadErrorActions');
            actions.classList.add('hidden');
            document.getElementById('authForm').classList.add('hidden');
            document.getElementById('authModeToggle').classList.add('hidden');
            document.getElementById('resetPasswordButton').classList.add('hidden');
            setAuthMessage('Loading your data...', false);
            authScreen.classList.remove('hidden');
            appContent.classList.add('hidden');
            try {
                await loadSettings();
                const migratedCategoryCount = await loadData();
                updateCategoryOptions();
                populateFilterCategoryDropdown();
                document.getElementById('signedInEmail').textContent = currentUser.email || '';
                setAppMessage(
                    migratedCategoryCount
                        ? `Updated ${migratedCategoryCount} transaction categor${migratedCategoryCount === 1 ? 'y' : 'ies'} to match your current savings categories.`
                        : '',
                    false
                );
                appContent.classList.remove('hidden');
                authScreen.classList.add('hidden');
                refreshDashboard();
            } catch (error) {
                setAuthMessage('Could not load your data. Check your internet connection and Firestore security rules, then retry.');
                actions.classList.remove('hidden');
            }
        }

        function toggleTheme() {
            const isDark = document.documentElement.classList.toggle('dark');
            const themeIcon = document.getElementById('themeIcon');
            if (themeIcon) themeIcon.className = isDark ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
            renderCharts();
        }

        // Budgeting Engine
        async function saveBudgets(e) {
            e.preventDefault();
            const nextBudgets = { ...categoryBudgets };
            categoriesMap['Expense'].forEach((cat, index) => {
                const val = parseFloat(document.getElementById(`budget_input_${index}`).value) || 0;
                if (val > 0) nextBudgets[cat] = val;
                else delete nextBudgets[cat];
            });
            try {
                await userSettingsDocument().set({ budgets: nextBudgets }, { merge: true });
                categoryBudgets = nextBudgets;
                closeBudgetModal();
                renderBudgets();
                setAppMessage('Budget limits saved.', false);
            } catch (error) {
                setAppMessage('Could not save budget limits. Check your connection and try again.');
            }
        }

        function openBudgetModal() {
            const container = document.getElementById('budgetInputsContainer');
            container.innerHTML = '';
            categoriesMap['Expense'].forEach((cat, index) => {
                const currentVal = categoryBudgets[cat] || '';
                const div = document.createElement('div');
                div.className = "flex items-center justify-between text-xs gap-2";
                div.innerHTML = `
                    <span class="text-slate-700 dark:text-slate-300 font-medium truncate">${escapeHtml(cat)}</span>
                    <input type="number" min="0" step="0.01" id="budget_input_${index}" value="${currentVal}" placeholder="No limit" class="w-28 px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none">
                `;
                container.appendChild(div);
            });
            document.getElementById('budgetModal').classList.remove('hidden');
        }

        function closeBudgetModal() {
            document.getElementById('budgetModal').classList.add('hidden');
        }

        function renderBudgets() {
            const container = document.getElementById('budgetProgressContainer');
            container.innerHTML = '';
            const periodTransactions = getPeriodTransactions();
            const monthCount = getBudgetPeriodMonthCount();
            document.getElementById('budgetPeriodLabel').textContent = getDashboardPeriodLabel();

            const budgetedCats = Object.keys(categoryBudgets);
            if (budgetedCats.length === 0) {
                container.innerHTML = `<p class="text-xs text-slate-400 col-span-full italic">No monthly category budget limits set yet. Click "Set Limits" above to track spending limits.</p>`;
                return;
            }

            budgetedCats.forEach(cat => {
                const limit = categoryBudgets[cat] * monthCount;
                const spent = periodTransactions
                    .filter(t => t.type === 'Expense' && t.category === cat)
                    .reduce((a, b) => a + b.amount, 0);
                const percent = Math.min(Math.round((spent / limit) * 100), 100);

                let barColor = 'bg-emerald-500';
                let textColor = 'text-slate-900 dark:text-white';
                if (percent >= 100) { barColor = 'bg-rose-500'; textColor = 'text-rose-600 dark:text-rose-400'; }
                else if (percent >= 80) { barColor = 'bg-amber-500'; }

                const card = document.createElement('div');
                card.className = "p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700/50 space-y-1.5";
                card.innerHTML = `
                    <div class="flex justify-between items-center text-xs">
                        <span class="font-semibold text-slate-700 dark:text-slate-300 truncate">${escapeHtml(cat)}</span>
                        <span class="font-bold ${textColor}">${percent}%</span>
                    </div>
                    <div class="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                        <div class="${barColor} h-2 rounded-full transition-all duration-300" style="width: ${percent}%"></div>
                    </div>
                    <div class="flex justify-between items-center text-[11px] text-slate-400">
                        <span>Spent: ${formatCurrency(spent)}</span>
                        <span>Limit (${monthCount} ${monthCount === 1 ? 'month' : 'months'}): ${formatCurrency(limit)}</span>
                    </div>
                `;
                container.appendChild(card);
            });
        }

        function getDashboardPeriodLabel() {
            const selectedMonth = document.getElementById('dashboardMonth').value;
            const selectedYear = document.getElementById('dashboardYear').value;
            if (selectedMonth === 'ALL' && selectedYear === 'ALL') return 'All Time';

            const monthLabel = selectedMonth === 'ALL'
                ? 'All Months'
                : new Date(2000, Number(selectedMonth) - 1, 1).toLocaleString('en-IN', { month: 'long' });
            if (selectedYear === 'ALL') return `${monthLabel} · All Years`;
            if (selectedMonth === 'ALL') return `${selectedYear} · ${monthLabel}`;
            return `${monthLabel} ${selectedYear}`;
        }

        function getBudgetPeriodMonthCount(now = new Date()) {
            const selectedMonth = document.getElementById('dashboardMonth').value;
            const selectedYear = document.getElementById('dashboardYear').value;
            const currentMonthIndex = now.getFullYear() * 12 + now.getMonth();
            const matchingMonthIndexes = getPeriodTransactions()
                .filter(item => typeof item.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(item.date))
                .map(item => Number(item.date.slice(0, 4)) * 12 + Number(item.date.slice(5, 7)) - 1);
            let startMonthIndex;
            let endMonthIndex;

            if (selectedYear !== 'ALL') {
                const year = Number(selectedYear);
                startMonthIndex = year * 12 + (selectedMonth === 'ALL' ? 0 : Number(selectedMonth) - 1);
                endMonthIndex = selectedMonth === 'ALL'
                    ? (year === now.getFullYear() ? currentMonthIndex : year * 12 + 11)
                    : startMonthIndex;
            } else if (selectedMonth !== 'ALL') {
                const matchingYears = new Set(matchingMonthIndexes.map(index => Math.floor(index / 12)));
                if (Number(selectedMonth) <= now.getMonth() + 1) matchingYears.add(now.getFullYear());
                return Math.max(1, matchingYears.size);
            } else {
                startMonthIndex = matchingMonthIndexes.length
                    ? Math.min(currentMonthIndex, ...matchingMonthIndexes)
                    : currentMonthIndex;
                endMonthIndex = Math.max(currentMonthIndex, ...matchingMonthIndexes);
            }

            if (matchingMonthIndexes.length) {
                const periodIndexes = matchingMonthIndexes.filter(index =>
                    index >= startMonthIndex && index <= endMonthIndex
                );
                if (periodIndexes.length) {
                    startMonthIndex = Math.min(startMonthIndex, ...periodIndexes);
                    endMonthIndex = Math.max(endMonthIndex, ...periodIndexes);
                }
            }
            return Math.max(1, endMonthIndex - startMonthIndex + 1);
        }

        function userSettingsDocument() {
            if (!currentUser) throw new Error('You must be signed in to access settings.');
            return db.collection('users').doc(currentUser.uid).collection('settings').doc('app');
        }

        function userTransactionsCollection() {
            if (!currentUser) throw new Error('You must be signed in to access transactions.');
            return db.collection('users').doc(currentUser.uid).collection('transactions');
        }

        async function loadSettings() {
            categoriesMap = JSON.parse(JSON.stringify(INITIAL_CATEGORIES));
            categoryBudgets = {};
            const snapshot = await userSettingsDocument().get();
            if (!snapshot.exists) return;

            const settings = snapshot.data();
            const storedCustomCats = settings.customCategories || {};
            const customCats = {};
            Object.keys(INITIAL_CATEGORIES).forEach(type => {
                const seen = new Set(INITIAL_CATEGORIES[type].map(categoryKey));
                customCats[type] = [];
                if (!Array.isArray(storedCustomCats[type])) return;
                storedCustomCats[type].forEach(category => {
                    if (typeof category !== 'string' || !category.trim()) return;
                    if (type === 'Income' && isRemovedIncomeCategory(category)) return;
                    const normalized = type === 'Savings'
                        ? canonicalSavingsCategory(category)
                        : category.trim();
                    const key = categoryKey(normalized);
                    if (INITIAL_CATEGORIES[type].some(defaultCategory => categoryKey(defaultCategory) === key)) return;
                    if (seen.has(key)) return;
                    seen.add(key);
                    categoriesMap[type].push(normalized);
                    customCats[type].push(normalized);
                });
            });
            if (JSON.stringify(storedCustomCats) !== JSON.stringify(customCats)) {
                await userSettingsDocument().set({ customCategories: customCats }, { merge: true });
            }
            if (settings.budgets && typeof settings.budgets === 'object') {
                Object.entries(settings.budgets).forEach(([category, amount]) => {
                    if (typeof amount === 'number' && Number.isFinite(amount) && amount > 0) {
                        categoryBudgets[category] = amount;
                    }
                });
            }
        }

        async function saveCustomCategories() {
            const customOnly = {};
            Object.keys(categoriesMap).forEach(type => {
                const defaults = new Set(INITIAL_CATEGORIES[type].map(categoryKey));
                const seen = new Set(defaults);
                customOnly[type] = categoriesMap[type].filter(category => {
                    const key = categoryKey(category);
                    if (type === 'Income' && isRemovedIncomeCategory(category)) return false;
                    if (seen.has(key) || (type === 'Savings' && canonicalSavingsCategory(category) !== category.trim())) return false;
                    seen.add(key);
                    return true;
                });
            });
            await userSettingsDocument().set({ customCategories: customOnly }, { merge: true });
        }

        async function loadData() {
            const snapshot = await userTransactionsCollection().get();
            transactions = snapshot.docs
                .map(item => ({ ...item.data(), id: item.id }))
                .sort((a, b) => b.date.localeCompare(a.date));
            const categoryUpdates = [];
            transactions.forEach(item => {
                if (!categoriesMap[item.type] || typeof item.category !== 'string' || !item.category.trim()) return;
                let category = item.type === 'Savings'
                    ? canonicalSavingsCategory(item.category)
                    : item.category.trim();
                if (item.type === 'Income' && isRemovedIncomeCategory(category)) return;
                const existingCategory = categoriesMap[item.type].find(
                    existing => categoryKey(existing) === categoryKey(category)
                );
                if (existingCategory) category = existingCategory;
                else categoriesMap[item.type].push(category);
                if (category !== item.category) {
                    item.category = category;
                    categoryUpdates.push(item);
                }
            });
            for (let index = 0; index < categoryUpdates.length; index += 450) {
                const batch = db.batch();
                categoryUpdates.slice(index, index + 450).forEach(item => {
                    batch.update(userTransactionsCollection().doc(item.id), { category: item.category });
                });
                await batch.commit();
            }
            return categoryUpdates.length;
        }

        // Modal Controls
        function openTransactionModal(editId = null) {
            document.getElementById('transactionForm').reset();
            document.getElementById('customCategoryContainer').classList.add('hidden');
            document.getElementById('editingEntryId').value = editId || '';

            if (editId) {
                const item = transactions.find(t => t.id === editId);
                if (item) {
                    document.getElementById('modalTitle').textContent = 'Edit Transaction';
                    document.getElementById('entryTitle').value = item.title;
                    document.getElementById('entryAmount').value = item.amount;
                    document.getElementById('entryPaymentMethod').value = item.paymentMethod;
                    document.getElementById('entryDate').value = item.date;
                    document.getElementById('entryNotes').value = item.notes || '';
                    selectType(item.type);
                    if (!categoriesMap[item.type].includes(item.category)) {
                        if (item.type === 'Income' && isRemovedIncomeCategory(item.category)) {
                            const legacyOption = document.createElement('option');
                            legacyOption.value = item.category;
                            legacyOption.textContent = item.category;
                            document.getElementById('entryCategory').appendChild(legacyOption);
                        } else {
                            categoriesMap[item.type].push(item.category);
                            saveCustomCategories().catch(() => setAppMessage('Could not save the custom category.'));
                            updateCategoryOptions();
                        }
                    }
                    document.getElementById('entryCategory').value = item.category;
                }
            } else {
                document.getElementById('modalTitle').textContent = 'Add Transaction';
                document.getElementById('entryDate').valueAsDate = new Date();
                selectType('Expense');
            }

            document.getElementById('entryModal').classList.remove('hidden');
        }

        function closeTransactionModal() {
            document.getElementById('entryModal').classList.add('hidden');
            document.getElementById('transactionForm').reset();
            document.getElementById('editingEntryId').value = '';
        }

        function selectType(type) {
            currentSelectedType = type;
            ['Income', 'Expense', 'Savings'].forEach(t => {
                const btn = document.getElementById(`tab${t}`);
                if (t === type) btn.className = "py-2 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs font-bold";
                else btn.className = "py-2 rounded-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors font-semibold";
            });
            updateCategoryOptions();
        }

        function updateCategoryOptions() {
            const categorySelect = document.getElementById('entryCategory');
            categorySelect.innerHTML = '';

            categoriesMap[currentSelectedType].forEach(cat => {
                const opt = document.createElement('option');
                opt.value = cat;
                opt.textContent = cat;
                categorySelect.appendChild(opt);
            });

            const customOpt = document.createElement('option');
            customOpt.value = ADD_CUSTOM_OPTION;
            customOpt.textContent = ADD_CUSTOM_OPTION;
            categorySelect.appendChild(customOpt);

            checkCustomCategoryTrigger();
        }

        function checkCustomCategoryTrigger() {
            const val = document.getElementById('entryCategory').value;
            const customContainer = document.getElementById('customCategoryContainer');
            if (val === ADD_CUSTOM_OPTION) {
                customContainer.classList.remove('hidden');
                document.getElementById('customCategoryInput').required = true;
            } else {
                customContainer.classList.add('hidden');
                document.getElementById('customCategoryInput').required = false;
            }
        }

        async function handleSaveEntry(e) {
            e.preventDefault();
            const editId = document.getElementById('editingEntryId').value;
            const title = document.getElementById('entryTitle').value.trim();
            const amount = parseFloat(document.getElementById('entryAmount').value);
            let category = document.getElementById('entryCategory').value;
            const paymentMethod = document.getElementById('entryPaymentMethod').value;
            const date = document.getElementById('entryDate').value;
            const notes = document.getElementById('entryNotes').value.trim();

            if (!title || title.length > 200 || !Number.isFinite(amount) || amount <= 0
                || !category || category.length > 100 || !isValidDate(date) || notes.length > 1000) {
                setAppMessage('Enter a title, a positive valid amount, a category, and a date.');
                return;
            }

            if (category === ADD_CUSTOM_OPTION) {
                const customInput = document.getElementById('customCategoryInput').value.trim();
                if (!customInput) {
                    setAppMessage('Enter a name for the custom category.');
                    return;
                }
                category = customInput;
            }

            const isNewCategory = !categoriesMap[currentSelectedType].includes(category)
                && !(currentSelectedType === 'Income' && isRemovedIncomeCategory(category));
            if (isNewCategory) categoriesMap[currentSelectedType].push(category);
            const entry = {
                id: editId || userTransactionsCollection().doc().id,
                type: currentSelectedType,
                title,
                amount,
                category,
                paymentMethod,
                date,
                notes
            };
            const { id, ...entryData } = entry;
            try {
                if (isNewCategory) await saveCustomCategories();
                await userTransactionsCollection().doc(id).set(entryData);
                const index = transactions.findIndex(item => item.id === id);
                if (index >= 0) transactions[index] = entry;
                else transactions.unshift(entry);
                setAppMessage('');
                closeTransactionModal();
                refreshDashboard();
            } catch (error) {
                setAppMessage('Could not save the transaction. Check your connection and try again.');
            }
        }

        async function deleteEntry(id) {
            const item = transactions.find(transaction => transaction.id === id);
            if (!item) {
                setAppMessage('Could not find that transaction. Refresh the list and try again.');
                return;
            }
            pendingDeleteEntryId = id;
            document.getElementById('deleteConfirmDescription').textContent = item.title;
            document.getElementById('deleteConfirmDetails').textContent = `${item.type} · ${item.category} · ${item.date}`;
            document.getElementById('deleteConfirmAmount').textContent = formatCurrency(item.amount);
            document.getElementById('deleteConfirmInput').value = '';
            document.getElementById('deleteConfirmInput').disabled = false;
            document.getElementById('deleteConfirmError').textContent = '';
            document.getElementById('deleteConfirmError').classList.add('hidden');
            document.getElementById('deleteConfirmCancel').disabled = false;
            document.getElementById('deleteConfirmButton').disabled = true;
            document.getElementById('deleteConfirmModal').classList.remove('hidden');
            document.getElementById('deleteConfirmInput').focus();
        }

        function updateDeleteConfirmation() {
            const confirmed = document.getElementById('deleteConfirmInput').value === 'DELETE';
            document.getElementById('deleteConfirmButton').disabled = !confirmed;
        }

        function cancelDeleteEntry() {
            pendingDeleteEntryId = null;
            document.getElementById('deleteConfirmModal').classList.add('hidden');
            document.getElementById('deleteConfirmInput').value = '';
        }

        async function confirmDeleteEntry() {
            if (!pendingDeleteEntryId || document.getElementById('deleteConfirmInput').value !== 'DELETE') return;
            const id = pendingDeleteEntryId;
            const confirmButton = document.getElementById('deleteConfirmButton');
            const cancelButton = document.getElementById('deleteConfirmCancel');
            const input = document.getElementById('deleteConfirmInput');
            confirmButton.disabled = true;
            cancelButton.disabled = true;
            input.disabled = true;
            try {
                await userTransactionsCollection().doc(id).delete();
                transactions = transactions.filter(item => item.id !== id);
                pendingDeleteEntryId = null;
                document.getElementById('deleteConfirmModal').classList.add('hidden');
                setAppMessage('');
                refreshDashboard();
            } catch (error) {
                const errorElement = document.getElementById('deleteConfirmError');
                errorElement.textContent = 'Could not delete the transaction. Check your connection and try again.';
                errorElement.classList.remove('hidden');
                cancelButton.disabled = false;
                input.disabled = false;
                confirmButton.disabled = input.value !== 'DELETE';
            }
        }

        function refreshDashboard() {
            updateDashboardYearOptions();
            calculateMetrics();
            renderBudgets();
            populateFilterCategoryDropdown();
            populateFilterPaymentMethodDropdown();
            renderTable();
            renderCharts();
        }

        function updateDashboardYearOptions() {
            const yearSelect = document.getElementById('dashboardYear');
            const selectedYear = yearSelect.value;
            const years = new Set([String(new Date().getFullYear())]);
            transactions.forEach(item => {
                if (typeof item.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(item.date)) {
                    years.add(item.date.slice(0, 4));
                }
            });
            yearSelect.innerHTML = '<option value="ALL">All years</option>';
            [...years].sort((a, b) => Number(b) - Number(a)).forEach(year => {
                const option = document.createElement('option');
                option.value = year;
                option.textContent = year;
                yearSelect.appendChild(option);
            });
            yearSelect.value = years.has(selectedYear) ? selectedYear : 'ALL';
        }

        function getPeriodTransactions() {
            const selectedMonth = document.getElementById('dashboardMonth').value;
            const selectedYear = document.getElementById('dashboardYear').value;
            if (selectedMonth === 'ALL' && selectedYear === 'ALL') return transactions;
            return transactions.filter(item => {
                if (typeof item.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(item.date)) return false;
                const matchesMonth = selectedMonth === 'ALL' || item.date.slice(5, 7) === selectedMonth;
                const matchesYear = selectedYear === 'ALL' || item.date.slice(0, 4) === selectedYear;
                return matchesMonth && matchesYear;
            });
        }

        function onDashboardPeriodChange() {
            refreshDashboard();
        }

        function calculateMetrics() {
            const periodTransactions = getPeriodTransactions();
            const totalIncome = periodTransactions.filter(t => t.type === 'Income').reduce((a, b) => a + b.amount, 0);
            const totalExpense = periodTransactions.filter(t => t.type === 'Expense').reduce((a, b) => a + b.amount, 0);
            const totalSavings = periodTransactions.filter(t => t.type === 'Savings').reduce((a, b) => a + b.amount, 0);

            const cashRemaining = totalIncome - totalExpense - totalSavings;
            const savingsRate = totalIncome > 0 ? Math.round((totalSavings / totalIncome) * 100) : 0;

            document.getElementById('kpiIncome').textContent = formatCurrency(totalIncome);
            document.getElementById('kpiExpense').textContent = formatCurrency(totalExpense);
            document.getElementById('kpiSavings').textContent = formatCurrency(totalSavings);

            const netFlowElem = document.getElementById('kpiNetFlow');
            netFlowElem.textContent = `${cashRemaining > 0 ? '+' : ''}${formatCurrency(cashRemaining)}`;
            netFlowElem.className = `text-xl sm:text-2xl font-bold ${cashRemaining >= 0 ? 'text-slate-900 dark:text-white' : 'text-rose-600 dark:text-rose-400'}`;

            document.getElementById('kpiSavingsRate').textContent = `${savingsRate}%`;
            document.getElementById('savingsRateBar').style.width = `${Math.min(Math.max(savingsRate, 0), 100)}%`;
        }

        function onFilterTypeChange() {
            populateFilterCategoryDropdown();
            renderTable();
        }

        function populateFilterCategoryDropdown() {
            const filterTypeElem = document.getElementById('filterType');
            const categoryFilter = document.getElementById('filterCategory');

            if (!categoryFilter) return;

            const filterTypeVal = filterTypeElem ? filterTypeElem.value : 'ALL';
            const currentSelected = categoryFilter.value;

            categoryFilter.innerHTML = '<option value="ALL">All Categories</option>';

            let availableCats = [];
            if (filterTypeVal === 'ALL') {
                Object.values(categoriesMap).forEach(cats => availableCats.push(...cats));
            } else if (categoriesMap[filterTypeVal]) {
                availableCats = [...categoriesMap[filterTypeVal]];
            }

            const uniqueCats = [...new Set(availableCats)];
            uniqueCats.forEach(cat => {
                const opt = document.createElement('option');
                opt.value = cat;
                opt.textContent = cat;
                categoryFilter.appendChild(opt);
            });

            if (uniqueCats.includes(currentSelected)) categoryFilter.value = currentSelected;
        }

        function populateFilterPaymentMethodDropdown() {
            const methodFilter = document.getElementById('filterPaymentMethod');
            if (!methodFilter) return;
            const selectedMethod = methodFilter.value;
            const methods = [...new Set(transactions
                .map(item => typeof item.paymentMethod === 'string' ? item.paymentMethod.trim() : '')
                .filter(Boolean))].sort((a, b) => a.localeCompare(b));
            methodFilter.innerHTML = '<option value="ALL">All payment methods</option>';
            methods.forEach(method => {
                const option = document.createElement('option');
                option.value = method;
                option.textContent = method;
                methodFilter.appendChild(option);
            });
            methodFilter.value = methods.includes(selectedMethod) ? selectedMethod : 'ALL';
        }

        function getActiveTransactionFilters() {
            const definitions = [
                { id: 'searchInput', key: 'search', label: 'Search', active: value => Boolean(value.trim()) },
                { id: 'filterType', key: 'type', label: 'Type', active: value => value !== 'ALL' },
                { id: 'filterCategory', key: 'category', label: 'Category', active: value => value !== 'ALL' },
                { id: 'filterDateFrom', key: 'dateFrom', label: 'From', active: Boolean },
                { id: 'filterDateTo', key: 'dateTo', label: 'To', active: Boolean },
                { id: 'filterPaymentMethod', key: 'paymentMethod', label: 'Method', active: value => value !== 'ALL' },
                { id: 'filterAmountMin', key: 'amountMin', label: 'Min amount', active: Boolean },
                { id: 'filterAmountMax', key: 'amountMax', label: 'Max amount', active: Boolean }
            ];
            return definitions.flatMap(filter => {
                const value = document.getElementById(filter.id).value;
                return filter.active(value) ? [{ ...filter, value }] : [];
            });
        }

        function renderActiveTransactionFilters(filters = getActiveTransactionFilters()) {
            const container = document.getElementById('activeTransactionFilters');
            container.innerHTML = '';
            filters.forEach(filter => {
                const chip = document.createElement('button');
                chip.type = 'button';
                chip.className = 'inline-flex items-center gap-1 px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-700 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600';
                chip.title = `Remove ${filter.label.toLowerCase()} filter`;
                chip.setAttribute('aria-label', chip.title);
                const valueLabel = filter.key === 'search'
                    ? filter.value.trim()
                    : filter.key.startsWith('amount')
                        ? formatCurrency(Number(filter.value))
                        : filter.value;
                chip.textContent = `${filter.label}: ${valueLabel} ×`;
                chip.addEventListener('click', () => clearTransactionFilter(filter.key));
                container.appendChild(chip);
            });
            document.getElementById('clearTransactionFilters').classList.toggle('hidden', filters.length === 0);
        }

        function clearTransactionFilter(key) {
            const controls = {
                search: ['searchInput', ''],
                type: ['filterType', 'ALL'],
                category: ['filterCategory', 'ALL'],
                dateFrom: ['filterDateFrom', ''],
                dateTo: ['filterDateTo', ''],
                paymentMethod: ['filterPaymentMethod', 'ALL'],
                amountMin: ['filterAmountMin', ''],
                amountMax: ['filterAmountMax', '']
            };
            const control = controls[key];
            if (!control) return;
            document.getElementById(control[0]).value = control[1];
            if (key === 'type') populateFilterCategoryDropdown();
            renderTable();
        }

        function clearTransactionFilters() {
            document.getElementById('searchInput').value = '';
            document.getElementById('filterType').value = 'ALL';
            document.getElementById('filterDateFrom').value = '';
            document.getElementById('filterDateTo').value = '';
            document.getElementById('filterAmountMin').value = '';
            document.getElementById('filterAmountMax').value = '';
            document.getElementById('filterPaymentMethod').value = 'ALL';
            populateFilterCategoryDropdown();
            document.getElementById('filterCategory').value = 'ALL';
            renderTable();
        }

        function renderTable() {
            const tbody = document.getElementById('transactionTableBody');
            const emptyState = document.getElementById('emptyState');
            const searchVal = document.getElementById('searchInput').value.trim().toLocaleLowerCase('en-IN');
            const filterTypeVal = document.getElementById('filterType').value;
            const filterCatVal = document.getElementById('filterCategory').value;
            const dateFrom = document.getElementById('filterDateFrom').value;
            const dateTo = document.getElementById('filterDateTo').value;
            const paymentMethod = document.getElementById('filterPaymentMethod').value;
            const minAmountValue = document.getElementById('filterAmountMin').value;
            const maxAmountValue = document.getElementById('filterAmountMax').value;
            const minAmount = minAmountValue === '' ? null : Number(minAmountValue);
            const maxAmount = maxAmountValue === '' ? null : Number(maxAmountValue);
            const filters = getActiveTransactionFilters();
            renderActiveTransactionFilters(filters);

            const filterMessage = document.getElementById('transactionFilterMessage');
            const invalidAmount = (minAmount !== null && (!Number.isFinite(minAmount) || minAmount < 0))
                || (maxAmount !== null && (!Number.isFinite(maxAmount) || maxAmount < 0));
            const invalidDateRange = dateFrom && dateTo && dateFrom > dateTo;
            const invalidRange = invalidDateRange || invalidAmount
                || (minAmount !== null && maxAmount !== null && minAmount > maxAmount);
            filterMessage.textContent = invalidRange
                ? (invalidDateRange
                    ? 'Start date must be on or before end date.'
                    : invalidAmount
                        ? 'Enter valid amounts that are zero or greater.'
                        : 'Minimum amount must be less than or equal to maximum amount.')
                : '';
            if (invalidRange) {
                tbody.innerHTML = '';
                emptyState.classList.remove('hidden');
                document.getElementById('transactionResultCount').textContent = '0 transactions';
                return;
            }

            const filtered = getPeriodTransactions().filter(t => {
                const searchableValues = [
                    t.id, t.title, t.notes, t.category, t.type, t.paymentMethod,
                    t.date, Number.isFinite(t.amount) ? String(t.amount) : ''
                ];
                const matchesSearch = searchableValues.some(value =>
                    String(value ?? '').toLocaleLowerCase('en-IN').includes(searchVal)
                );
                const matchesType = filterTypeVal === 'ALL' || t.type === filterTypeVal;
                const matchesCat = filterCatVal === 'ALL' || t.category === filterCatVal;
                const matchesFrom = !dateFrom || t.date >= dateFrom;
                const matchesTo = !dateTo || t.date <= dateTo;
                const matchesMethod = paymentMethod === 'ALL' || t.paymentMethod === paymentMethod;
                const matchesMinAmount = minAmount === null || t.amount >= minAmount;
                const matchesMaxAmount = maxAmount === null || t.amount <= maxAmount;
                return matchesSearch && matchesType && matchesCat && matchesFrom && matchesTo
                    && matchesMethod && matchesMinAmount && matchesMaxAmount;
            });

            document.getElementById('transactionResultCount').textContent =
                `${filtered.length} ${filtered.length === 1 ? 'transaction' : 'transactions'}`;
            tbody.innerHTML = '';
            if (filtered.length === 0) {
                emptyState.classList.remove('hidden');
                return;
            } else {
                emptyState.classList.add('hidden');
            }

            filtered.forEach(item => {
                const tr = document.createElement('tr');
                tr.className = "hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors";

                let typeBadge = '';
                if (item.type === 'Income') typeBadge = '<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">🟢 Income</span>';
                else if (item.type === 'Expense') typeBadge = '<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">🔴 Expense</span>';
                else typeBadge = '<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">🔵 Savings</span>';

                tr.innerHTML = `
                    <td class="py-3 px-3">${typeBadge}</td>
                    <td class="py-3 px-3">
                        <div class="font-medium text-slate-900 dark:text-white">${escapeHtml(item.title)}</div>
                        ${item.notes ? `<div class="text-xs text-slate-400">${escapeHtml(item.notes)}</div>` : ''}
                    </td>
                    <td class="py-3 px-3 text-xs text-slate-600 dark:text-slate-300">${escapeHtml(item.category)}</td>
                    <td class="py-3 px-3 text-xs text-slate-500 dark:text-slate-400">${escapeHtml(item.paymentMethod)}</td>
                    <td class="py-3 px-3 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">${escapeHtml(item.date)}</td>
                    <td class="py-3 px-3 text-right font-semibold ${item.type === 'Income' ? 'text-emerald-600 dark:text-emerald-400' : item.type === 'Expense' ? 'text-rose-600 dark:text-rose-400' : 'text-blue-600 dark:text-blue-400'}">
                        ${item.type === 'Income' ? '+' : item.type === 'Expense' ? '-' : ''}${formatCurrency(item.amount)}
                    </td>
                `;
                const actionsCell = document.createElement('td');
                actionsCell.className = 'py-3 px-3 text-center';
                const actions = document.createElement('div');
                actions.className = 'flex items-center justify-center gap-1';
                const editButton = document.createElement('button');
                editButton.type = 'button';
                editButton.title = 'Edit Entry';
                editButton.className = 'text-slate-400 hover:text-brand-500 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors';
                editButton.innerHTML = '<i class="fa-solid fa-pen-to-square text-xs"></i>';
                editButton.addEventListener('click', () => openTransactionModal(item.id));
                const deleteButton = document.createElement('button');
                deleteButton.type = 'button';
                deleteButton.title = 'Delete Entry';
                deleteButton.className = 'text-slate-400 hover:text-rose-500 p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors';
                deleteButton.innerHTML = '<i class="fa-solid fa-trash-can text-xs"></i>';
                deleteButton.addEventListener('click', () => deleteEntry(item.id));
                actions.append(editButton, deleteButton);
                actionsCell.appendChild(actions);
                tr.appendChild(actionsCell);
                tbody.appendChild(tr);
            });
        }

        function toggleChartCategoryView(viewType) {
            chartCategoryView = viewType;
            const expBtn = document.getElementById('chartCategoryExpenseBtn');
            const savBtn = document.getElementById('chartCategorySavingsBtn');

            if (viewType === 'Expense') {
                expBtn.className = "px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs font-bold";
                savBtn.className = "px-2.5 py-1 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-medium";
            } else {
                savBtn.className = "px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs font-bold";
                expBtn.className = "px-2.5 py-1 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-medium";
            }
            renderCharts();
        }

        function renderCharts() {
            const isDark = document.documentElement.classList.contains('dark');
            const textColor = isDark ? '#cbd5e1' : '#475569';

            // 1. Monthly Trend Line Chart (Income, Expense, Savings over time)
            const monthlyAgg = {};
            getPeriodTransactions().forEach(t => {
                if (!t.date) return;
                const monthKey = t.date.substring(0, 7); // e.g., '2026-11'
                if (!monthlyAgg[monthKey]) monthlyAgg[monthKey] = { Income: 0, Expense: 0, Savings: 0 };
                if (monthlyAgg[monthKey][t.type] !== undefined) {
                    monthlyAgg[monthKey][t.type] += t.amount;
                }
            });

            const sortedMonths = Object.keys(monthlyAgg).sort();
            const incomeSeries = sortedMonths.map(m => monthlyAgg[m].Income);
            const expenseSeries = sortedMonths.map(m => monthlyAgg[m].Expense);
            const savingsSeries = sortedMonths.map(m => monthlyAgg[m].Savings);

            if (trendChartInstance) trendChartInstance.destroy();
            const ctx1 = document.getElementById('trendChart').getContext('2d');
            trendChartInstance = new Chart(ctx1, {
                type: 'line',
                data: {
                    labels: sortedMonths,
                    datasets: [
                        { label: 'Income', data: incomeSeries, borderColor: '#10b981', backgroundColor: '#10b98122', tension: 0.3, fill: true },
                        { label: 'Expenses', data: expenseSeries, borderColor: '#f43f5e', backgroundColor: '#f43f5e22', tension: 0.3, fill: true },
                        { label: 'Savings', data: savingsSeries, borderColor: '#3b82f6', backgroundColor: '#3b82f622', tension: 0.3, fill: true }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'top', labels: { color: textColor, font: { family: 'Inter', size: 11 } } },
                        tooltip: {
                            callbacks: {
                                label: context => `${context.dataset.label}: ${formatCurrency(context.parsed.y)}`
                            }
                        }
                    },
                    scales: {
                        x: { ticks: { color: textColor, font: { family: 'Inter' } }, grid: { display: false } },
                        y: {
                            ticks: {
                                color: textColor,
                                font: { family: 'Inter' },
                                callback: value => chartCurrencyFormatter.format(value)
                            },
                            grid: { color: isDark ? '#334155' : '#f1f5f9' }
                        }
                    }
                }
            });

            // 2. Category Breakdown Donut Chart
            const filteredCategoryItems = getPeriodTransactions().filter(t => t.type === chartCategoryView);
            const categoryMap = {};
            filteredCategoryItems.forEach(e => {
                categoryMap[e.category] = (categoryMap[e.category] || 0) + e.amount;
            });

            const noChartData = document.getElementById('noExpenseChartData');
            const categoryCanvas = document.getElementById('categoryChart');

            if (Object.keys(categoryMap).length === 0) {
                categoryCanvas.classList.add('hidden');
                noChartData.classList.remove('hidden');
                return;
            } else {
                categoryCanvas.classList.remove('hidden');
                noChartData.classList.add('hidden');
            }

            if (categoryChartInstance) categoryChartInstance.destroy();
            const ctx2 = categoryCanvas.getContext('2d');
            categoryChartInstance = new Chart(ctx2, {
                type: 'doughnut',
                data: {
                    labels: Object.keys(categoryMap),
                    datasets: [{
                        data: Object.values(categoryMap),
                        backgroundColor: ['#f43f5e', '#f59e0b', '#8b5cf6', '#ec4899', '#0ea5e9', '#64748b', '#10b981', '#06b6d4', '#a855f7'],
                        borderWidth: 2,
                        borderColor: isDark ? '#1e293b' : '#ffffff'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: { color: textColor, font: { family: 'Inter', size: 10 } }
                        },
                        tooltip: {
                            callbacks: {
                                label: context => `${context.label}: ${formatCurrency(context.parsed)}`
                            }
                        }
                    }
                }
            });
        }

        // CSV & JSON Data Backup Export/Import
        function exportDataJSON() {
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(transactions, null, 2));
            const dlAnchorElem = document.createElement('a');
            dlAnchorElem.setAttribute("href", dataStr);
            dlAnchorElem.setAttribute("download", `FinanceFlow_Backup_${new Date().toISOString().slice(0,10)}.json`);
            dlAnchorElem.click();
        }

        function normalizeImportedTransactions(records) {
            if (!Array.isArray(records)) throw new Error('The backup must contain a JSON array.');
            const ids = new Set();
            return records.map(record => {
                if (!record || typeof record !== 'object' || Array.isArray(record)) {
                    throw new Error('The backup contains an invalid transaction.');
                }
                const { type, title, amount, category, paymentMethod, date, notes = '' } = record;
                if (!['Income', 'Expense', 'Savings'].includes(type)
                    || typeof title !== 'string' || !title.trim() || title.length > 200
                    || typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0
                    || typeof category !== 'string' || !category.trim() || category.length > 100
                    || typeof paymentMethod !== 'string' || !paymentMethod.trim() || paymentMethod.length > 100
                    || !isValidDate(date)
                    || typeof notes !== 'string' || notes.length > 1000) {
                    throw new Error('The backup contains a transaction with invalid or missing fields.');
                }
                let id = typeof record.id === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(record.id)
                    ? record.id
                    : userTransactionsCollection().doc().id;
                if (ids.has(id)) id = userTransactionsCollection().doc().id;
                ids.add(id);
                return { id, type, title: title.trim(), amount, category: category.trim(), paymentMethod, date, notes };
            });
        }

        function importDataJSON(event) {
            const file = event.target.files[0];
            if (!file) return;
            const fileInput = event.target;
            const reader = new FileReader();
            reader.onload = function(event) {
                try {
                    pendingImport = normalizeImportedTransactions(JSON.parse(event.target.result));
                    document.getElementById('importConfirmMessage').textContent =
                        `This will replace all ${transactions.length} current transactions with ${pendingImport.length} transactions from the selected backup. This cannot be undone.`;
                    document.getElementById('importConfirmModal').classList.remove('hidden');
                } catch (error) {
                    pendingImport = null;
                    setAppMessage(error.message || 'Could not read the selected JSON backup.');
                } finally {
                    fileInput.value = '';
                }
            };
            reader.onerror = function() {
                setAppMessage('Could not read the selected JSON backup.');
                fileInput.value = '';
            };
            reader.readAsText(file);
        }

        function cancelPendingImport() {
            pendingImport = null;
            document.getElementById('importConfirmModal').classList.add('hidden');
        }

        async function confirmImport() {
            if (!pendingImport) return;
            const imported = pendingImport;
            pendingImport = null;
            document.getElementById('importConfirmModal').classList.add('hidden');
            try {
                const currentSnapshot = await userTransactionsCollection().get();
                const importedIds = new Set(imported.map(item => item.id));
                const operations = [];
                imported.forEach(({ id, ...data }) => {
                    operations.push({ type: 'set', ref: userTransactionsCollection().doc(id), data });
                });
                currentSnapshot.docs.forEach(item => {
                    if (!importedIds.has(item.id)) operations.push({ type: 'delete', ref: item.ref });
                });
                for (let index = 0; index < operations.length; index += 450) {
                    const batch = db.batch();
                    operations.slice(index, index + 450).forEach(operation => {
                        if (operation.type === 'set') batch.set(operation.ref, operation.data);
                        else batch.delete(operation.ref);
                    });
                    await batch.commit();
                }
                categoriesMap = JSON.parse(JSON.stringify(INITIAL_CATEGORIES));
                imported.forEach(item => {
                    if (!categoriesMap[item.type].includes(item.category)) {
                        categoriesMap[item.type].push(item.category);
                    }
                });
                await saveCustomCategories();
                transactions = imported;
                updateCategoryOptions();
                refreshDashboard();
                setAppMessage('Backup imported successfully.', false);
            } catch (error) {
                try {
                    await loadSettings();
                    await loadData();
                    updateCategoryOptions();
                    refreshDashboard();
                } catch (refreshError) {
                    setAppMessage('Import failed, and the current data could not be reloaded. Check your connection before retrying.');
                    return;
                }
                setAppMessage('Import did not complete. Some transactions may have changed; check the current list before retrying.');
            }
        }

        function exportDataCSV() {
            if (transactions.length === 0) return;
            const csvCell = value => {
                let text = String(value ?? '');
                if (/^[\t\r ]*[=+\-@]/.test(text)) text = `'${text}`;
                return `"${text.replace(/"/g, '""')}"`;
            };
            const rows = [
                ['ID', 'Type', 'Title', 'Amount (INR)', 'Category', 'PaymentMethod', 'Date', 'Notes'].map(csvCell).join(','),
                ...transactions.map(item => [
                    item.id, item.type, item.title, item.amount, item.category,
                    item.paymentMethod, item.date, item.notes || ''
                ].map(csvCell).join(','))
            ];
            const encodedUri = `data:text/csv;charset=utf-8,${encodeURIComponent(rows.join('\r\n'))}`;
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", `FinanceFlow_Export_${new Date().toISOString().slice(0,10)}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }

        function escapeHtml(str) {
            if (!str) return '';
            return str.replace(/[&<>"']/g, function(m) {
                return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m];
            });
        }
