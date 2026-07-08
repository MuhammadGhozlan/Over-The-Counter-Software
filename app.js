(function () {
  "use strict";

  const STORAGE_KEY = "finance-planner-state-v1";
  const FILE_STORAGE_ENDPOINT = "api/data";
  const DATA_FILE_NAME = "finance-data.json";
  const FREQUENCIES = [
    "weekly",
    "biweekly",
    "semimonthly",
    "monthly",
    "quarterly",
    "yearly",
    "one-time"
  ];
  const CATEGORY_OPTIONS = [
    "Housing",
    "Utilities",
    "Food",
    "Transportation",
    "Debt",
    "Health",
    "Insurance",
    "Entertainment",
    "Shopping",
    "Subscriptions",
    "Education",
    "Travel",
    "Giving",
    "Savings",
    "Other"
  ];
  const CATEGORY_COLORS = [
    "#0f766e",
    "#1d4ed8",
    "#c2415d",
    "#b7791f",
    "#16803c",
    "#7c3aed",
    "#dc2626",
    "#0891b2",
    "#ea580c",
    "#475569",
    "#65a30d",
    "#be123c",
    "#0369a1",
    "#a16207",
    "#52525b"
  ];

  const DEFAULT_STATE = {
    profile: {
      name: "Household",
      currency: "USD",
      startingSavings: 1800,
      monthStartDay: 1,
      planningStyle: "balanced"
    },
    theme: "light",
    incomes: [
      { id: "income-salary", name: "Primary salary", amount: 2400, frequency: "semimonthly", type: "Wage" },
      { id: "income-side", name: "Weekend freelance", amount: 350, frequency: "monthly", type: "Side income" }
    ],
    expenses: [
      { id: "expense-rent", name: "Rent", amount: 1650, frequency: "monthly", category: "Housing", dueDay: 1, priority: "essential", notes: "" },
      { id: "expense-utilities", name: "Utilities", amount: 190, frequency: "monthly", category: "Utilities", dueDay: 7, priority: "essential", notes: "" },
      { id: "expense-groceries", name: "Groceries", amount: 165, frequency: "weekly", category: "Food", dueDay: 5, priority: "flexible", notes: "Includes household supplies" },
      { id: "expense-car", name: "Car payment", amount: 420, frequency: "monthly", category: "Transportation", dueDay: 14, priority: "essential", notes: "" },
      { id: "expense-insurance", name: "Insurance", amount: 155, frequency: "monthly", category: "Insurance", dueDay: 18, priority: "essential", notes: "" },
      { id: "expense-streaming", name: "Streaming subscriptions", amount: 62, frequency: "monthly", category: "Subscriptions", dueDay: 11, priority: "optional", notes: "Review bundle overlap" },
      { id: "expense-dining", name: "Dining out", amount: 120, frequency: "weekly", category: "Entertainment", dueDay: 6, priority: "optional", notes: "" },
      { id: "expense-shopping", name: "Personal shopping", amount: 300, frequency: "monthly", category: "Shopping", dueDay: 20, priority: "optional", notes: "" }
    ],
    goals: [
      { id: "goal-emergency", name: "Emergency fund", target: 6000, current: 1800, deadline: endOfYear(), type: "year" },
      { id: "goal-trip", name: "Holiday travel", target: 1200, current: 250, deadline: endOfMonth(), type: "month" }
    ]
  };

  let state = loadState();
  let toastTimer = null;
  let storageMode = "browser";
  let fileSaveTimer = null;

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    populateSelects();
    bindNavigation();
    bindForms();
    bindActions();
    bindSimulator();
    applyTheme();
    render();
    await hydrateFromFileStorage();
    registerServiceWorker();
  }

  function loadState() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        return structuredCloneSafe(DEFAULT_STATE);
      }
      return normalizeState(JSON.parse(stored));
    } catch (error) {
      console.warn("Unable to load saved finance data.", error);
      return structuredCloneSafe(DEFAULT_STATE);
    }
  }

  function normalizeState(input) {
    const base = structuredCloneSafe(DEFAULT_STATE);
    const next = {
      ...base,
      ...input,
      profile: { ...base.profile, ...(input.profile || {}) },
      incomes: Array.isArray(input.incomes) ? input.incomes : base.incomes,
      expenses: Array.isArray(input.expenses) ? input.expenses : base.expenses,
      goals: Array.isArray(input.goals) ? input.goals : base.goals
    };
    next.theme = next.theme === "dark" ? "dark" : "light";
    return next;
  }

  function structuredCloneSafe(value) {
    if (typeof structuredClone === "function") {
      return structuredClone(value);
    }
    return JSON.parse(JSON.stringify(value));
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    if (storageMode === "file") {
      scheduleFileSave();
      return;
    }
    updateStorageStatus("Saved in browser only");
  }

  async function hydrateFromFileStorage() {
    if (!canUseFileStorage()) {
      updateStorageStatus("Saved in browser only");
      return;
    }

    updateStorageStatus(`Checking ${DATA_FILE_NAME}`);
    try {
      const response = await fetch(FILE_STORAGE_ENDPOINT, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`Data file check failed with status ${response.status}.`);
      }
      const payload = await response.json();
      storageMode = "file";

      if (payload.exists && payload.data) {
        state = normalizeState(payload.data);
        applyTheme();
        render();
        showToast(`Loaded ${DATA_FILE_NAME}.`);
        return;
      }

      render();
      showToast(`${DATA_FILE_NAME} will be created for saved data.`);
    } catch (error) {
      console.warn("File-backed storage is unavailable.", error);
      storageMode = "browser";
      updateStorageStatus("Saved in browser only");
    }
  }

  function canUseFileStorage() {
    return location.protocol === "http:" &&
      ["localhost", "127.0.0.1", "::1"].includes(location.hostname);
  }

  function scheduleFileSave() {
    clearTimeout(fileSaveTimer);
    updateStorageStatus(`Saving to ${DATA_FILE_NAME}`);
    fileSaveTimer = setTimeout(saveStateToFile, 250);
  }

  async function saveStateToFile() {
    try {
      const response = await fetch(FILE_STORAGE_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(state)
      });
      if (!response.ok) {
        throw new Error(`File save failed with status ${response.status}.`);
      }
      updateStorageStatus(`Saved to ${DATA_FILE_NAME}`);
    } catch (error) {
      console.warn("Unable to save finance data file.", error);
      updateStorageStatus("File save failed. Browser copy saved.");
    }
  }

  function updateStorageStatus(message) {
    const status = $("#saveStatus");
    if (status) {
      status.textContent = message;
    }
    const detail = $("#storageDetail");
    if (!detail) return;
    if (storageMode === "file") {
      detail.textContent = `Automatic save file: ${DATA_FILE_NAME} in this Finance Application folder. JSON is used so every setting, income, expense, and goal is preserved.`;
    } else {
      detail.textContent = `Direct browser mode: data is saved in this browser only. Use launch.bat for automatic ${DATA_FILE_NAME} file storage.`;
    }
  }

  function render() {
    $("#todayLabel").textContent = new Intl.DateTimeFormat(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric"
    }).format(new Date());

    syncSettingsForm();
    renderSummary();
    renderIncomeTable();
    renderExpenseTable();
    renderGoals();
    renderPlan();
    renderSimulator();
    renderReport();
    window.requestAnimationFrame(drawCharts);
    saveState();
  }

  function populateSelects() {
    fillOptions("#incomeFrequency", FREQUENCIES, titleCase);
    fillOptions("#expenseFrequency", FREQUENCIES, titleCase);
    fillOptions("#expenseCategory", CATEGORY_OPTIONS, (item) => item);
    fillOptions("#expenseFilter", ["All", ...CATEGORY_OPTIONS], (item) => item);
  }

  function fillOptions(selector, values, labeler) {
    const target = $(selector);
    target.innerHTML = values
      .map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(labeler(value))}</option>`)
      .join("");
  }

  function bindNavigation() {
    $$(".nav-item").forEach((button) => {
      button.addEventListener("click", () => setView(button.dataset.viewTarget));
    });
  }

  function setView(viewName) {
    $$(".nav-item").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.viewTarget === viewName);
    });
    $$(".view").forEach((view) => {
      view.classList.toggle("is-active", view.dataset.view === viewName);
    });
    $("#pageTitle").textContent = getViewTitle(viewName);
    if (viewName === "expenses") {
      $("#expenseName").focus();
    }
    if (viewName === "income") {
      $("#incomeName").focus();
    }
    window.requestAnimationFrame(drawCharts);
  }

  function getViewTitle(viewName) {
    const titles = {
      dashboard: "Dashboard",
      income: "Money In",
      expenses: "Expenses",
      goals: "Savings Goals",
      plan: "Monthly Plan",
      simulator: "What-if Lab",
      reports: "Reports",
      settings: "Settings"
    };
    return titles[viewName] || "Finance Planner";
  }

  function bindForms() {
    $("#incomeForm").addEventListener("submit", handleIncomeSubmit);
    $("#expenseForm").addEventListener("submit", handleExpenseSubmit);
    $("#goalForm").addEventListener("submit", handleGoalSubmit);
    $("#settingsForm").addEventListener("submit", handleSettingsSubmit);
    $("#incomeCancel").addEventListener("click", resetIncomeForm);
    $("#expenseCancel").addEventListener("click", resetExpenseForm);
    $("#goalCancel").addEventListener("click", resetGoalForm);
    $("#expenseFilter").addEventListener("change", renderExpenseTable);
    $("#expenseSort").addEventListener("change", renderExpenseTable);
  }

  function bindActions() {
    $("#quickAddExpense").addEventListener("click", () => setView("expenses"));
    $("#themeToggle").addEventListener("click", () => {
      state.theme = state.theme === "dark" ? "light" : "dark";
      applyTheme();
      render();
      showToast(`Theme set to ${state.theme}.`);
    });
    $("#printPlan").addEventListener("click", () => window.print());
    $("#printReport").addEventListener("click", () => window.print());
    $("#exportData").addEventListener("click", exportData);
    $("#exportCsv").addEventListener("click", exportCsv);
    $("#importData").addEventListener("click", () => $("#importFile").click());
    $("#importFile").addEventListener("change", importData);
    $("#resetSample").addEventListener("click", () => {
      if (window.confirm("Reload the sample finance data? This replaces your current entries.")) {
        state = structuredCloneSafe(DEFAULT_STATE);
        applyTheme();
        render();
        showToast("Sample data loaded.");
      }
    });
    $("#clearData").addEventListener("click", () => {
      if (window.confirm("Clear all finance data from this browser?")) {
        state = normalizeState({ incomes: [], expenses: [], goals: [], profile: state.profile, theme: state.theme });
        render();
        showToast("All finance data cleared.");
      }
    });
  }

  function bindSimulator() {
    ["simFood", "simSubscriptions", "simShopping", "simEntertainment", "simSideIncome", "simRaise"].forEach((id) => {
      $(`#${id}`).addEventListener("input", renderSimulator);
    });
  }

  function applyTheme() {
    document.documentElement.dataset.theme = state.theme;
  }

  function handleIncomeSubmit(event) {
    event.preventDefault();
    const id = $("#incomeId").value || uid("income");
    const entry = {
      id,
      name: $("#incomeName").value.trim(),
      amount: numberValue("#incomeAmount"),
      frequency: $("#incomeFrequency").value,
      type: $("#incomeType").value
    };
    upsertById(state.incomes, entry);
    resetIncomeForm();
    render();
    showToast("Income saved.");
  }

  function handleExpenseSubmit(event) {
    event.preventDefault();
    const id = $("#expenseId").value || uid("expense");
    const entry = {
      id,
      name: $("#expenseName").value.trim(),
      amount: numberValue("#expenseAmount"),
      frequency: $("#expenseFrequency").value,
      category: $("#expenseCategory").value,
      dueDay: numberValue("#expenseDueDay") || "",
      priority: $("#expensePriority").value,
      notes: $("#expenseNotes").value.trim()
    };
    upsertById(state.expenses, entry);
    resetExpenseForm();
    render();
    showToast("Expense saved and plan updated.");
  }

  function handleGoalSubmit(event) {
    event.preventDefault();
    const id = $("#goalId").value || uid("goal");
    const entry = {
      id,
      name: $("#goalName").value.trim(),
      target: numberValue("#goalTarget"),
      current: numberValue("#goalCurrent"),
      deadline: $("#goalDeadline").value,
      type: $("#goalType").value
    };
    upsertById(state.goals, entry);
    resetGoalForm();
    render();
    showToast("Savings goal saved.");
  }

  function handleSettingsSubmit(event) {
    event.preventDefault();
    state.profile = {
      ...state.profile,
      name: $("#profileName").value.trim() || "Household",
      currency: $("#profileCurrency").value,
      startingSavings: numberValue("#profileStartingSavings"),
      monthStartDay: Math.min(28, Math.max(1, numberValue("#profileMonthStart") || 1)),
      planningStyle: $("#profileStyle").value
    };
    render();
    showToast("Settings saved.");
  }

  function upsertById(collection, item) {
    const index = collection.findIndex((entry) => entry.id === item.id);
    if (index >= 0) {
      collection[index] = item;
    } else {
      collection.push(item);
    }
  }

  function resetIncomeForm() {
    $("#incomeForm").reset();
    $("#incomeId").value = "";
    $("#incomeSubmit").textContent = "Save income";
  }

  function resetExpenseForm() {
    $("#expenseForm").reset();
    $("#expenseId").value = "";
    $("#expenseSubmit").textContent = "Save expense";
  }

  function resetGoalForm() {
    $("#goalForm").reset();
    $("#goalId").value = "";
    $("#goalSubmit").textContent = "Save goal";
  }

  function syncSettingsForm() {
    $("#profileName").value = state.profile.name || "";
    $("#profileCurrency").value = state.profile.currency || "USD";
    $("#profileStartingSavings").value = state.profile.startingSavings || 0;
    $("#profileMonthStart").value = state.profile.monthStartDay || 1;
    $("#profileStyle").value = state.profile.planningStyle || "balanced";
  }

  function renderSummary() {
    const totals = getTotals();
    const gap = totals.requiredSavings - totals.availableSavings;
    const dailyAllowance = Math.max(0, (totals.monthlyIncome - totals.monthlyExpenses - totals.requiredSavings) / daysRemainingInPlanningMonth());
    const summary = [
      {
        label: "Monthly income",
        value: money(totals.monthlyIncome),
        note: `${state.incomes.length} income stream${state.incomes.length === 1 ? "" : "s"} tracked`,
        mood: "good"
      },
      {
        label: "Monthly expenses",
        value: money(totals.monthlyExpenses),
        note: `${money(totals.optionalExpenses)} optional or flexible spending`,
        mood: totals.monthlyExpenses > totals.monthlyIncome ? "danger" : "warn"
      },
      {
        label: "Goal savings needed",
        value: money(totals.requiredSavings),
        note: `${state.goals.length} active goal${state.goals.length === 1 ? "" : "s"}`,
        mood: gap <= 0 ? "good" : "warn"
      },
      {
        label: "Daily safe spend",
        value: money(dailyAllowance),
        note: gap <= 0 ? "After bills and goal savings" : `${money(gap)} monthly gap to close`,
        mood: gap <= 0 ? "good" : "danger"
      }
    ];

    $("#summaryGrid").innerHTML = summary
      .map((item) => `
        <article class="metric ${item.mood}">
          <span class="label">${escapeHtml(item.label)}</span>
          <strong class="value">${escapeHtml(item.value)}</strong>
          <span class="note">${escapeHtml(item.note)}</span>
        </article>
      `)
      .join("");

    renderAutopilot(totals);
    renderActionQueue(totals);
  }

  function renderAutopilot(totals) {
    const dot = $("#autopilotDot");
    const gap = totals.requiredSavings - totals.availableSavings;
    let status = "On track";
    let mood = "good";
    if (gap > 0) {
      status = "Needs cuts";
      mood = "danger";
    } else if (totals.savingsRate < 0.1) {
      status = "Thin margin";
      mood = "warn";
    }
    dot.textContent = status;
    dot.className = `status-dot ${mood}`;

    const reached = totals.requiredSavings > 0
      ? clamp((totals.availableSavings / totals.requiredSavings) * 100, 0, 140)
      : 100;
    $("#autopilotPanel").innerHTML = `
      <div class="info-row">
        <div>
          <strong>Monthly savings capacity</strong>
          <span>${escapeHtml(money(totals.availableSavings))} available after recorded expenses.</span>
        </div>
        <span class="tag ${mood}">${Math.round(reached)}%</span>
      </div>
      <div class="info-row">
        <div>
          <strong>Savings rate</strong>
          <span>${formatPercent(totals.savingsRate)} of income is left for savings or debt acceleration.</span>
        </div>
        <span class="tag">${escapeHtml(state.profile.planningStyle)}</span>
      </div>
      <div class="progress-bar" aria-hidden="true"><span style="width:${Math.min(reached, 100)}%"></span></div>
    `;
  }

  function renderActionQueue(totals) {
    const plan = buildPlan(totals);
    const actions = [];
    if (totals.monthlyIncome <= 0) {
      actions.push({
        title: "Add wages or income",
        body: "Start by recording salary, hourly wages, benefits, freelance income, or any recurring money coming in."
      });
    }
    if (totals.requiredSavings > totals.availableSavings) {
      actions.push({
        title: `Close a ${money(totals.requiredSavings - totals.availableSavings)} monthly gap`,
        body: "Use category caps and the cut list to free the exact amount needed for your current goals."
      });
    }
    if (plan.cutCandidates.length > 0) {
      const first = plan.cutCandidates[0];
      actions.push({
        title: `Review ${first.name}`,
        body: `${first.category} costs ${money(first.monthly)} monthly and is marked ${first.priority}.`
      });
    }
    const closestGoal = getGoalsWithMath().sort((a, b) => a.monthsRemaining - b.monthsRemaining)[0];
    if (closestGoal) {
      actions.push({
        title: `Protect ${closestGoal.name}`,
        body: `Set aside ${money(closestGoal.requiredMonthly)} per month to hit the ${formatDate(closestGoal.deadline)} deadline.`
      });
    }
    if (actions.length === 0) {
      actions.push({
        title: "Plan is healthy",
        body: "Your current entries leave room for all savings targets. Keep expenses updated as bills change."
      });
    }
    $("#actionQueue").innerHTML = actions
      .slice(0, 4)
      .map((action) => `
        <div class="action-item">
          <strong>${escapeHtml(action.title)}</strong>
          <span>${escapeHtml(action.body)}</span>
        </div>
      `)
      .join("");
  }

  function renderIncomeTable() {
    const table = $("#incomeTable");
    if (state.incomes.length === 0) {
      table.innerHTML = `<tr><td colspan="5"><div class="empty-state">No income added yet.</div></td></tr>`;
      return;
    }
    table.innerHTML = state.incomes
      .map((item) => `
        <tr>
          <td><strong>${escapeHtml(item.name)}</strong></td>
          <td>${escapeHtml(item.type || "Other")}</td>
          <td>${escapeHtml(titleCase(item.frequency))}</td>
          <td class="numeric">${escapeHtml(money(toMonthly(item.amount, item.frequency)))}</td>
          <td class="row-actions">
            <span class="mini-actions">
              <button type="button" title="Edit income" aria-label="Edit income" data-edit-income="${escapeHtml(item.id)}">E</button>
              <button type="button" title="Delete income" aria-label="Delete income" data-delete-income="${escapeHtml(item.id)}">X</button>
            </span>
          </td>
        </tr>
      `)
      .join("");
    table.querySelectorAll("[data-edit-income]").forEach((button) => {
      button.addEventListener("click", () => editIncome(button.dataset.editIncome));
    });
    table.querySelectorAll("[data-delete-income]").forEach((button) => {
      button.addEventListener("click", () => deleteItem("incomes", button.dataset.deleteIncome));
    });
  }

  function renderExpenseTable() {
    const filter = $("#expenseFilter").value || "All";
    const sort = $("#expenseSort").value || "largest";
    let expenses = [...state.expenses];
    if (filter !== "All") {
      expenses = expenses.filter((expense) => expense.category === filter);
    }
    expenses.sort((a, b) => {
      if (sort === "category") {
        return a.category.localeCompare(b.category) || a.name.localeCompare(b.name);
      }
      if (sort === "due") {
        return (a.dueDay || 99) - (b.dueDay || 99);
      }
      if (sort === "priority") {
        return priorityRank(a.priority) - priorityRank(b.priority);
      }
      return toMonthly(b.amount, b.frequency) - toMonthly(a.amount, a.frequency);
    });

    const table = $("#expenseTable");
    if (expenses.length === 0) {
      table.innerHTML = `<tr><td colspan="5"><div class="empty-state">No expenses match this view.</div></td></tr>`;
      return;
    }
    table.innerHTML = expenses
      .map((item) => {
        const mood = item.priority === "essential" ? "" : item.priority === "flexible" ? "warn" : "danger";
        return `
          <tr>
            <td><strong>${escapeHtml(item.name)}</strong></td>
            <td>${escapeHtml(item.category)}</td>
            <td><span class="tag ${mood}">${escapeHtml(titleCase(item.priority))}</span></td>
            <td class="numeric">${escapeHtml(money(toMonthly(item.amount, item.frequency)))}</td>
            <td class="row-actions">
              <span class="mini-actions">
                <button type="button" title="Edit expense" aria-label="Edit expense" data-edit-expense="${escapeHtml(item.id)}">E</button>
                <button type="button" title="Delete expense" aria-label="Delete expense" data-delete-expense="${escapeHtml(item.id)}">X</button>
              </span>
            </td>
          </tr>
        `;
      })
      .join("");
    table.querySelectorAll("[data-edit-expense]").forEach((button) => {
      button.addEventListener("click", () => editExpense(button.dataset.editExpense));
    });
    table.querySelectorAll("[data-delete-expense]").forEach((button) => {
      button.addEventListener("click", () => deleteItem("expenses", button.dataset.deleteExpense));
    });
  }

  function renderGoals() {
    const goals = getGoalsWithMath();
    if (goals.length === 0) {
      $("#goalList").innerHTML = `<div class="empty-state">No savings goals yet. Add a monthly or yearly target to generate a plan.</div>`;
      return;
    }
    $("#goalList").innerHTML = goals
      .map((goal) => {
        const progress = goal.target > 0 ? clamp((goal.current / goal.target) * 100, 0, 100) : 0;
        const status = goal.remaining <= 0 ? "Funded" : `${money(goal.requiredMonthly)} / month`;
        return `
          <article class="goal-item">
            <div class="goal-topline">
              <div>
                <strong>${escapeHtml(goal.name)}</strong>
                <span>${escapeHtml(money(goal.current))} saved of ${escapeHtml(money(goal.target))} by ${escapeHtml(formatDate(goal.deadline))}</span>
              </div>
              <span class="tag ${goal.remaining <= 0 ? "good" : ""}">${escapeHtml(status)}</span>
            </div>
            <div class="progress-bar" aria-hidden="true"><span style="width:${progress}%"></span></div>
            <div class="row-toolbox">
              <button class="ghost-button" type="button" data-edit-goal="${escapeHtml(goal.id)}">Edit</button>
              <button class="danger-button" type="button" data-delete-goal="${escapeHtml(goal.id)}">Delete</button>
            </div>
          </article>
        `;
      })
      .join("");
    $("#goalList").querySelectorAll("[data-edit-goal]").forEach((button) => {
      button.addEventListener("click", () => editGoal(button.dataset.editGoal));
    });
    $("#goalList").querySelectorAll("[data-delete-goal]").forEach((button) => {
      button.addEventListener("click", () => deleteItem("goals", button.dataset.deleteGoal));
    });
  }

  function renderPlan() {
    const totals = getTotals();
    const plan = buildPlan(totals);
    const gap = Math.max(0, totals.requiredSavings - totals.availableSavings);
    const tone = gap > 0 ? "danger" : totals.savingsRate < 0.1 ? "warn" : "good";
    const headline = gap > 0
      ? `Reduce spending or add income by ${money(gap)} each month.`
      : `You have ${money(Math.abs(gap))} extra cushion after goal savings.`;

    $("#planSummary").innerHTML = `
      <div class="plan-item">
        <strong>${escapeHtml(headline)}</strong>
        <span>Income: ${escapeHtml(money(totals.monthlyIncome))}. Expenses: ${escapeHtml(money(totals.monthlyExpenses))}. Required goal savings: ${escapeHtml(money(totals.requiredSavings))}.</span>
      </div>
      <div class="plan-item">
        <strong>Envelope rule for this month</strong>
        <span>Pay essential bills first, move ${escapeHtml(money(totals.requiredSavings))} into savings, then spend no more than ${escapeHtml(money(plan.flexAllowance))} on flexible categories.</span>
      </div>
      <div class="plan-item">
        <strong>Plan status</strong>
        <span><span class="tag ${tone}">${gap > 0 ? "Needs adjustment" : "On track"}</span></span>
      </div>
    `;

    $("#categoryCaps").innerHTML = plan.categoryCaps.length
      ? plan.categoryCaps
        .map((item) => `
          <tr>
            <td>${escapeHtml(item.category)}</td>
            <td class="numeric">${escapeHtml(money(item.current))}</td>
            <td class="numeric">${escapeHtml(money(item.recommended))}</td>
            <td class="numeric">${escapeHtml(money(item.recommended / 4.345))}</td>
          </tr>
        `)
        .join("")
      : `<tr><td colspan="4"><div class="empty-state">Add expenses to generate category caps.</div></td></tr>`;

    $("#cutList").innerHTML = plan.cutCandidates.length
      ? plan.cutCandidates
        .slice(0, 6)
        .map((item) => `
          <div class="action-item">
            <strong>${escapeHtml(item.name)}: ${escapeHtml(money(item.suggestedCut))} potential cut</strong>
            <span>${escapeHtml(item.category)} is ${escapeHtml(item.priority)} and costs ${escapeHtml(money(item.monthly))} per month. ${escapeHtml(item.note)}</span>
          </div>
        `)
        .join("")
      : `<div class="empty-state">No flexible or optional expenses are available for a cut list.</div>`;
  }

  function renderSimulator() {
    const totals = getTotals();
    const values = {
      food: numberValue("#simFood"),
      subscriptions: numberValue("#simSubscriptions"),
      shopping: numberValue("#simShopping"),
      entertainment: numberValue("#simEntertainment"),
      sideIncome: numberValue("#simSideIncome"),
      raise: numberValue("#simRaise")
    };
    $("#simFoodLabel").textContent = `${values.food}%`;
    $("#simSubscriptionsLabel").textContent = `${values.subscriptions}%`;
    $("#simShoppingLabel").textContent = `${values.shopping}%`;
    $("#simEntertainmentLabel").textContent = `${values.entertainment}%`;
    $("#simSideIncomeLabel").textContent = money(values.sideIncome);
    $("#simRaiseLabel").textContent = `${values.raise}%`;

    const cuts =
      categoryMonthly("Food") * values.food / 100 +
      categoryMonthly("Subscriptions") * values.subscriptions / 100 +
      categoryMonthly("Shopping") * values.shopping / 100 +
      categoryMonthly("Entertainment") * values.entertainment / 100;
    const raiseIncome = totals.monthlyIncome * values.raise / 100;
    const improvement = cuts + values.sideIncome + raiseIncome;
    const newAvailable = totals.availableSavings + improvement;
    const required = totals.requiredSavings;
    const goalsTotalRemaining = getGoalsWithMath().reduce((sum, goal) => sum + goal.remaining, 0);
    const currentMonths = monthsToFund(goalsTotalRemaining, Math.max(0, totals.availableSavings));
    const scenarioMonths = monthsToFund(goalsTotalRemaining, Math.max(0, newAvailable));
    const monthsSaved = currentMonths === Infinity || scenarioMonths === Infinity
      ? 0
      : Math.max(0, currentMonths - scenarioMonths);

    $("#simulatorResult").innerHTML = `
      <div class="scenario-card">
        <strong>Monthly improvement</strong>
        <div class="value">${escapeHtml(money(improvement))}</div>
        <span>From cuts, new income, and wage growth.</span>
      </div>
      <div class="scenario-card">
        <strong>New savings capacity</strong>
        <div class="value">${escapeHtml(money(newAvailable))}</div>
        <span>${newAvailable >= required ? "Enough for current goals." : `${money(required - newAvailable)} still needed.`}</span>
      </div>
      <div class="scenario-card">
        <strong>Goal speed-up</strong>
        <div class="value">${escapeHtml(monthsSaved ? `${monthsSaved} mo` : "0 mo")}</div>
        <span>Estimated time saved across unfunded goals.</span>
      </div>
      <div class="scenario-card">
        <strong>Annual upside</strong>
        <div class="value">${escapeHtml(money(improvement * 12))}</div>
        <span>Potential additional savings over 12 months.</span>
      </div>
    `;
  }

  function renderReport() {
    const totals = getTotals();
    const plan = buildPlan(totals);
    const topCategories = getCategoryTotals()
      .slice(0, 4)
      .map((item) => `<li>${escapeHtml(item.category)}: ${escapeHtml(money(item.total))}</li>`)
      .join("");
    const goalLines = getGoalsWithMath()
      .slice(0, 4)
      .map((goal) => `<li>${escapeHtml(goal.name)} needs ${escapeHtml(money(goal.requiredMonthly))} monthly until ${escapeHtml(formatDate(goal.deadline))}.</li>`)
      .join("");
    const cuts = plan.cutCandidates
      .slice(0, 4)
      .map((item) => `<li>Reduce ${escapeHtml(item.name)} by up to ${escapeHtml(money(item.suggestedCut))}.</li>`)
      .join("");

    $("#reportDocument").innerHTML = `
      <section>
        <h4>${escapeHtml(state.profile.name || "Household")} monthly finance brief</h4>
        <p>Generated ${escapeHtml(new Date().toLocaleDateString())}. This report uses the entries currently saved in the app.</p>
      </section>
      <section>
        <h4>Cash position</h4>
        <p>Monthly income is ${escapeHtml(money(totals.monthlyIncome))}, monthly expenses are ${escapeHtml(money(totals.monthlyExpenses))}, and goal savings require ${escapeHtml(money(totals.requiredSavings))} per month.</p>
      </section>
      <section>
        <h4>Largest categories</h4>
        <ul>${topCategories || "<li>No expenses entered.</li>"}</ul>
      </section>
      <section>
        <h4>Savings goals</h4>
        <ul>${goalLines || "<li>No savings goals entered.</li>"}</ul>
      </section>
      <section>
        <h4>Recommended actions</h4>
        <ul>${cuts || "<li>No optional cuts are currently identified.</li>"}</ul>
      </section>
    `;
  }

  function editIncome(id) {
    const item = state.incomes.find((entry) => entry.id === id);
    if (!item) return;
    $("#incomeId").value = item.id;
    $("#incomeName").value = item.name;
    $("#incomeAmount").value = item.amount;
    $("#incomeFrequency").value = item.frequency;
    $("#incomeType").value = item.type || "Other";
    $("#incomeSubmit").textContent = "Update income";
    setView("income");
  }

  function editExpense(id) {
    const item = state.expenses.find((entry) => entry.id === id);
    if (!item) return;
    $("#expenseId").value = item.id;
    $("#expenseName").value = item.name;
    $("#expenseAmount").value = item.amount;
    $("#expenseFrequency").value = item.frequency;
    $("#expenseCategory").value = item.category;
    $("#expenseDueDay").value = item.dueDay || "";
    $("#expensePriority").value = item.priority;
    $("#expenseNotes").value = item.notes || "";
    $("#expenseSubmit").textContent = "Update expense";
    setView("expenses");
  }

  function editGoal(id) {
    const item = state.goals.find((entry) => entry.id === id);
    if (!item) return;
    $("#goalId").value = item.id;
    $("#goalName").value = item.name;
    $("#goalTarget").value = item.target;
    $("#goalCurrent").value = item.current;
    $("#goalDeadline").value = item.deadline;
    $("#goalType").value = item.type || "custom";
    $("#goalSubmit").textContent = "Update goal";
    setView("goals");
  }

  function deleteItem(collectionName, id) {
    if (!window.confirm("Delete this entry?")) return;
    state[collectionName] = state[collectionName].filter((entry) => entry.id !== id);
    render();
    showToast("Entry deleted.");
  }

  function exportData() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `finance-planner-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast("Finance data exported.");
  }

  function exportCsv() {
    const rows = [
      ["section", "name", "amount", "frequency", "type_or_category", "due_day", "priority", "target", "current", "deadline", "notes"]
    ];

    state.incomes.forEach((item) => {
      rows.push(["income", item.name, item.amount, item.frequency, item.type || "", "", "", "", "", "", ""]);
    });
    state.expenses.forEach((item) => {
      rows.push(["expense", item.name, item.amount, item.frequency, item.category, item.dueDay || "", item.priority || "", "", "", "", item.notes || ""]);
    });
    state.goals.forEach((item) => {
      rows.push(["goal", item.name, "", "", item.type || "", "", "", item.target, item.current, item.deadline, ""]);
    });

    const csv = rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `finance-planner-tables-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast("CSV tables exported.");
  }

  function importData(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = JSON.parse(String(reader.result));
        state = normalizeState(imported);
        applyTheme();
        render();
        showToast("Finance data imported.");
      } catch (error) {
        showToast("Import failed. Choose a valid finance planner JSON file.");
      } finally {
        event.target.value = "";
      }
    };
    reader.readAsText(file);
  }

  function getTotals() {
    const monthlyIncome = state.incomes.reduce((sum, item) => sum + toMonthly(item.amount, item.frequency), 0);
    const monthlyExpenses = state.expenses.reduce((sum, item) => sum + toMonthly(item.amount, item.frequency), 0);
    const essentialExpenses = state.expenses
      .filter((item) => item.priority === "essential")
      .reduce((sum, item) => sum + toMonthly(item.amount, item.frequency), 0);
    const optionalExpenses = state.expenses
      .filter((item) => item.priority !== "essential")
      .reduce((sum, item) => sum + toMonthly(item.amount, item.frequency), 0);
    const requiredSavings = getGoalsWithMath().reduce((sum, goal) => sum + goal.requiredMonthly, 0);
    const availableSavings = monthlyIncome - monthlyExpenses;
    return {
      monthlyIncome,
      monthlyExpenses,
      essentialExpenses,
      optionalExpenses,
      requiredSavings,
      availableSavings,
      savingsRate: monthlyIncome > 0 ? availableSavings / monthlyIncome : 0
    };
  }

  function buildPlan(totals) {
    const categoryTotals = getCategoryTotals();
    const gap = Math.max(0, totals.requiredSavings - totals.availableSavings);
    const style = state.profile.planningStyle || "balanced";
    const styleMultiplier = style === "aggressive" ? 1.15 : style === "comfort" ? 0.75 : 1;
    const flexibleTotal = categoryTotals
      .filter((item) => item.flexible > 0)
      .reduce((sum, item) => sum + item.flexible, 0);

    const categoryCaps = categoryTotals.map((item) => {
      const share = flexibleTotal > 0 ? item.flexible / flexibleTotal : 0;
      const reduction = Math.min(item.flexible, gap * share * styleMultiplier);
      return {
        category: item.category,
        current: item.total,
        recommended: Math.max(0, item.total - reduction)
      };
    });

    const cutCandidates = state.expenses
      .map((item) => ({
        ...item,
        monthly: toMonthly(item.amount, item.frequency)
      }))
      .filter((item) => item.priority !== "essential" && item.monthly > 0)
      .sort((a, b) => {
        const priorityBoost = priorityRank(b.priority) - priorityRank(a.priority);
        return priorityBoost || b.monthly - a.monthly;
      })
      .map((item) => ({
        ...item,
        suggestedCut: item.priority === "optional" ? item.monthly : item.monthly * 0.25,
        note: item.priority === "optional"
          ? "Pause, cancel, or replace this first."
          : "Try a lower-cost version or a usage limit."
      }));

    return {
      gap,
      flexAllowance: Math.max(0, totals.monthlyIncome - totals.essentialExpenses - totals.requiredSavings),
      categoryCaps,
      cutCandidates
    };
  }

  function getGoalsWithMath() {
    return state.goals.map((goal) => {
      const target = Number(goal.target) || 0;
      const current = Number(goal.current) || 0;
      const remaining = Math.max(0, target - current);
      const monthsRemaining = monthsUntil(goal.deadline);
      const requiredMonthly = monthsRemaining > 0 ? remaining / monthsRemaining : remaining;
      return {
        ...goal,
        target,
        current,
        remaining,
        monthsRemaining,
        requiredMonthly
      };
    });
  }

  function getCategoryTotals() {
    const map = new Map();
    state.expenses.forEach((expense) => {
      const monthly = toMonthly(expense.amount, expense.frequency);
      const current = map.get(expense.category) || { category: expense.category, total: 0, flexible: 0 };
      current.total += monthly;
      if (expense.priority !== "essential") {
        current.flexible += monthly;
      }
      map.set(expense.category, current);
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }

  function categoryMonthly(category) {
    return state.expenses
      .filter((expense) => expense.category === category)
      .reduce((sum, expense) => sum + toMonthly(expense.amount, expense.frequency), 0);
  }

  function drawCharts() {
    drawCashFlowChart();
    drawCategoryChart();
  }

  function drawCashFlowChart() {
    const canvas = $("#cashFlowChart");
    if (!canvas || !canvas.offsetParent) return;
    const totals = getTotals();
    const values = [
      { label: "Income", value: totals.monthlyIncome, color: "#0f766e" },
      { label: "Expenses", value: totals.monthlyExpenses, color: "#c2415d" },
      { label: "Goals", value: totals.requiredSavings, color: "#1d4ed8" },
      { label: "Left", value: Math.max(0, totals.availableSavings - totals.requiredSavings), color: "#b7791f" }
    ];
    const { ctx, width, height } = prepareCanvas(canvas);
    ctx.clearRect(0, 0, width, height);
    const max = Math.max(1, ...values.map((item) => item.value));
    const chartHeight = height - 54;
    const barWidth = Math.max(28, (width - 70) / values.length - 18);
    values.forEach((item, index) => {
      const x = 40 + index * ((width - 70) / values.length) + 8;
      const barHeight = item.value / max * (chartHeight - 20);
      const y = chartHeight - barHeight + 8;
      ctx.fillStyle = item.color;
      roundedRect(ctx, x, y, barWidth, barHeight, 6);
      ctx.fill();
      ctx.fillStyle = chartTextColor();
      ctx.font = "700 12px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(item.label, x + barWidth / 2, height - 26);
      ctx.font = "600 11px system-ui, sans-serif";
      ctx.fillText(compactMoney(item.value), x + barWidth / 2, height - 10);
    });
  }

  function drawCategoryChart() {
    const canvas = $("#categoryChart");
    if (!canvas || !canvas.offsetParent) return;
    const categories = getCategoryTotals().slice(0, 8);
    const { ctx, width, height } = prepareCanvas(canvas);
    ctx.clearRect(0, 0, width, height);
    const total = categories.reduce((sum, item) => sum + item.total, 0);
    if (total <= 0) {
      ctx.fillStyle = chartTextColor();
      ctx.font = "700 14px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Add expenses to see a category chart", width / 2, height / 2);
      $("#categoryLegend").innerHTML = "";
      return;
    }
    const radius = Math.min(width, height) * 0.34;
    const centerX = width / 2;
    const centerY = height / 2;
    let start = -Math.PI / 2;
    categories.forEach((item, index) => {
      const angle = item.total / total * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, start, start + angle);
      ctx.closePath();
      ctx.fillStyle = CATEGORY_COLORS[index % CATEGORY_COLORS.length];
      ctx.fill();
      start += angle;
    });
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius * 0.58, 0, Math.PI * 2);
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--surface").trim() || "#ffffff";
    ctx.fill();
    ctx.fillStyle = chartTextColor();
    ctx.font = "800 16px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(compactMoney(total), centerX, centerY - 2);
    ctx.font = "600 11px system-ui, sans-serif";
    ctx.fillText("monthly", centerX, centerY + 15);

    $("#categoryLegend").innerHTML = categories
      .map((item, index) => `
        <span class="legend-item">
          <span class="legend-swatch" style="background:${CATEGORY_COLORS[index % CATEGORY_COLORS.length]}"></span>
          ${escapeHtml(item.category)}
        </span>
      `)
      .join("");
  }

  function prepareCanvas(canvas) {
    const rect = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    const width = Math.max(320, rect.width || canvas.clientWidth || 320);
    const height = Math.max(220, rect.height || Number(canvas.getAttribute("height")) || 240);
    canvas.width = Math.floor(width * ratio);
    canvas.height = Math.floor(height * ratio);
    const ctx = canvas.getContext("2d");
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    return { ctx, width, height };
  }

  function roundedRect(ctx, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    ctx.lineTo(x + width, y + height - r);
    ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    ctx.lineTo(x + r, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function chartTextColor() {
    return getComputedStyle(document.documentElement).getPropertyValue("--ink").trim() || "#172322";
  }

  function toMonthly(amount, frequency) {
    const value = Number(amount) || 0;
    switch (frequency) {
      case "weekly": return value * 52 / 12;
      case "biweekly": return value * 26 / 12;
      case "semimonthly": return value * 2;
      case "quarterly": return value / 3;
      case "yearly": return value / 12;
      case "one-time": return value;
      case "monthly":
      default: return value;
    }
  }

  function monthsUntil(dateString) {
    if (!dateString) return 1;
    const today = new Date();
    const target = new Date(`${dateString}T23:59:59`);
    if (Number.isNaN(target.getTime())) return 1;
    const msPerMonth = 1000 * 60 * 60 * 24 * 30.4375;
    return Math.max(1, Math.ceil((target - today) / msPerMonth));
  }

  function monthsToFund(amount, monthlySavings) {
    if (amount <= 0) return 0;
    if (monthlySavings <= 0) return Infinity;
    return Math.ceil(amount / monthlySavings);
  }

  function daysRemainingInPlanningMonth() {
    const now = new Date();
    const startDay = state.profile.monthStartDay || 1;
    const next = new Date(now.getFullYear(), now.getMonth(), startDay);
    if (now.getDate() >= startDay) {
      next.setMonth(next.getMonth() + 1);
    }
    const msPerDay = 1000 * 60 * 60 * 24;
    return Math.max(1, Math.ceil((next - now) / msPerDay));
  }

  function priorityRank(priority) {
    return { essential: 1, flexible: 2, optional: 3 }[priority] || 4;
  }

  function numberValue(selector) {
    const element = $(selector);
    return element ? Number(element.value) || 0 : 0;
  }

  function uid(prefix) {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return `${prefix}-${window.crypto.randomUUID()}`;
    }
    return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  }

  function money(value) {
    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: state.profile.currency || "USD",
        maximumFractionDigits: Math.abs(value) >= 1000 ? 0 : 2
      }).format(Number(value) || 0);
    } catch (error) {
      return `$${(Number(value) || 0).toFixed(2)}`;
    }
  }

  function compactMoney(value) {
    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: state.profile.currency || "USD",
        notation: "compact",
        maximumFractionDigits: 1
      }).format(Number(value) || 0);
    } catch (error) {
      return money(value);
    }
  }

  function formatPercent(value) {
    return `${Math.round((Number(value) || 0) * 100)}%`;
  }

  function formatDate(dateString) {
    if (!dateString) return "No deadline";
    const date = new Date(`${dateString}T00:00:00`);
    if (Number.isNaN(date.getTime())) return "Invalid date";
    return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(date);
  }

  function titleCase(value) {
    return String(value || "")
      .replace(/-/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function csvCell(value) {
    const text = String(value ?? "");
    return `"${text.replace(/"/g, '""')}"`;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function endOfMonth() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
  }

  function endOfYear() {
    const now = new Date();
    return new Date(now.getFullYear(), 11, 31).toISOString().slice(0, 10);
  }

  function showToast(message) {
    const toast = $("#toast");
    toast.textContent = message;
    toast.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 2600);
  }

  function registerServiceWorker() {
    if ("serviceWorker" in navigator && location.protocol !== "file:") {
      navigator.serviceWorker.register("sw.js").catch(() => {
        console.info("Service worker unavailable in this environment.");
      });
    }
  }
})();
