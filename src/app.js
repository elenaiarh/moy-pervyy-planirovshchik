const STORAGE_KEY = "assiya.tasks.v1";
const THEME_KEY = "assiya.theme.v1";
const BACKUP_VERSION = 1;

const palette = {
  bg: "#F5E6D3",
  text: "#2B3A4A",
  muted: "#6B7A8A",
  accent: "#C4A86C",
  work: "#D4B5B0",
  self: "#B5D4C0",
  together: "#C4C7E8",
  personal: "#B5D4C0",
  overdue: "#D4A090",
  air: "#D9D0C4",
};

const categoryMeta = {
  work: {
    label: "Рабочая",
    plural: "Рабочие",
    short: "Работа",
    color: palette.work,
    icon: "briefcase",
  },
  self: {
    label: "Я",
    plural: "Я",
    short: "Я",
    color: palette.self,
    icon: "user",
  },
  together: {
    label: "Мы",
    plural: "Мы",
    short: "Мы",
    color: palette.together,
    icon: "users",
  },
};

const focusMeta = {
  urgentImportant: {
    label: "Важно + Срочно",
    short: "В+С",
    color: "#D4A0A0",
  },
  important: {
    label: "Важно + Не срочно",
    short: "В",
    color: "#D4C89A",
  },
  urgent: {
    label: "Не важно + Срочно",
    short: "С",
    color: "#D4B08A",
  },
  calm: {
    label: "Не важно + Не срочно",
    short: "П",
    color: "#B0B0B0",
  },
};

const initialTasks = [
  {
    id: crypto.randomUUID(),
    title: "Подготовить план проекта для клиента",
    category: "work",
    client: "Анна Смирнова",
    date: todayISO(),
    start: "09:30",
    end: "10:45",
    allDay: false,
    repeat: "none",
    focus: "urgentImportant",
    care: true,
    completedDates: [],
    createdAt: Date.now(),
  },
  {
    id: crypto.randomUUID(),
    title: "Ответить на письма",
    category: "work",
    client: "Студия Север",
    date: todayISO(),
    start: "11:20",
    end: "12:00",
    allDay: false,
    repeat: "weekly",
    focus: "urgent",
    care: true,
    completedDates: [],
    createdAt: Date.now(),
  },
  {
    id: crypto.randomUUID(),
    title: "Прогулка без телефона",
    category: "self",
    date: todayISO(),
    start: "14:30",
    end: "15:10",
    allDay: false,
    repeat: "none",
    focus: "important",
    care: true,
    completedDates: [],
    createdAt: Date.now(),
  },
  {
    id: crypto.randomUUID(),
    title: "Оплатить счета",
    category: "together",
    date: shiftISO(todayISO(), -1),
    start: "18:00",
    end: "18:25",
    allDay: false,
    repeat: "none",
    focus: "urgentImportant",
    care: false,
    completedDates: [],
    createdAt: Date.now() - 86400000,
  },
];

const appState = {
  view: "dashboard",
  selectedDate: todayISO(),
  tasks: loadTasks(),
  modalOpen: false,
  editingId: null,
  editingDate: null,
  reminderPromptId: null,
  overloadDate: null,
  pendingMove: null,
  toast: "",
  activeTab: "day",
  focusFilter: "all",
  clientFilter: "all",
  categoryFilter: "all",
  statusFilter: "all",
  overdueFilter: "all",
  repeatFilter: "all",
  reminderFilter: "all",
  clientSearch: "",
  theme: loadTheme(),
  splashDone: sessionStorage.getItem("assiya.splash.done") === "true",
};

let toastTimer = null;

applyTheme(appState.theme);

function loadTasks() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return initialTasks.map(normalizeTask);

  try {
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed.map(normalizeTask) : initialTasks.map(normalizeTask);
  } catch {
    return initialTasks.map(normalizeTask);
  }
}

function normalizeTask(task) {
  const category = normalizeCategory(task.category);
  const allDay = Boolean(task.allDay);
  const date = isISODate(task.date) ? task.date : todayISO();
  const start = allDay ? "00:00" : normalizeTime(task.start) || "09:00";
  const end = allDay ? "23:59" : normalizeTime(task.end);
  const reminderAt = typeof task.reminderAt === "string" ? task.reminderAt : "";
  const snoozedUntil = typeof task.snoozedUntil === "string" ? task.snoozedUntil : "";

  return {
    id: typeof task.id === "string" && task.id ? task.id : crypto.randomUUID(),
    title: typeof task.title === "string" ? task.title : "",
    category,
    client: category === "work" && typeof task.client === "string" ? task.client : "",
    date,
    start,
    end,
    allDay,
    repeat: ["none", "weekly", "monthly"].includes(task.repeat) ? task.repeat : "none",
    focus: focusMeta[task.focus] ? task.focus : "important",
    care: typeof task.care === "boolean" ? task.care : true,
    reminderAt,
    reminderDone: Boolean(task.reminderDone),
    snoozedUntil,
    completedDates: Array.isArray(task.completedDates) ? task.completedDates.filter(isISODate) : [],
    recurrenceExceptionDates: Array.isArray(task.recurrenceExceptionDates) ? task.recurrenceExceptionDates.filter(isISODate) : [],
    sourceTaskId: typeof task.sourceTaskId === "string" ? task.sourceTaskId : "",
    createdAt: Number.isFinite(task.createdAt) ? task.createdAt : Date.now(),
  };
}

function normalizeCategory(category) {
  if (category === "personal") return "self";
  return categoryMeta[category] ? category : "self";
}

function normalizeTime(value) {
  return typeof value === "string" && /^\d{2}:\d{2}$/.test(value) ? value : "";
}

function isISODate(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function saveTasks() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(appState.tasks));
}

function loadTheme() {
  try {
    return localStorage.getItem(THEME_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

function saveTheme(theme) {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    showToast("Тему не удалось сохранить в этом браузере, но я переключила её на сейчас.");
  }
}

function applyTheme(theme) {
  const normalizedTheme = theme === "dark" ? "dark" : "light";
  document.documentElement.dataset.theme = normalizedTheme;
  document.querySelector("meta[name='theme-color']")?.setAttribute("content", normalizedTheme === "dark" ? "#2B3A4A" : "#F5E6D3");
}

function createBackupPayload(tasks = appState.tasks) {
  return {
    app: "АССИЯ",
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    tasks: tasks.map((task) => normalizeTask(task)),
  };
}

function exportBackup() {
  const payload = createBackupPayload();
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `assiya-backup-${todayISO()}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
  showToast("Резервная копия подготовлена. Файл можно сохранить в надёжное место.");
}

function handleBackupFile(input) {
  const file = input.files?.[0];
  if (!file) return;

  const mode = document.querySelector("[name='backupImportMode']")?.value === "replace" ? "replace" : "merge";
  const reader = new FileReader();

  reader.addEventListener("load", () => {
    importBackupText(String(reader.result || ""), mode);
    input.value = "";
  });

  reader.addEventListener("error", () => {
    input.value = "";
    showToast("Файл не удалось прочитать. Текущие задачи остались на месте.");
  });

  reader.readAsText(file);
}

function importBackupText(text, mode = "merge") {
  const currentTasks = appState.tasks;

  try {
    const parsed = JSON.parse(text);
    const importedTasks = validateBackupPayload(parsed);

    appState.tasks = mode === "replace" ? importedTasks : mergeImportedTasks(currentTasks, importedTasks);
    saveTasks();
    resetFilters();
    appState.modalOpen = false;
    appState.editingId = null;
    appState.editingDate = null;
    showToast(mode === "replace" ? "Резервная копия загружена. Я заменила список задач." : "Резервная копия загружена. Я объединила задачи по id.");
  } catch {
    appState.tasks = currentTasks;
    showToast("Этот JSON не похож на резервную копию АССИИ. Текущие задачи не изменились.");
  }
}

function validateBackupPayload(payload) {
  if (!payload || typeof payload !== "object" || payload.app !== "АССИЯ" || !Array.isArray(payload.tasks)) {
    throw new Error("Invalid backup payload");
  }

  if (!Number.isFinite(payload.version) || payload.version < 1) {
    throw new Error("Unsupported backup version");
  }

  return payload.tasks.map((task) => {
    if (!task || typeof task !== "object" || !String(task.title || "").trim() || !isISODate(task.date)) {
      throw new Error("Invalid task in backup");
    }

    if (task.start && !normalizeTime(task.start)) {
      throw new Error("Invalid task start in backup");
    }

    if (task.end && !normalizeTime(task.end)) {
      throw new Error("Invalid task end in backup");
    }

    const normalizedTask = normalizeTask(task);

    if (!normalizedTask.allDay && normalizedTask.end && timeToMinutes(normalizedTask.end) < timeToMinutes(normalizedTask.start)) {
      throw new Error("Invalid task in backup");
    }

    return normalizedTask;
  });
}

function mergeImportedTasks(currentTasks, importedTasks) {
  const merged = new Map(currentTasks.map((task) => [task.id, task]));
  importedTasks.forEach((task) => merged.set(task.id, task));
  return [...merged.values()].sort((a, b) => a.date.localeCompare(b.date) || compareTaskTime(a, b) || a.title.localeCompare(b.title, "ru"));
}

function render() {
  document.getElementById("app").innerHTML = `
    ${appState.splashDone ? "" : Splash()}
    <main class="shell ${appState.splashDone ? "is-visible" : ""}">
      ${appState.view === "day" ? DayScreen() : appState.view === "week" ? WeekScreen() : appState.view === "month" ? MonthScreen() : Dashboard()}
      ${TaskModal()}
      ${ReminderPanel()}
      ${OverloadPanel()}
      ${MoveConfirmPanel()}
      <button class="seal-button floating-add" type="button" data-action="open-modal" aria-label="Добавить задачу">
        <span>+</span>
      </button>
      <div class="toast ${appState.toast ? "show" : ""}">${appState.toast}</div>
    </main>
  `;

  bindEvents();
  drawDonut();
  drawWeeklyBars();
  checkReminders();

  if (!appState.splashDone) {
    window.setTimeout(() => {
      appState.splashDone = true;
      sessionStorage.setItem("assiya.splash.done", "true");
      render();
    }, 2600);
  }
}

function Splash() {
  return `
    <section class="splash" aria-label="Загрузка АССИЯ">
      <div class="splash-medallion">
        <div class="splash-letter">А</div>
        <div class="splash-title" aria-label="АССИЯ">
          ${["А", "С", "С", "И", "Я"].map((letter, index) => `<span style="--i:${index}">${letter}</span>`).join("")}
        </div>
      </div>
    </section>
  `;
}

function Dashboard() {
  const date = parseISO(appState.selectedDate);
  const todayTasks = getTasksForDate(appState.selectedDate);
  const filteredTodayTasks = applyTaskFilters(todayTasks, appState.selectedDate);
  const stats = getStats(todayTasks);
  const clientStats = getClientStats(todayTasks);
  const overdue = getOverdueTasks();
  const greeting = getGreeting();
  const affirmation = getAffirmation(stats, overdue.length);

  return `
    <section class="dashboard page">
      <header class="topbar">
        ${Logo("small")}
        <div class="topbar-actions">
          <time class="date-stamp">${formatDateFull(date)}</time>
          ${ThemeToggle()}
        </div>
      </header>

      <p class="greeting">${greeting}</p>

      <section class="balance-panel" aria-label="Баланс дня">
        <div class="donut-wrap">
          <svg class="donut" viewBox="0 0 180 180" data-work="${stats.work}" data-self="${stats.self}" data-together="${stats.together}" data-total="${stats.total}" data-completed="${stats.completed}">
            <circle class="donut-bg" cx="90" cy="90" r="62"></circle>
            <circle class="donut-aura-bg" cx="90" cy="90" r="78"></circle>
            <circle class="donut-aura" cx="90" cy="90" r="78"></circle>
            <circle class="donut-work" cx="90" cy="90" r="62"></circle>
            <circle class="donut-self" cx="90" cy="90" r="62"></circle>
            <circle class="donut-together" cx="90" cy="90" r="62"></circle>
            <line class="donut-divider" x1="90" y1="27" x2="90" y2="45"></line>
          </svg>
          <div class="donut-center">
            <strong>${stats.total}</strong>
            <span>всего задач</span>
          </div>
        </div>

        <div class="balance-copy">
          <div class="legend">
            <span><i style="--dot:${palette.work}"></i>Рабочие <b>${stats.work}</b></span>
            <span><i style="--dot:${palette.self}"></i>Я <b>${stats.self}</b></span>
            <span><i style="--dot:${palette.together}"></i>Мы <b>${stats.together}</b></span>
          </div>
          <p>${affirmation}</p>
        </div>
      </section>

      ${overdue.length ? OverdueStrip(overdue.length) : ""}

      ${ClientSummary(clientStats, "dashboard", todayTasks)}

      ${FocusMatrixSummary(todayTasks)}

      ${AnalyticsPanel("day", todayTasks)}

      <nav class="view-tabs" aria-label="Переключение вида">
        <button class="${appState.activeTab === "day" ? "active" : ""}" data-tab="day" type="button">День</button>
        <button class="${appState.activeTab === "week" ? "active" : ""}" data-tab="week" type="button">Неделя</button>
        <button class="${appState.activeTab === "month" ? "active" : ""}" data-tab="month" type="button">Месяц</button>
      </nav>

      ${MiniCalendar()}

      <section class="today-preview">
        <div class="section-head">
          <h2>${appState.activeTab === "month" ? "Обзор месяца" : appState.activeTab === "week" ? "Ближайшие дни" : "Сегодня в фокусе"}</h2>
          <button class="text-button" type="button" data-action="${appState.activeTab === "month" ? "open-month" : appState.activeTab === "week" ? "open-week" : "open-day"}">
            Открыть
          </button>
        </div>
        ${appState.activeTab === "month" ? MonthPreview() : appState.activeTab === "week" ? WeekPreview() : TaskPreview(filteredTodayTasks)}
      </section>

      ${BackupPanel()}
    </section>
  `;
}

function Logo(size = "") {
  return `
    <div class="logo ${size}" aria-label="АССИЯ">
      <span>А</span>
    </div>
  `;
}

function ThemeToggle() {
  const isDark = appState.theme === "dark";
  return `
    <button class="theme-toggle" type="button" data-action="toggle-theme" aria-pressed="${isDark}" aria-label="Переключить тему">
      <span>${isDark ? "Светлая" : "Тёмная"}</span>
      <i>${isDark ? "☼" : "☾"}</i>
    </button>
  `;
}

function OverdueStrip(count) {
  return `
    <button class="overdue-strip" type="button" data-action="open-overdue">
      <span class="clock-icon"></span>
      <span>Эти задачи ждут твоего внимания. Ты займёшься ими, когда будешь готова.</span>
      <b>${count}</b>
    </button>
  `;
}

function MiniCalendar() {
  const days = getWeekDays(appState.selectedDate);
  return `
    <section class="mini-calendar" aria-label="Мини-календарь">
      ${days
        .map((day) => {
          const iso = toISO(day);
          const tasks = getTasksForDate(iso);
          const dots = tasks.slice(0, 3).map((task) => {
            const completed = isCompleted(task, iso);
            return `<i class="${completed ? "done" : taskClass(task)}" title="${escapeAttr(task.title)}"></i>`;
          });
          return `
            <button class="calendar-day ${iso === todayISO() ? "today" : ""} ${iso === appState.selectedDate ? "selected" : ""}" data-date="${iso}" type="button">
              <span>${day.getDate()}</span>
              <small>${capitalize(formatWeekday(day, "short"))}</small>
              <em>${dots.join("")}</em>
            </button>
          `;
        })
        .join("")}
    </section>
  `;
}

function TaskPreview(tasks) {
  if (!tasks.length) {
    return `<div class="empty-state">У тебя есть свободное время. Наслаждайся паузой или добавь что-то важное.</div>`;
  }

  return `
    <div class="task-preview-list">
      ${tasks
        .slice(0, 4)
        .map((task) => TaskRow(task, appState.selectedDate, true))
        .join("")}
    </div>
  `;
}

function WeekPreview() {
  const days = getWeekDays(appState.selectedDate);
  return `
    <div class="week-preview">
      ${days
        .slice(0, 4)
        .map((day) => {
          const iso = toISO(day);
          const count = getTasksForDate(iso).length;
          return `<button type="button" data-date="${iso}" class="week-preview-day"><span>${capitalize(formatWeekday(day, "short"))}</span><b>${day.getDate()}</b><small>${count} задач</small></button>`;
        })
        .join("")}
    </div>
  `;
}

function MonthPreview() {
  const monthDays = getMonthDays(appState.selectedDate).filter((day) => day.inMonth);
  const daysWithTasks = monthDays
    .map((day) => ({ ...day, count: getTasksForDate(day.iso).length }))
    .filter((day) => day.count > 0)
    .slice(0, 4);

  if (!daysWithTasks.length) {
    return `<div class="empty-state">В этом месяце пока много воздуха. Можно спокойно выбрать, что важно.</div>`;
  }

  return `
    <div class="week-preview">
      ${daysWithTasks
        .map((day) => `<button type="button" data-date="${day.iso}" class="week-preview-day"><span>${capitalize(formatWeekday(parseISO(day.iso), "short"))}</span><b>${parseISO(day.iso).getDate()}</b><small>${day.count} задач</small></button>`)
        .join("")}
    </div>
  `;
}

function DayScreen() {
  const dayTasks = getTasksForDate(appState.selectedDate);
  const clientStats = getClientStats(dayTasks);
  const tasks = applyTaskFilters(dayTasks, appState.selectedDate).sort(compareTaskTime);
  const active = getActiveTasks(tasks, appState.selectedDate);
  const airBlocks = getAirBlocks(tasks);
  const remaining = tasks.filter((task) => !isCompleted(task, appState.selectedDate)).length;

  return `
    <section class="day-screen page">
      <header class="sub-topbar">
        <button class="icon-button" data-action="dashboard" type="button" aria-label="Назад">${Icon("arrow")}</button>
        <h1>${isToday(appState.selectedDate) ? "Сегодня, " : ""}${formatDateShort(parseISO(appState.selectedDate))}</h1>
        <button class="icon-button" data-action="toggle-filter" type="button" aria-label="Фильтр">${Icon("filter")}</button>
      </header>

      <div class="focus-filter ${appState.focusFilter === "all" ? "" : "open"}">
        <button class="${appState.focusFilter === "all" ? "active" : ""}" data-focus="all" type="button">Все</button>
        ${Object.entries(focusMeta)
          .map(([key, meta]) => `<button class="${appState.focusFilter === key ? "active" : ""}" style="--focus:${meta.color}" data-focus="${key}" type="button">${meta.short}</button>`)
          .join("")}
      </div>

      <div class="big-time">${formatCurrentTime()}</div>

      ${ClientSummary(clientStats, "day", dayTasks)}

      ${FocusMatrixSummary(dayTasks)}

      ${FilterPanel(dayTasks, tasks)}

      ${AnalyticsPanel("day", dayTasks)}

      <section class="active-now">
        <h2>Активные задачи</h2>
        ${
          active.length
            ? active.map((task) => ActiveTaskCard(task)).join("")
            : `<div class="empty-state compact">Сейчас у тебя свободное время</div>`
        }
      </section>

      <section class="day-list">
        <h2>Все задачи дня</h2>
        ${
          tasks.length
            ? mergeTasksAndAir(tasks, airBlocks).join("")
            : `<div class="empty-state">По этим фильтрам задач нет. Можно мягко расширить поиск.</div>`
        }
      </section>

      <p class="bottom-note">${remaining ? `Ещё ${remaining} ${declOfNum(remaining, ["задача", "задачи", "задач"])} — и день станет легче.` : "Отличный день! Ты сделала всё, что было в твоих силах."}</p>
    </section>
  `;
}

function ActiveTaskCard(task) {
  return `
    <article class="task-card ${isCompleted(task, appState.selectedDate) ? "done" : ""}">
      <div>
        <span class="task-time">${TaskTimeLabel(task)}</span>
        <h3>${escapeHTML(task.title)}</h3>
        ${ClientLabel(task)}
        ${ReminderLabel(task)}
        <p>${getDeadlineCopy(task)}</p>
      </div>
      <div class="task-actions">
        <span class="category-icon ${taskClass(task)}" title="${categoryLabel(task)}">${CategoryIcon(task)}</span>
        <span class="focus-tag" style="--focus:${focusMeta[task.focus].color}">${focusMeta[task.focus].short}</span>
        <button class="move-task-button" type="button" data-move-edit="${task.id}" data-move-date="${task.occurrenceDate || appState.selectedDate}">Перенести</button>
        <button class="complete-button" type="button" data-complete="${task.id}">Выполнено</button>
      </div>
    </article>
  `;
}

function TaskRow(task, dateISO, allowOpen = false, showMove = false) {
  const completed = isCompleted(task, dateISO);
  return `
    <article class="task-row ${completed ? "done" : ""} ${showMove ? "has-move" : ""}" ${allowOpen ? `data-open-task="${task.id}" data-open-date="${dateISO}"` : ""}>
      <time>${task.allDay ? "Весь день" : task.start}</time>
      <div class="task-main">
        <span>${escapeHTML(task.title)}</span>
        ${ClientLabel(task)}
        ${ReminderLabel(task)}
      </div>
      <i class="mini-icon ${taskClass(task)}" title="${categoryLabel(task)}">${CategoryIcon(task)}</i>
      <em class="focus-dot" style="--focus:${focusMeta[task.focus].color}" title="${focusMeta[task.focus].label}"></em>
      ${showMove ? `<button class="row-move" type="button" data-move-edit="${task.id}" data-move-date="${dateISO}">Перенести</button>` : ""}
      <button class="row-done" type="button" data-complete="${task.id}" aria-label="Отметить выполненной">${completed ? Icon("check") : ""}</button>
    </article>
  `;
}

function ClientLabel(task) {
  if (normalizeCategory(task.category) !== "work" || !task.client) return "";
  return `<small class="client-label">${escapeHTML(task.client)}</small>`;
}

function taskClass(task) {
  return normalizeCategory(task.category);
}

function categoryLabel(task) {
  return categoryMeta[normalizeCategory(task.category)].label;
}

function CategoryIcon(task) {
  return Icon(categoryMeta[normalizeCategory(task.category)].icon);
}

function ReminderLabel(task) {
  if (!task.reminderAt) return "";
  if (task.snoozedUntil) return `<small class="reminder-label">Отложено до ${formatReminderText(task.snoozedUntil)}</small>`;
  return `<small class="reminder-label">${task.reminderDone ? "Напоминание отправлено" : `Напомнить ${formatReminderText(task.reminderAt)}`}</small>`;
}

function TaskTimeLabel(task) {
  if (task.allDay) return "Весь день";
  return task.end ? `${task.start} – ${task.end}` : `С ${task.start}`;
}

function ClientSummary(clientStats, source, tasks = []) {
  const workTotal = tasks.filter((task) => normalizeCategory(task.category) === "work").length;
  const total = clientStats.reduce((sum, item) => sum + item.count, 0);

  if (!clientStats.length) {
    return `
      <section class="client-summary" aria-label="Задачи по клиентам">
        <div class="section-head compact-head">
          <h2>Клиенты дня</h2>
          <span>${workTotal} ${declOfNum(workTotal, ["рабочая задача", "рабочие задачи", "рабочих задач"])}</span>
        </div>
        <div class="client-empty">Рабочие задачи с клиентами появятся здесь. Клиент поможет увидеть нагрузку мягче и точнее.</div>
      </section>
    `;
  }

  return `
    <section class="client-summary" aria-label="Задачи по клиентам">
      <div class="section-head compact-head">
        <h2>Клиенты дня</h2>
        <span>${total} ${declOfNum(total, ["рабочая задача", "рабочие задачи", "рабочих задач"])}</span>
      </div>
      <div class="client-chips">
        <button class="${appState.clientFilter === "all" ? "active" : ""}" data-client-filter="all" data-client-source="${source}" type="button">Все <b>${total}</b></button>
        ${clientStats
          .map((item) => `<button class="${appState.clientFilter === item.client ? "active" : ""}" data-client-filter="${escapeAttr(item.client)}" data-client-source="${source}" type="button">${escapeHTML(item.client)} <b>${item.count}</b></button>`)
          .join("")}
      </div>
    </section>
  `;
}

function FocusMatrixSummary(tasks) {
  if (!tasks.length) return "";
  const stats = getFocusStats(tasks);

  return `
    <section class="focus-summary" aria-label="Матрица фокуса">
      <div class="section-head compact-head">
        <h2>Матрица фокуса</h2>
        <button class="text-button slim ${appState.focusFilter === "all" ? "active" : ""}" data-focus="all" type="button">Все задачи</button>
      </div>
      <div class="focus-summary-grid">
        ${Object.entries(focusMeta)
          .map(([key, meta]) => {
            const count = stats[key] || 0;
            return `
              <button class="${appState.focusFilter === key ? "active" : ""}" style="--focus:${meta.color}" data-focus="${key}" type="button">
                <span>${meta.label}</span>
                <b>${count}</b>
              </button>
            `;
          })
          .join("")}
      </div>
    </section>
  `;
}

function FilterPanel(allTasks, filteredTasks) {
  const clientOptions = getClientStats(allTasks);
  const activeCount = getActiveFilterCount();

  return `
    <section class="filter-panel" aria-label="Фильтры и поиск">
      <div class="section-head compact-head">
        <h2>Поиск и фильтры</h2>
        <span>${filteredTasks.length} из ${allTasks.length}</span>
      </div>
      <div class="filter-grid">
        <label class="field compact-field">
          <span>Дата</span>
          <input name="dateFilter" type="date" value="${appState.selectedDate}" />
        </label>
        <label class="field compact-field">
          <span>Поиск по клиенту</span>
          <input name="clientSearch" placeholder="Например, Анна" value="${escapeAttr(appState.clientSearch)}" />
        </label>
        <label class="field compact-field">
          <span>Клиент</span>
          <select name="clientFilter">
            <option value="all" ${appState.clientFilter === "all" ? "selected" : ""}>Все клиенты</option>
            ${clientOptions.map((item) => `<option value="${escapeAttr(item.client)}" ${appState.clientFilter === item.client ? "selected" : ""}>${escapeHTML(item.client)}</option>`).join("")}
          </select>
        </label>
        <label class="field compact-field">
          <span>Категория</span>
          <select name="categoryFilter">
            <option value="all" ${appState.categoryFilter === "all" ? "selected" : ""}>Все категории</option>
            ${Object.entries(categoryMeta).map(([key, meta]) => `<option value="${key}" ${appState.categoryFilter === key ? "selected" : ""}>${meta.label}</option>`).join("")}
          </select>
        </label>
        <label class="field compact-field">
          <span>Статус</span>
          <select name="statusFilter">
            <option value="all" ${appState.statusFilter === "all" ? "selected" : ""}>Все статусы</option>
            <option value="completed" ${appState.statusFilter === "completed" ? "selected" : ""}>Выполненные</option>
            <option value="pending" ${appState.statusFilter === "pending" ? "selected" : ""}>Не выполненные</option>
          </select>
        </label>
        <label class="field compact-field">
          <span>Просрочка</span>
          <select name="overdueFilter">
            <option value="all" ${appState.overdueFilter === "all" ? "selected" : ""}>Все задачи</option>
            <option value="overdue" ${appState.overdueFilter === "overdue" ? "selected" : ""}>Просроченные</option>
            <option value="notOverdue" ${appState.overdueFilter === "notOverdue" ? "selected" : ""}>Без просрочки</option>
          </select>
        </label>
        <label class="field compact-field">
          <span>Повтор</span>
          <select name="repeatFilter">
            <option value="all" ${appState.repeatFilter === "all" ? "selected" : ""}>Любой повтор</option>
            <option value="none" ${appState.repeatFilter === "none" ? "selected" : ""}>Нет</option>
            <option value="weekly" ${appState.repeatFilter === "weekly" ? "selected" : ""}>Каждую неделю</option>
            <option value="monthly" ${appState.repeatFilter === "monthly" ? "selected" : ""}>Каждый месяц</option>
          </select>
        </label>
        <label class="field compact-field">
          <span>Напоминания</span>
          <select name="reminderFilter">
            <option value="all" ${appState.reminderFilter === "all" ? "selected" : ""}>Все задачи</option>
            <option value="with" ${appState.reminderFilter === "with" ? "selected" : ""}>С напоминанием</option>
            <option value="without" ${appState.reminderFilter === "without" ? "selected" : ""}>Без напоминания</option>
          </select>
        </label>
      </div>
      <div class="filter-actions">
        <button class="text-button slim" type="button" data-action="reset-filters">Сбросить фильтры${activeCount ? ` · ${activeCount}` : ""}</button>
      </div>
    </section>
  `;
}

function AnalyticsPanel(period, tasks) {
  const analytics = getAnalytics(period, appState.selectedDate, tasks);

  return `
    <section class="analytics-panel" aria-label="Аналитика">
      <div class="section-head compact-head">
        <h2>Аналитика</h2>
        <span>${analytics.periodLabel}</span>
      </div>
      <div class="analytics-grid">
        <div class="analytics-card">
          <span>Всего</span>
          <b>${analytics.stats.total}</b>
          <small>${analytics.completionPercent}% выполнено</small>
        </div>
        <div class="analytics-card">
          <span>Выполнено</span>
          <b>${analytics.stats.completed}</b>
          <small>${analytics.pending} ждёт внимания</small>
        </div>
        <div class="analytics-card">
          <span>Просрочка</span>
          <b>${analytics.overdue}</b>
          <small>без резкой тревоги</small>
        </div>
        <div class="analytics-card">
          <span>Баланс</span>
          <small>Рабочие ${analytics.stats.work} · Я ${analytics.stats.self} · Мы ${analytics.stats.together}</small>
        </div>
      </div>
      <div class="analytics-columns">
        <div>
          <h3>Клиенты</h3>
          ${
            analytics.clientStats.length
              ? analytics.clientStats.slice(0, 4).map((item) => `<p><span>${escapeHTML(item.client)}</span><b>${item.count}</b></p>`).join("")
              : `<p class="muted-line">Рабочие задачи с клиентами появятся здесь.</p>`
          }
        </div>
        <div>
          <h3>Загруженные дни</h3>
          ${
            analytics.busiestDays.length
              ? analytics.busiestDays.slice(0, 4).map((item) => `<p><span>${formatDateShort(parseISO(item.date))}</span><b>${item.count}</b></p>`).join("")
              : `<p class="muted-line">Пока всё спокойно.</p>`
          }
        </div>
      </div>
    </section>
  `;
}

function BackupPanel() {
  return `
    <details class="backup-panel" aria-label="Резервная копия">
      <summary>
        <span>Резервная копия</span>
        <small>экспорт и импорт JSON</small>
      </summary>
      <div class="backup-content">
        <p>Данные хранятся локально. Иногда можно сохранить JSON-файл, чтобы планы не зависели от очистки браузера.</p>
        <div class="backup-actions">
          <button class="text-button slim" type="button" data-action="export-backup">Скачать JSON</button>
          <label class="field compact-field">
            <span>Режим импорта</span>
            <select name="backupImportMode">
              <option value="merge">Объединить</option>
              <option value="replace">Заменить</option>
            </select>
          </label>
          <label class="text-button slim backup-file-button">
            Загрузить JSON
            <input name="backupFile" type="file" accept="application/json,.json" />
          </label>
        </div>
      </div>
    </details>
  `;
}

function AirBlock(block) {
  return `
    <div class="air-block">
      <span>Здесь ты можешь выдохнуть</span>
      <time>${block.from} – ${block.to}</time>
    </div>
  `;
}

function ReminderPanel() {
  if (!appState.reminderPromptId) return "";
  const task = appState.tasks.find((item) => item.id === appState.reminderPromptId);
  if (!task) return "";

  return `
    <section class="gentle-panel reminder-panel" role="dialog" aria-label="Напоминание">
      <div>
        <span>АССИЯ напоминает</span>
        <h2>${escapeHTML(task.title)}</h2>
        ${ClientLabel(task)}
        <p>Можно заняться сейчас или мягко отложить напоминание.</p>
      </div>
      <div class="panel-actions">
        <button type="button" data-snooze-reminder="10m" data-reminder-task="${task.id}">Через 10 минут</button>
        <button type="button" data-snooze-reminder="1h" data-reminder-task="${task.id}">Через 1 час</button>
        <button type="button" data-snooze-reminder="tomorrow" data-reminder-task="${task.id}">Завтра утром</button>
        <button type="button" data-action="dismiss-reminder">Я увидела</button>
      </div>
    </section>
  `;
}

function OverloadPanel() {
  if (!appState.overloadDate) return "";
  const tasks = getTasksForDate(appState.overloadDate).sort((a, b) => focusWeight(b.focus) - focusWeight(a.focus) || compareTaskTime(a, b));
  if (tasks.length <= 5) return "";
  const targetDate = findNearestLightDay(appState.overloadDate);

  return `
    <section class="gentle-panel overload-panel" role="dialog" aria-label="Предложение переноса">
      <div>
        <span>День стал насыщенным</span>
        <h2>${formatDateShort(parseISO(appState.overloadDate))}: ${tasks.length} ${declOfNum(tasks.length, ["задача", "задачи", "задач"])}</h2>
        <p>Можно перенести одну из задач на более спокойный день. Я предложила дату, но ты можешь выбрать другую.</p>
      </div>
      <label class="field compact-field overload-date-field">
        <span>Дата переноса</span>
        <input name="overloadMoveDate" type="date" value="${targetDate}" />
      </label>
      <div class="overload-list">
        ${tasks
          .map(
            (task) => `
              <article class="${task.focus === "calm" ? "low-focus" : ""}">
                <span>${TaskTimeLabel(task)}</span>
                <b>${escapeHTML(task.title)}</b>
                <small>${focusMeta[task.focus].label}${task.focus === "calm" ? " · хороший кандидат на перенос" : ""}</small>
                <button type="button" data-overload-move="${task.id}" data-move-from="${task.occurrenceDate || task.date}" data-move-to="${targetDate}">Перенести</button>
              </article>
            `,
          )
          .join("")}
      </div>
      <div class="panel-actions">
        <button type="button" data-action="dismiss-overload">Оставить как есть</button>
      </div>
    </section>
  `;
}

function MoveConfirmPanel() {
  if (!appState.pendingMove) return "";
  const task = appState.tasks.find((item) => item.id === appState.pendingMove.taskId);
  if (!task) return "";

  return `
    <section class="gentle-panel move-panel" role="dialog" aria-label="Подтверждение переноса">
      <div>
        <span>Перенос повторяющейся задачи</span>
        <h2>${escapeHTML(task.title)}</h2>
        <p>Я изменю только выбранное повторение: ${formatDateShort(parseISO(appState.pendingMove.fromDate))} → ${formatDateShort(parseISO(appState.pendingMove.targetDate))}. Серия останется прежней.</p>
      </div>
      <div class="panel-actions">
        <button type="button" data-action="confirm-move">Подтвердить перенос</button>
        <button type="button" data-action="cancel-move">Оставить на месте</button>
      </div>
    </section>
  `;
}

function WeekScreen() {
  const days = getWeekDays(appState.selectedDate);
  const range = `${days[0].getDate()}–${formatDateShort(days[6])}`;
  const weekTasks = getTasksForDates(days.map(toISO));

  return `
    <section class="week-screen page">
      <header class="sub-topbar">
        <button class="icon-button" data-action="dashboard" type="button" aria-label="Назад">${Icon("arrow")}</button>
        <h1>Неделя ${range}</h1>
        <button class="today-button" type="button" data-action="today">Сегодня</button>
      </header>

      <div class="week-nav">
        <button type="button" data-week-shift="-7">${Icon("chevronLeft")}</button>
        <span>${formatDateShort(days[0])} — ${formatDateShort(days[6])}</span>
        <button type="button" data-week-shift="7">${Icon("chevronRight")}</button>
      </div>

      <section class="week-layout">
        <div class="week-grid">
          ${days
            .map((day) => {
              const iso = toISO(day);
              const tasks = getTasksForDate(iso).sort(compareTaskTime);
              return `
                <div class="week-cell ${iso === todayISO() ? "today" : ""}" role="button" tabindex="0" data-date="${iso}" data-drop-date="${iso}">
                  <header><span>${capitalize(formatWeekday(day, "short"))}</span><b>${day.getDate()}</b></header>
                  <div>
                    ${tasks
                      .slice(0, 3)
                      .map((task) => `<p class="calendar-task" draggable="true" data-drag-task="${task.id}" data-drag-date="${iso}"><i class="${taskClass(task)}"></i><span>${escapeHTML(task.title)}${normalizeCategory(task.category) === "work" && task.client ? ` · ${escapeHTML(task.client)}` : ""}</span></p>`)
                      .join("")}
                    ${tasks.length > 3 ? `<small>+${tasks.length - 3}</small>` : ""}
                  </div>
                </div>
              `;
            })
            .join("")}
        </div>
        <aside class="load-chart">
          <h2>Нагрузка</h2>
          <div class="bars">
            ${days
              .map((day) => {
                const iso = toISO(day);
                const stats = getStats(getTasksForDate(iso));
                return `<div class="bar" data-total="${stats.total}" data-work="${stats.work}" data-self="${stats.self}" data-together="${stats.together}"><span class="work"></span><span class="self"></span><span class="together"></span><small>${capitalize(formatWeekday(day, "short"))}</small></div>`;
              })
              .join("")}
          </div>
        </aside>
      </section>

      ${AnalyticsPanel("week", weekTasks)}
    </section>
  `;
}

function MonthScreen() {
  const selected = parseISO(appState.selectedDate);
  const monthDays = getMonthDays(appState.selectedDate);
  const monthTasks = monthDays
    .filter((day) => day.inMonth)
    .flatMap((day) => getTasksForDate(day.iso));
  const stats = getStats(monthTasks);
  const clientStats = getClientStats(monthTasks);

  return `
    <section class="month-screen page">
      <header class="sub-topbar">
        <button class="icon-button" data-action="dashboard" type="button" aria-label="Назад">${Icon("arrow")}</button>
        <h1>${capitalize(new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric" }).format(selected))}</h1>
        <button class="today-button" type="button" data-action="today">Сегодня</button>
      </header>

      <div class="week-nav">
        <button type="button" data-month-shift="-1">${Icon("chevronLeft")}</button>
        <span>${stats.total} ${declOfNum(stats.total, ["задача", "задачи", "задач"])} в этом месяце</span>
        <button type="button" data-month-shift="1">${Icon("chevronRight")}</button>
      </div>

      <section class="month-overview">
        <div>
          <span><i style="--dot:${palette.work}"></i>Рабочие <b>${stats.work}</b></span>
          <span><i style="--dot:${palette.self}"></i>Я <b>${stats.self}</b></span>
          <span><i style="--dot:${palette.together}"></i>Мы <b>${stats.together}</b></span>
        </div>
        ${clientStats.length ? `<p>Самый активный клиент: ${escapeHTML(clientStats[0].client)} · ${clientStats[0].count}</p>` : `<p>Рабочие задачи с клиентами появятся здесь, когда ты их добавишь.</p>`}
      </section>

      <section class="month-grid" aria-label="Календарь месяца">
        ${["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((day) => `<div class="month-weekday">${day}</div>`).join("")}
        ${monthDays
          .map((day) => {
            const tasks = getTasksForDate(day.iso).sort(compareTaskTime);
            const statsForDay = getStats(tasks);
            return `
              <div class="month-day ${day.inMonth ? "" : "muted"} ${day.iso === todayISO() ? "today" : ""} ${day.iso === appState.selectedDate ? "selected" : ""}" role="button" tabindex="0" data-date="${day.iso}" data-drop-date="${day.iso}">
                <header>
                  <b>${parseISO(day.iso).getDate()}</b>
                  <span>${tasks.length || ""}</span>
                </header>
                <div class="month-dots" aria-label="Баланс дня">
                  ${statsForDay.work ? `<i class="work" title="Рабочие: ${statsForDay.work}"></i>` : ""}
                  ${statsForDay.self ? `<i class="self" title="Я: ${statsForDay.self}"></i>` : ""}
                  ${statsForDay.together ? `<i class="together" title="Мы: ${statsForDay.together}"></i>` : ""}
                  ${statsForDay.completed ? `<i class="done" title="Выполненные: ${statsForDay.completed}"></i>` : ""}
                </div>
                <div class="month-task-list">
                  ${tasks
                    .slice(0, 2)
                    .map((task) => `<p class="calendar-task" draggable="true" data-drag-task="${task.id}" data-drag-date="${day.iso}"><i class="${taskClass(task)}"></i><span>${escapeHTML(task.title)}${task.client ? ` · ${escapeHTML(task.client)}` : ""}</span></p>`)
                    .join("")}
                  ${tasks.length > 2 ? `<small>+${tasks.length - 2}</small>` : ""}
                </div>
              </div>
            `;
          })
          .join("")}
      </section>

      ${AnalyticsPanel("month", monthTasks)}
    </section>
  `;
}

function TaskModal() {
  if (!appState.modalOpen) return "";

  const task = appState.editingId ? appState.tasks.find((item) => item.id === appState.editingId) : null;
  const isRecurringEdit = Boolean(task && task.repeat !== "none");
  const occurrenceDate = task ? appState.editingDate || task.occurrenceDate || appState.selectedDate : appState.selectedDate;
  const value = task
    ? {
        ...task,
        date: isRecurringEdit ? occurrenceDate : task.date,
        repeat: isRecurringEdit ? "none" : task.repeat,
      }
    : {
    title: "",
    category: "work",
    client: "",
    date: appState.selectedDate,
    start: "09:00",
    end: "",
    allDay: false,
    repeat: "none",
    focus: "important",
    care: true,
    reminderAt: "",
    reminderDone: false,
  };
  const activeCategory = normalizeCategory(value.category);

  return `
    <div class="modal-backdrop" data-action="close-modal">
      <form class="task-modal" id="task-form">
        <header>
          <h2>${task ? "Редактировать задачу" : "Создание задачи"}</h2>
          <button class="icon-button" type="button" data-action="close-modal" aria-label="Закрыть">${Icon("x")}</button>
        </header>

        ${
          isRecurringEdit
            ? `<p class="modal-note">Это повторяющаяся задача. Сохранение изменит только выбранное повторение, серия останется прежней.</p>`
            : ""
        }

        <label class="field typewriter-line">
          <span>Название задачи</span>
          <input name="title" required placeholder="Что ты хочешь сделать?" value="${escapeAttr(value.title)}" />
        </label>

        <input type="hidden" name="category" value="${activeCategory}" />
        <div class="field">
          <span>Категория</span>
          <div class="icon-switch">
            <button class="${activeCategory === "work" ? "active" : ""}" type="button" data-category="work">${Icon("briefcase")}<span>Рабочая</span></button>
            <button class="${activeCategory === "self" ? "active" : ""}" type="button" data-category="self">${Icon("user")}<span>Я</span></button>
            <button class="${activeCategory === "together" ? "active" : ""}" type="button" data-category="together">${Icon("users")}<span>Мы</span></button>
          </div>
        </div>

        <label class="field client-field ${activeCategory === "work" ? "" : "is-hidden"}">
          <span>Клиент</span>
          <input name="client" placeholder="Для кого эта рабочая задача?" value="${escapeAttr(value.client || "")}" />
        </label>

        <label class="field">
          <span>Дата</span>
          <input name="date" type="date" value="${value.date}" required />
        </label>

        <div class="time-grid">
          <label class="field clock-field">
            <span>Начало</span>
            <input name="start" type="time" value="${value.start}" ${value.allDay ? "disabled" : ""} />
          </label>
          <label class="field clock-field">
            <span>Конец</span>
            <input name="end" type="time" value="${value.end}" ${value.allDay ? "disabled" : ""} />
          </label>
        </div>

        <label class="care-check">
          <input name="allDay" type="checkbox" ${value.allDay ? "checked" : ""} />
          <span>Весь день</span>
        </label>

        <label class="care-check reminder-toggle">
          <input name="reminderEnabled" type="checkbox" ${value.reminderAt ? "checked" : ""} />
          <span>Напомнить мне об этой задаче</span>
        </label>

        <p class="reminder-note">Напоминания надёжнее всего работают, пока АССИЯ открыта в браузере или PWA. Если приложение закрыто или система выгрузила его из памяти, уведомление может не сработать вовремя.</p>

        <label class="field reminder-field ${value.reminderAt ? "" : "is-hidden"}">
          <span>Время напоминания</span>
          <input name="reminderAt" type="datetime-local" value="${escapeAttr(value.reminderAt || defaultReminderValue(value))}" />
        </label>

        <label class="field">
          <span>Повтор</span>
          <select name="repeat" ${isRecurringEdit ? "disabled" : ""}>
            <option value="none" ${value.repeat === "none" ? "selected" : ""}>Нет</option>
            <option value="weekly" ${value.repeat === "weekly" ? "selected" : ""}>Каждую неделю</option>
            <option value="monthly" ${value.repeat === "monthly" ? "selected" : ""}>Каждый месяц</option>
          </select>
          ${isRecurringEdit ? `<input type="hidden" name="repeat" value="none" />` : ""}
        </label>

        <input type="hidden" name="focus" value="${value.focus}" />
        <div class="field">
          <span>Матрица фокуса</span>
          <div class="focus-matrix">
            ${Object.entries(focusMeta)
              .map(([key, meta]) => `<button class="${value.focus === key ? "active" : ""}" style="--focus:${meta.color}" type="button" data-focus-choice="${key}"><i></i><span>${meta.label}</span></button>`)
              .join("")}
          </div>
        </div>

        <label class="care-check">
          <input name="care" type="checkbox" ${value.care ? "checked" : ""} />
          <span>Напомнить мне, если я перегружаю этот день</span>
        </label>

        <button class="save-seal" type="submit">Сохранить</button>
        ${task ? `<button class="delete-task" type="button" data-delete-task="${task.id}" data-delete-date="${occurrenceDate}">${isRecurringEdit ? "Удалить это повторение" : "Удалить задачу"}</button>` : ""}
      </form>
    </div>
  `;
}

function bindEvents() {
  document.querySelectorAll("[data-action='open-modal']").forEach((button) => {
    button.addEventListener("click", () => {
      appState.modalOpen = true;
      appState.editingId = null;
      appState.editingDate = null;
      render();
    });
  });

  document.querySelectorAll("[data-action='close-modal']").forEach((element) => {
    element.addEventListener("click", (event) => {
      if (event.target === element || element.matches("button")) {
        appState.modalOpen = false;
        appState.editingId = null;
        appState.editingDate = null;
        render();
      }
    });
  });

  document.querySelectorAll("[data-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      appState.activeTab = button.dataset.tab;
      if (button.dataset.tab === "week") appState.view = "week";
      if (button.dataset.tab === "month") appState.view = "month";
      if (button.dataset.tab === "day") appState.view = "day";
      render();
    });
  });

  document.querySelectorAll("[data-date]").forEach((button) => {
    button.addEventListener("click", (event) => {
      if (event.target.closest("[data-drag-task]")) return;
      appState.selectedDate = button.dataset.date;
      appState.clientFilter = "all";
      if (
        button.classList.contains("calendar-day") ||
        button.classList.contains("week-cell") ||
        button.classList.contains("month-day") ||
        button.classList.contains("week-preview-day")
      ) {
        appState.view = "day";
      }
      render();
    });
  });

  document.querySelectorAll("[data-drag-task]").forEach((item) => {
    item.addEventListener("click", (event) => event.stopPropagation());
    item.addEventListener("dragstart", (event) => {
      event.stopPropagation();
      event.dataTransfer.setData("text/plain", JSON.stringify({
        taskId: item.dataset.dragTask,
        fromDate: item.dataset.dragDate,
      }));
      event.dataTransfer.effectAllowed = "move";
      item.classList.add("is-dragging");
    });
    item.addEventListener("dragend", () => {
      item.classList.remove("is-dragging");
      document.querySelectorAll(".drag-over").forEach((element) => element.classList.remove("drag-over"));
    });
  });

  document.querySelectorAll("[data-drop-date]").forEach((cell) => {
    cell.addEventListener("dragover", (event) => {
      event.preventDefault();
      cell.classList.add("drag-over");
    });
    cell.addEventListener("dragleave", () => {
      cell.classList.remove("drag-over");
    });
    cell.addEventListener("drop", (event) => {
      event.preventDefault();
      event.stopPropagation();
      cell.classList.remove("drag-over");
      const payload = parseDragPayload(event.dataTransfer.getData("text/plain"));
      if (!payload) return;
      requestTaskMove(payload.taskId, payload.fromDate, cell.dataset.dropDate);
    });
  });

  document.querySelectorAll("[data-action='open-day']").forEach((button) => {
    button.addEventListener("click", () => {
      appState.view = "day";
      render();
    });
  });

  document.querySelectorAll("[data-action='open-week']").forEach((button) => {
    button.addEventListener("click", () => {
      appState.view = "week";
      render();
    });
  });

  document.querySelectorAll("[data-action='open-month']").forEach((button) => {
    button.addEventListener("click", () => {
      appState.view = "month";
      render();
    });
  });

  document.querySelectorAll("[data-action='dashboard']").forEach((button) => {
    button.addEventListener("click", () => {
      appState.view = "dashboard";
      render();
    });
  });

  document.querySelectorAll("[data-action='today']").forEach((button) => {
    button.addEventListener("click", () => {
      appState.selectedDate = todayISO();
      appState.clientFilter = "all";
      render();
    });
  });

  document.querySelectorAll("[data-week-shift]").forEach((button) => {
    button.addEventListener("click", () => {
      appState.selectedDate = shiftISO(appState.selectedDate, Number(button.dataset.weekShift));
      appState.clientFilter = "all";
      render();
    });
  });

  document.querySelectorAll("[data-month-shift]").forEach((button) => {
    button.addEventListener("click", () => {
      appState.selectedDate = shiftMonthISO(appState.selectedDate, Number(button.dataset.monthShift));
      appState.clientFilter = "all";
      render();
    });
  });

  document.querySelectorAll("[data-complete]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleComplete(button.dataset.complete, appState.selectedDate);
    });
  });

  document.querySelectorAll("[data-delete-task]").forEach((button) => {
    button.addEventListener("click", () => {
      const task = appState.tasks.find((item) => item.id === button.dataset.deleteTask);
      const deleteDate = button.dataset.deleteDate || appState.selectedDate;

      if (task && task.repeat !== "none") {
        appState.tasks = appState.tasks.map((item) =>
          item.id === task.id ? addRecurrenceException(item, deleteDate) : item,
        );
      } else {
        appState.tasks = appState.tasks.filter((item) => item.id !== button.dataset.deleteTask);
      }

      saveTasks();
      appState.modalOpen = false;
      appState.editingId = null;
      appState.editingDate = null;
      showToast(task?.repeat !== "none" ? "Это повторение убрано из плана. Серия осталась на месте." : "Задача убрана из плана. В расписании стало просторнее.");
    });
  });

  document.querySelectorAll("[data-open-task]").forEach((row) => {
    row.addEventListener("click", () => {
      appState.editingId = row.dataset.openTask;
      appState.editingDate = row.dataset.openDate || appState.selectedDate;
      appState.modalOpen = true;
      render();
    });
  });

  document.querySelectorAll("[data-focus]").forEach((button) => {
    button.addEventListener("click", () => {
      appState.focusFilter = button.dataset.focus;
      render();
    });
  });

  document.querySelectorAll("[data-client-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      appState.clientFilter = button.dataset.clientFilter;
      if (button.dataset.clientSource === "dashboard") {
        appState.view = "day";
      }
      render();
    });
  });

  document.querySelectorAll("[name='dateFilter']").forEach((input) => {
    const handleDateFilter = () => {
      if (!isISODate(input.value)) return;
      appState.selectedDate = input.value;
      render();
    };

    input.addEventListener("input", handleDateFilter);
    input.addEventListener("change", handleDateFilter);
  });

  document.querySelectorAll("[name='clientSearch']").forEach((input) => {
    input.addEventListener("input", () => {
      appState.clientSearch = input.value;
      render();
    });
  });

  [
    ["clientFilter", "clientFilter"],
    ["categoryFilter", "categoryFilter"],
    ["statusFilter", "statusFilter"],
    ["overdueFilter", "overdueFilter"],
    ["repeatFilter", "repeatFilter"],
    ["reminderFilter", "reminderFilter"],
  ].forEach(([name, stateKey]) => {
    document.querySelectorAll(`[name='${name}']`).forEach((select) => {
      select.addEventListener("change", () => {
        appState[stateKey] = select.value;
        render();
      });
    });
  });

  document.querySelectorAll("[data-action='toggle-filter']").forEach((button) => {
    button.addEventListener("click", () => {
      const order = ["all", "urgentImportant", "important", "urgent", "calm"];
      const index = order.indexOf(appState.focusFilter);
      appState.focusFilter = order[(index + 1) % order.length];
      render();
    });
  });

  document.querySelectorAll("[data-action='reset-filters']").forEach((button) => {
    button.addEventListener("click", () => {
      resetFilters();
      render();
    });
  });

  document.querySelectorAll("[data-action='toggle-theme']").forEach((button) => {
    button.addEventListener("click", () => {
      appState.theme = appState.theme === "dark" ? "light" : "dark";
      applyTheme(appState.theme);
      saveTheme(appState.theme);
      render();
    });
  });

  document.querySelectorAll("[data-action='export-backup']").forEach((button) => {
    button.addEventListener("click", exportBackup);
  });

  document.querySelectorAll("[name='backupFile']").forEach((input) => {
    input.addEventListener("change", () => handleBackupFile(input));
  });

  document.querySelectorAll("[data-snooze-reminder]").forEach((button) => {
    button.addEventListener("click", () => {
      snoozeReminder(button.dataset.reminderTask, button.dataset.snoozeReminder);
    });
  });

  document.querySelectorAll("[data-action='dismiss-reminder']").forEach((button) => {
    button.addEventListener("click", () => {
      appState.reminderPromptId = null;
      render();
    });
  });

  document.querySelectorAll("[data-action='dismiss-overload']").forEach((button) => {
    button.addEventListener("click", () => {
      appState.overloadDate = null;
      render();
    });
  });

  document.querySelectorAll("[data-overload-move]").forEach((button) => {
    button.addEventListener("click", () => {
      const selectedMoveDate = document.querySelector("[name='overloadMoveDate']")?.value || button.dataset.moveTo;
      if (!isISODate(selectedMoveDate)) {
        showToast("Выбери дату переноса, и я аккуратно передвину задачу.");
        return;
      }
      requestTaskMove(button.dataset.overloadMove, button.dataset.moveFrom, selectedMoveDate);
    });
  });

  document.querySelectorAll("[data-move-edit]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      appState.editingId = button.dataset.moveEdit;
      appState.editingDate = button.dataset.moveDate || appState.selectedDate;
      appState.modalOpen = true;
      render();
      window.setTimeout(() => document.querySelector("#task-form [name='date']")?.focus(), 0);
    });
  });

  document.querySelectorAll("[data-action='confirm-move']").forEach((button) => {
    button.addEventListener("click", () => {
      if (!appState.pendingMove) return;
      moveTaskToDate(appState.pendingMove.taskId, appState.pendingMove.fromDate, appState.pendingMove.targetDate, { confirmed: true });
    });
  });

  document.querySelectorAll("[data-action='cancel-move']").forEach((button) => {
    button.addEventListener("click", () => {
      appState.pendingMove = null;
      render();
    });
  });

  document.querySelectorAll("[data-action='open-overdue']").forEach((button) => {
    button.addEventListener("click", () => {
      const overdue = getOverdueTasks()[0];
      if (overdue) {
        appState.selectedDate = overdue.date;
        appState.view = "day";
        render();
      }
    });
  });

  const form = document.getElementById("task-form");
  if (form) {
    form.addEventListener("click", (event) => event.stopPropagation());
    form.addEventListener("submit", handleTaskSubmit);

    form.querySelectorAll("[data-category]").forEach((button) => {
      button.addEventListener("click", () => {
        form.category.value = button.dataset.category;
        form.querySelectorAll("[data-category]").forEach((item) => item.classList.toggle("active", item === button));
        const clientField = form.querySelector(".client-field");
        if (clientField) {
          clientField.classList.toggle("is-hidden", button.dataset.category !== "work");
        }
      });
    });

    form.querySelectorAll("[data-focus-choice]").forEach((button) => {
      button.addEventListener("click", () => {
        form.focus.value = button.dataset.focusChoice;
        form.querySelectorAll("[data-focus-choice]").forEach((item) => item.classList.toggle("active", item === button));
      });
    });

    form.allDay.addEventListener("change", () => {
      form.start.disabled = form.allDay.checked;
      form.end.disabled = form.allDay.checked;
    });

    form.reminderEnabled.addEventListener("change", () => {
      const reminderField = form.querySelector(".reminder-field");
      if (reminderField) {
        reminderField.classList.toggle("is-hidden", !form.reminderEnabled.checked);
      }
    });
  }
}

function handleTaskSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  const date = data.get("date");
  const category = normalizeCategory(data.get("category"));
  const existingTask = appState.editingId ? appState.tasks.find((item) => item.id === appState.editingId) : null;
  const editingDate = appState.editingDate || existingTask?.date || date;
  const isRecurringEdit = Boolean(existingTask && existingTask.repeat !== "none");
  const reminderAt = data.get("reminderEnabled") ? String(data.get("reminderAt") || "").trim() : "";
  const allDay = Boolean(data.get("allDay"));
  const start = allDay ? "00:00" : normalizeTime(data.get("start")) || "09:00";
  const end = allDay ? "23:59" : normalizeTime(data.get("end"));
  const title = String(data.get("title") || "").trim();

  if (!title) {
    showToast("Название поможет мне бережно сохранить задачу. Добавь его, пожалуйста.");
    return;
  }

  if (!allDay && end && timeToMinutes(end) < timeToMinutes(start)) {
    showToast("Время окончания не может быть раньше начала. Давай поправим расписание спокойно.");
    return;
  }

  if (data.get("reminderEnabled") && !reminderAt) {
    showToast("Чтобы я напомнила вовремя, выбери дату и время напоминания.");
    return;
  }

  const task = normalizeTask({
    id: isRecurringEdit ? crypto.randomUUID() : appState.editingId || crypto.randomUUID(),
    title,
    category,
    client: category === "work" ? String(data.get("client") || "").trim() : "",
    date,
    start,
    end,
    allDay,
    repeat: isRecurringEdit ? "none" : data.get("repeat"),
    focus: data.get("focus"),
    care: Boolean(data.get("care")),
    reminderAt,
    reminderDone: existingTask?.reminderAt === reminderAt ? Boolean(existingTask?.reminderDone) : false,
    snoozedUntil: existingTask?.reminderAt === reminderAt ? existingTask?.snoozedUntil || "" : "",
    completedDates: existingTask && isCompleted(existingTask, editingDate) ? [date] : existingTask?.completedDates || [],
    recurrenceExceptionDates: isRecurringEdit ? [] : existingTask?.recurrenceExceptionDates || [],
    sourceTaskId: isRecurringEdit ? existingTask.id : existingTask?.sourceTaskId || "",
    createdAt: existingTask?.createdAt || Date.now(),
  });

  if (isRecurringEdit) {
    appState.tasks = [
      ...appState.tasks.map((item) => (item.id === existingTask.id ? addRecurrenceException(item, editingDate) : item)),
      task,
    ];
  } else if (appState.editingId) {
    appState.tasks = appState.tasks.map((item) => (item.id === appState.editingId ? task : item));
  } else {
    appState.tasks = [...appState.tasks, task];
  }

  saveTasks();
  appState.selectedDate = date;
  appState.modalOpen = false;
  appState.editingId = null;
  appState.editingDate = null;

  const dayTasks = getTasksForDate(date);
  const missingWorkClient = category === "work" && !task.client;
  const dayIsOverloaded = dayTasks.length > 5 && task.care;
  requestNotificationPermission(task.reminderAt);
  if (dayIsOverloaded) {
    appState.overloadDate = date;
  }
  showToast(
    dayIsOverloaded
      ? "Ты много запланировала. Давай посмотрим, что можно перенести, чтобы ты не выгорела."
      : missingWorkClient
        ? "Задача сохранена. Клиент поможет увидеть нагрузку, но я бережно сохраню задачу и без него."
        : "Задача сохранена. Я присмотрю за деталями.",
  );
  checkReminders();
}

function toggleComplete(taskId, dateISO) {
  appState.tasks = appState.tasks.map((task) => {
    if (task.id !== taskId) return task;
    const completedDates = new Set(task.completedDates || []);
    completedDates.has(dateISO) ? completedDates.delete(dateISO) : completedDates.add(dateISO);
    return { ...task, completedDates: [...completedDates] };
  });

  saveTasks();
  showToast("Отлично! Ты сделала шаг. Я запомнила этот успех.");
}

function showToast(message) {
  appState.toast = message;
  const modalForm = document.getElementById("task-form");

  if (appState.modalOpen && modalForm) {
    updateToastElement();
  } else {
    render();
  }

  if (toastTimer) window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    appState.toast = "";
    updateToastElement();
  }, 2600);
}

function updateToastElement() {
  const toast = document.querySelector(".toast");
  if (!toast) return;
  toast.textContent = appState.toast;
  toast.classList.toggle("show", Boolean(appState.toast));
}

function requestNotificationPermission(reminderAt) {
  if (!reminderAt || !("Notification" in window) || Notification.permission !== "default") return;
  Notification.requestPermission().catch(() => {});
}

function checkReminders() {
  const now = Date.now();
  const dueTasks = [];
  let changed = false;

  appState.tasks = appState.tasks.map((task) => {
    if (!task.reminderAt || task.reminderDone) return task;
    const reminderTime = getReminderDueTime(task);
    if (!reminderTime || new Date(reminderTime).getTime() > now) return task;

    dueTasks.push(task);
    changed = true;
    return { ...task, reminderDone: true, snoozedUntil: "" };
  });

  if (!dueTasks.length) return;
  if (changed) saveTasks();
  appState.reminderPromptId = dueTasks[0].id;

  if ("Notification" in window && Notification.permission === "granted") {
    dueTasks.forEach((task) => {
      new Notification("АССИЯ напоминает", {
        body: `${task.title}${task.client ? ` · ${task.client}` : ""}`,
      });
    });
  }

  const firstTask = dueTasks[0];
  showToast(`Напоминание: ${firstTask.title}`);
}

function getReminderDueTime(task) {
  return task.snoozedUntil || task.reminderAt || "";
}

function snoozeReminder(taskId, option) {
  const snoozedUntil = getSnoozeTime(option);
  appState.tasks = appState.tasks.map((task) =>
    task.id === taskId ? { ...task, snoozedUntil, reminderDone: false } : task,
  );
  saveTasks();
  appState.reminderPromptId = null;
  showToast(`Напоминание отложено до ${formatReminderText(snoozedUntil)}.`);
}

function getSnoozeTime(option) {
  const date = new Date();
  if (option === "10m") date.setMinutes(date.getMinutes() + 10);
  if (option === "1h") date.setHours(date.getHours() + 1);
  if (option === "tomorrow") {
    date.setDate(date.getDate() + 1);
    date.setHours(9, 0, 0, 0);
  }
  return formatDateTimeInput(date);
}

function parseDragPayload(value) {
  try {
    const parsed = JSON.parse(value);
    if (!parsed?.taskId || !isISODate(parsed?.fromDate)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function requestTaskMove(taskId, fromDate, targetDate) {
  if (!taskId || !isISODate(fromDate) || !isISODate(targetDate)) return;
  if (fromDate === targetDate) {
    showToast("Задача уже стоит на этом дне.");
    return;
  }

  const task = appState.tasks.find((item) => item.id === taskId);
  if (!task) return;

  if (task.repeat !== "none" && occursOn(task, fromDate)) {
    appState.pendingMove = { taskId, fromDate, targetDate };
    render();
    return;
  }

  moveTaskToDate(taskId, fromDate, targetDate);
}

function moveTaskToDate(taskId, fromDate, targetDate, options = {}) {
  const task = appState.tasks.find((item) => item.id === taskId);
  if (!task) return;

  if (task.repeat !== "none" && occursOn(task, fromDate)) {
    if (!options.confirmed) {
      appState.pendingMove = { taskId, fromDate, targetDate };
      render();
      return;
    }

    const movedTask = normalizeTask({
      ...task,
      id: crypto.randomUUID(),
      date: targetDate,
      repeat: "none",
      completedDates: isCompleted(task, fromDate) ? [targetDate] : [],
      recurrenceExceptionDates: [],
      sourceTaskId: task.id,
      createdAt: Date.now(),
    });

    appState.tasks = [
      ...appState.tasks.map((item) => (item.id === task.id ? addRecurrenceException(item, fromDate) : item)),
      movedTask,
    ];
  } else {
    appState.tasks = appState.tasks.map((item) => {
      if (item.id !== taskId) return item;
      const completedDates = (item.completedDates || []).map((date) => (date === fromDate ? targetDate : date));
      return { ...item, date: targetDate, completedDates: [...new Set(completedDates)] };
    });
  }

  saveTasks();
  appState.pendingMove = null;
  appState.overloadDate = null;
  appState.selectedDate = targetDate;
  showToast("Задача перенесена. Я сохранила новый фокус дня.");
}

function findNearestLightDay(dateISO) {
  const currentCount = getTasksForDate(dateISO).length;

  for (let offset = 1; offset <= 14; offset += 1) {
    const forward = shiftISO(dateISO, offset);
    if (getTasksForDate(forward).length < Math.min(currentCount, 5)) return forward;
  }

  return shiftISO(dateISO, 1);
}

function focusWeight(focus) {
  const weights = {
    calm: 4,
    urgent: 3,
    important: 2,
    urgentImportant: 1,
  };
  return weights[focus] || 0;
}

function getTasksForDate(dateISO) {
  return appState.tasks
    .filter((task) => occursOn(task, dateISO))
    .map((task) => ({ ...task, occurrenceDate: dateISO }));
}

function getTasksForDates(dateList) {
  return dateList.flatMap((dateISO) => getTasksForDate(dateISO));
}

function applyTaskFilters(tasks, dateISO) {
  const clientSearch = appState.clientSearch.trim().toLocaleLowerCase("ru-RU");

  return tasks.filter((task) => {
    const category = normalizeCategory(task.category);
    const completed = isCompleted(task, dateISO);
    const overdue = isTaskOverdue(task, dateISO);
    const hasReminder = Boolean(task.reminderAt);

    if (appState.focusFilter !== "all" && task.focus !== appState.focusFilter) return false;
    if (appState.clientFilter !== "all" && task.client !== appState.clientFilter) return false;
    if (clientSearch && !task.client.toLocaleLowerCase("ru-RU").includes(clientSearch)) return false;
    if (appState.categoryFilter !== "all" && category !== appState.categoryFilter) return false;
    if (appState.statusFilter === "completed" && !completed) return false;
    if (appState.statusFilter === "pending" && completed) return false;
    if (appState.overdueFilter === "overdue" && !overdue) return false;
    if (appState.overdueFilter === "notOverdue" && overdue) return false;
    if (appState.repeatFilter !== "all" && task.repeat !== appState.repeatFilter) return false;
    if (appState.reminderFilter === "with" && !hasReminder) return false;
    if (appState.reminderFilter === "without" && hasReminder) return false;

    return true;
  });
}

function getActiveFilterCount() {
  return [
    appState.focusFilter !== "all",
    appState.clientFilter !== "all",
    appState.categoryFilter !== "all",
    appState.statusFilter !== "all",
    appState.overdueFilter !== "all",
    appState.repeatFilter !== "all",
    appState.reminderFilter !== "all",
    Boolean(appState.clientSearch.trim()),
  ].filter(Boolean).length;
}

function resetFilters() {
  appState.focusFilter = "all";
  appState.clientFilter = "all";
  appState.categoryFilter = "all";
  appState.statusFilter = "all";
  appState.overdueFilter = "all";
  appState.repeatFilter = "all";
  appState.reminderFilter = "all";
  appState.clientSearch = "";
}

function occursOn(task, dateISO) {
  if (task.recurrenceExceptionDates?.includes(dateISO)) return false;
  if (task.date === dateISO) return true;
  if (task.repeat === "none") return false;

  const base = parseISO(task.date);
  const target = parseISO(dateISO);
  if (target < base) return false;

  if (task.repeat === "weekly") {
    return base.getDay() === target.getDay();
  }

  if (task.repeat === "monthly") {
    return base.getDate() === target.getDate();
  }

  return false;
}

function addRecurrenceException(task, dateISO) {
  if (!isISODate(dateISO)) return task;
  const recurrenceExceptionDates = new Set(task.recurrenceExceptionDates || []);
  recurrenceExceptionDates.add(dateISO);
  return { ...task, recurrenceExceptionDates: [...recurrenceExceptionDates] };
}

function getStats(tasks) {
  const total = tasks.length;
  const work = tasks.filter((task) => normalizeCategory(task.category) === "work").length;
  const self = tasks.filter((task) => normalizeCategory(task.category) === "self").length;
  const together = tasks.filter((task) => normalizeCategory(task.category) === "together").length;
  const personal = self + together;
  const completed = tasks.filter((task) => isCompleted(task, task.occurrenceDate || task.date)).length;
  return { total, work, self, together, personal, completed };
}

function getAnalytics(period, selectedDate, periodTasks) {
  const tasks = periodTasks || getTasksForDates(getPeriodDates(period, selectedDate));
  const stats = getStats(tasks);
  const overdue = tasks.filter((task) => isTaskOverdue(task, task.occurrenceDate || task.date)).length;
  const pending = Math.max(stats.total - stats.completed, 0);
  const completionPercent = stats.total ? Math.round((stats.completed / stats.total) * 100) : 0;
  const busiestDays = getBusiestDays(tasks);

  return {
    period,
    periodLabel: getAnalyticsPeriodLabel(period, selectedDate),
    stats,
    pending,
    overdue,
    completionPercent,
    clientStats: getClientStats(tasks),
    busiestDays,
  };
}

function getPeriodDates(period, selectedDate) {
  if (period === "week") return getWeekDays(selectedDate).map(toISO);
  if (period === "month") return getMonthDays(selectedDate).filter((day) => day.inMonth).map((day) => day.iso);
  return [selectedDate];
}

function getAnalyticsPeriodLabel(period, selectedDate) {
  if (period === "week") {
    const days = getWeekDays(selectedDate);
    return `Неделя ${days[0].getDate()}–${formatDateShort(days[6])}`;
  }

  if (period === "month") {
    return capitalize(new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric" }).format(parseISO(selectedDate)));
  }

  return formatDateShort(parseISO(selectedDate));
}

function getBusiestDays(tasks) {
  const grouped = new Map();
  tasks.forEach((task) => {
    const date = task.occurrenceDate || task.date;
    grouped.set(date, (grouped.get(date) || 0) + 1);
  });

  return [...grouped.entries()]
    .map(([date, count]) => ({ date, count }))
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count || a.date.localeCompare(b.date));
}

function getClientStats(tasks) {
  const grouped = new Map();
  tasks
    .filter((task) => normalizeCategory(task.category) === "work" && task.client)
    .forEach((task) => {
      grouped.set(task.client, (grouped.get(task.client) || 0) + 1);
    });

  return [...grouped.entries()]
    .map(([client, count]) => ({ client, count }))
    .sort((a, b) => b.count - a.count || a.client.localeCompare(b.client, "ru"));
}

function getFocusStats(tasks) {
  return tasks.reduce((stats, task) => {
    stats[task.focus] = (stats[task.focus] || 0) + 1;
    return stats;
  }, {});
}

function getOverdueTasks() {
  const today = todayISO();
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  return appState.tasks.filter((task) => {
    if (task.repeat !== "none") return false;
    if (task.date > today) return false;
    if (isCompleted(task, task.date)) return false;
    if (task.date < today) return true;
    if (task.allDay) return false;
    return timeToMinutes(task.end || task.start) < nowMinutes;
  });
}

function isTaskOverdue(task, dateISO) {
  const today = todayISO();
  if (dateISO > today) return false;
  if (isCompleted(task, dateISO)) return false;
  if (dateISO < today) return true;
  if (task.allDay) return false;

  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  return timeToMinutes(task.end || task.start) < nowMinutes;
}

function isCompleted(task, dateISO) {
  return Boolean(task.completedDates?.includes(dateISO));
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "С добрым утром! У тебя всё под контролем, я присмотрю за деталями.";
  if (hour < 18) return "Ты уже многое успела. Продолжай в своём ритме.";
  return "Отличный день! Ты сделала всё, что было в твоих силах.";
}

function getAffirmation(stats, overdueCount) {
  if (overdueCount) return "Ты просто перераспределяешь фокус. Это мудро.";
  if (!stats.total || stats.completed / stats.total < 0.5) return "Качественный отдых — это тоже часть большого плана.";
  return "Ты невероятно продуктивна. Твоя энергия направлена точно в цель.";
}

function getActiveTasks(tasks, dateISO) {
  if (!isToday(dateISO)) return [];
  const now = new Date();
  const minutes = now.getHours() * 60 + now.getMinutes();
  return tasks.filter((task) => {
    if (isCompleted(task, dateISO)) return false;
    if (task.allDay) return true;
    if (!task.end) return timeToMinutes(task.start) <= minutes;
    return timeToMinutes(task.start) <= minutes && minutes <= timeToMinutes(task.end);
  });
}

function getDeadlineCopy(task) {
  if (task.allDay) return "Эта задача бережно держится в поле дня.";
  if (!task.end) return `Старт в ${task.start}. Без фиксированной длительности.`;

  const end = new Date(`${appState.selectedDate}T${task.end}`);
  const diff = Math.max(0, Math.round((end - new Date()) / 60000));
  if (!isToday(appState.selectedDate)) return `Окно ${task.start} – ${task.end}`;
  if (diff < 60) return `${diff} мин до завершения окна`;
  return `${Math.floor(diff / 60)} ч ${diff % 60} мин до завершения окна`;
}

function getAirBlocks(tasks) {
  const timed = tasks.filter((task) => !task.allDay && task.end).sort(compareTaskTime);
  const blocks = [];

  for (let index = 0; index < timed.length - 1; index += 1) {
    const currentEnd = timeToMinutes(timed[index].end);
    const nextStart = timeToMinutes(timed[index + 1].start);
    if (nextStart - currentEnd > 30) {
      blocks.push({
        afterTaskId: timed[index].id,
        from: minutesToTime(currentEnd),
        to: minutesToTime(nextStart),
      });
    }
  }

  return blocks;
}

function mergeTasksAndAir(tasks, airBlocks) {
  return tasks.map((task) => {
    const block = airBlocks.find((item) => item.afterTaskId === task.id);
    return `${TaskRow(task, appState.selectedDate, true, true)}${block ? AirBlock(block) : ""}`;
  });
}

function drawDonut() {
  const svg = document.querySelector(".donut");
  if (!svg) return;

  const total = Number(svg.dataset.total);
  const work = Number(svg.dataset.work);
  const self = Number(svg.dataset.self);
  const together = Number(svg.dataset.together);
  const completed = Number(svg.dataset.completed);
  const circumference = 2 * Math.PI * 62;
  const auraCircumference = 2 * Math.PI * 78;

  const workCircle = svg.querySelector(".donut-work");
  const selfCircle = svg.querySelector(".donut-self");
  const togetherCircle = svg.querySelector(".donut-together");
  const aura = svg.querySelector(".donut-aura");

  const workLength = total ? (work / total) * circumference : 0;
  const selfLength = total ? (self / total) * circumference : 0;
  const togetherLength = total ? (together / total) * circumference : 0;

  workCircle.style.strokeDasharray = `${workLength} ${circumference}`;
  workCircle.style.strokeDashoffset = "0";
  selfCircle.style.strokeDasharray = `${selfLength} ${circumference}`;
  selfCircle.style.strokeDashoffset = String(-workLength - 2);
  togetherCircle.style.strokeDasharray = `${togetherLength} ${circumference}`;
  togetherCircle.style.strokeDashoffset = String(-workLength - selfLength - 4);
  aura.style.strokeDasharray = `${total ? (completed / total) * auraCircumference : 0} ${auraCircumference}`;
}

function drawWeeklyBars() {
  const bars = document.querySelectorAll(".bar");
  if (!bars.length) return;

  const max = Math.max(...[...bars].map((bar) => Number(bar.dataset.total)), 1);
  bars.forEach((bar) => {
    const total = Number(bar.dataset.total);
    const work = Number(bar.dataset.work);
    const self = Number(bar.dataset.self);
    const together = Number(bar.dataset.together);
    const height = Math.max((total / max) * 130, total ? 22 : 8);
    const workHeight = total ? (work / total) * height : 0;
    const selfHeight = total ? (self / total) * height : 0;
    const togetherHeight = total ? (together / total) * height : 0;
    bar.querySelector(".work").style.height = `${workHeight}px`;
    bar.querySelector(".self").style.height = `${selfHeight}px`;
    bar.querySelector(".together").style.height = `${togetherHeight}px`;
  });
}

function Icon(name) {
  const icons = {
    arrow: '<svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/><path d="M9 12h12"/></svg>',
    filter: '<svg viewBox="0 0 24 24"><path d="M3 5h18"/><path d="M7 12h10"/><path d="M10 19h4"/></svg>',
    x: '<svg viewBox="0 0 24 24"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>',
    briefcase: '<svg viewBox="0 0 24 24"><path d="M10 6h4"/><path d="M8 6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M4 8h16v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z"/><path d="M4 13h16"/></svg>',
    home: '<svg viewBox="0 0 24 24"><path d="m4 11 8-7 8 7"/><path d="M6 10v10h12V10"/><path d="M10 20v-6h4v6"/></svg>',
    user: '<svg viewBox="0 0 24 24"><path d="M20 21a8 8 0 0 0-16 0"/><circle cx="12" cy="7" r="4"/></svg>',
    users: '<svg viewBox="0 0 24 24"><path d="M16 21a6 6 0 0 0-12 0"/><circle cx="10" cy="8" r="4"/><path d="M22 21a5 5 0 0 0-5-5"/><path d="M17 4a3 3 0 0 1 0 6"/></svg>',
    check: '<svg viewBox="0 0 24 24"><path d="m5 12 4 4L19 6"/></svg>',
    chevronLeft: '<svg viewBox="0 0 24 24"><path d="m15 18-6-6 6-6"/></svg>',
    chevronRight: '<svg viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg>',
  };
  return icons[name] || "";
}

function compareTaskTime(a, b) {
  if (a.allDay && !b.allDay) return -1;
  if (!a.allDay && b.allDay) return 1;
  return timeToMinutes(a.start) - timeToMinutes(b.start);
}

function timeToMinutes(time) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(minutes) {
  const hours = String(Math.floor(minutes / 60)).padStart(2, "0");
  const mins = String(minutes % 60).padStart(2, "0");
  return `${hours}:${mins}`;
}

function todayISO() {
  return toISO(new Date());
}

function shiftISO(dateISO, days) {
  const date = parseISO(dateISO);
  date.setDate(date.getDate() + days);
  return toISO(date);
}

function shiftMonthISO(dateISO, months) {
  const date = parseISO(dateISO);
  const day = date.getDate();
  const shifted = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const lastDay = new Date(shifted.getFullYear(), shifted.getMonth() + 1, 0).getDate();
  shifted.setDate(Math.min(day, lastDay));
  return toISO(shifted);
}

function parseISO(dateISO) {
  const [year, month, day] = dateISO.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function toISO(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getWeekDays(dateISO) {
  const date = parseISO(dateISO);
  const day = date.getDay() || 7;
  const monday = new Date(date);
  monday.setDate(date.getDate() - day + 1);
  return Array.from({ length: 7 }, (_, index) => {
    const next = new Date(monday);
    next.setDate(monday.getDate() + index);
    return next;
  });
}

function getMonthDays(dateISO) {
  const selected = parseISO(dateISO);
  const first = new Date(selected.getFullYear(), selected.getMonth(), 1);
  const last = new Date(selected.getFullYear(), selected.getMonth() + 1, 0);
  const startDay = first.getDay() || 7;
  const gridStart = new Date(first);
  gridStart.setDate(first.getDate() - startDay + 1);
  const endDay = last.getDay() || 7;
  const totalDays = (last.getDate() + startDay - 1) + (7 - endDay);

  return Array.from({ length: totalDays }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    return {
      iso: toISO(date),
      inMonth: date.getMonth() === selected.getMonth(),
    };
  });
}

function isToday(dateISO) {
  return dateISO === todayISO();
}

function formatDateFull(date) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    weekday: "long",
  }).format(date);
}

function formatDateShort(date) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
  }).format(date);
}

function formatWeekday(date, weekday = "long") {
  return new Intl.DateTimeFormat("ru-RU", { weekday }).format(date).replace(".", "");
}

function formatCurrentTime() {
  return new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());
}

function defaultReminderValue(task) {
  const baseTime = task.allDay ? "09:00" : task.start || "09:00";
  const date = new Date(`${task.date}T${baseTime}`);
  if (!task.allDay) {
    date.setMinutes(date.getMinutes() - 15);
  }
  return formatDateTimeInput(date);
}

function formatReminderText(value) {
  const date = new Date(value);
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatDateTimeInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function declOfNum(number, titles) {
  const cases = [2, 0, 1, 1, 1, 2];
  return titles[number % 100 > 4 && number % 100 < 20 ? 2 : cases[Math.min(number % 10, 5)]];
}

function escapeHTML(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHTML(value);
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("./sw.js").catch(() => {
    // PWA-режим необязателен для работы локального планировщика.
  });
}

render();
registerServiceWorker();
window.setInterval(checkReminders, 30000);
