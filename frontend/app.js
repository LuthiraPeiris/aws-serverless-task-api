/**
 * TaskFlow Quest - Frontend Application Script
 * Full Two-Page SPA Implementation (Dashboard & AI Planner)
 * Backed by AWS API Gateway, Lambda, DynamoDB, and Amazon Bedrock
 */

const API_URL = "https://emx62ryde0.execute-api.ap-south-1.amazonaws.com";
const XP_PER_TASK = 20;

// =============================================================================
// DOM Elements Selection
// =============================================================================

// Navigation & Views
const navDashboard = document.getElementById("nav-dashboard");
const navPlanner = document.getElementById("nav-planner");
const dashboardView = document.getElementById("dashboard-view");
const plannerView = document.getElementById("planner-view");
const sidebarQuote = document.getElementById("sidebar-quote");
const mobileMenuBtn = document.getElementById("mobile-menu-btn");
const sidebarCloseBtn = document.getElementById("sidebar-close-btn");
const appSidebar = document.getElementById("app-sidebar");
const sidebarOverlay = document.getElementById("sidebar-overlay");

// Topbar Status
const connectionStatus = document.getElementById("connection-status");
const connectionText = document.getElementById("connection-text");
const globalMessage = document.getElementById("message");
const notificationBtn = document.getElementById("notification-btn");

// Dashboard Stat Cards
const questLevelCard = document.getElementById("quest-level-card");
const questLevelTier = document.getElementById("quest-level-tier");
const questLevelTitle = document.getElementById("quest-level-title");
const questXpDisplay = document.getElementById("quest-xp-display");
const questProgressbar = document.getElementById("quest-progressbar");
const questProgressFill = document.getElementById("quest-progress-fill");
const questProgressText = document.getElementById("quest-progress-text");
const totalTasksEl = document.getElementById("total-tasks");
const completedTasksCountEl = document.getElementById("completed-tasks-count");
const completionRateEl = document.getElementById("completion-rate");

// Dashboard Task Controls & List
const taskSearchInput = document.getElementById("task-search-input");
const openAddTaskModalBtn = document.getElementById("open-add-task-modal-btn");
const filterTabAll = document.getElementById("filter-tab-all");
const filterTabActive = document.getElementById("filter-tab-active");
const filterTabCompleted = document.getElementById("filter-tab-completed");
const filterCountAll = document.getElementById("filter-count-all");
const filterCountActive = document.getElementById("filter-count-active");
const filterCountCompleted = document.getElementById("filter-count-completed");
const taskList = document.getElementById("task-list");

// Dashboard Progress & Badges Panel
const progressDonutMeter = document.getElementById("progress-donut-meter");
const donutFraction = document.getElementById("donut-fraction");
const badgeFirstStep = document.getElementById("badge-first-step");
const badgeHighFive = document.getElementById("badge-high-five");
const badgeTaskExplorer = document.getElementById("badge-task-explorer");
const badgeProdChampion = document.getElementById("badge-prod-champion");

// AI Planner Elements
const planForm = document.getElementById("plan-form");
const planGoalInput = document.getElementById("plan-goal");
const goalCharCount = document.getElementById("goal-char-count");
const generatePlanButton = document.getElementById("generate-plan-button");
const generateButtonText = document.getElementById("generate-button-text");
const planMessageElement = document.getElementById("plan-message");
const planEmptyState = document.getElementById("plan-empty-state");
const planOutput = document.getElementById("plan-output");
const planTaskList = document.getElementById("plan-task-list");
const planSelectAllCheckbox = document.getElementById("plan-select-all-checkbox");
const addSelectedButton = document.getElementById("add-selected-button");
const goalChips = document.querySelectorAll(".goal-chip");

// Modals
const addTaskModal = document.getElementById("add-task-modal");
const closeAddModalBtn = document.getElementById("close-add-modal-btn");
const cancelAddTaskBtn = document.getElementById("cancel-add-task-btn");
const taskForm = document.getElementById("task-form");
const taskTitleInput = document.getElementById("task-title");
const taskPrioritySelect = document.getElementById("task-priority-select");
const taskDueDateInput = document.getElementById("task-due-date");
const addTaskSubmitBtn = document.getElementById("add-task-button");

const editTaskModal = document.getElementById("edit-task-modal");
const closeEditModalBtn = document.getElementById("close-edit-modal-btn");
const cancelEditTaskBtn = document.getElementById("cancel-edit-task-btn");
const editTaskForm = document.getElementById("edit-task-form");
const editTaskIdInput = document.getElementById("edit-task-id");
const editTaskTitleInput = document.getElementById("edit-task-title");
const editTaskPrioritySelect = document.getElementById("edit-task-priority");
const editTaskDueInput = document.getElementById("edit-task-due");

// Toast Notifications Container
const questToastContainer = document.getElementById("quest-toast-container");

// =============================================================================
// Application State
// =============================================================================
let currentTasks = [];
let currentFilter = "all"; // 'all' | 'active' | 'completed'
let searchQuery = "";
const completedTaskIds = new Set();
const pendingTaskUpdates = new Set();
const unlockedBadgeIds = new Set();
let currentLevelName = "Beginner";

// Client metadata store (for Priority & Due Date persistence across sessions)
const TASK_META_KEY = "taskflow_tasks_meta";
function loadTaskMeta() {
    try {
        const raw = localStorage.getItem(TASK_META_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch {
        return {};
    }
}

function saveTaskMeta(meta) {
    try {
        localStorage.setItem(TASK_META_KEY, JSON.stringify(meta));
    } catch (e) {
        console.warn("Could not save task metadata to localStorage:", e);
    }
}

let taskMetadataStore = loadTaskMeta();

function getTaskMetadata(task, index = 0) {
    if (taskMetadataStore[task.id]) {
        return taskMetadataStore[task.id];
    }
    // Generate deterministic default priority and date if none exists
    const priorities = ["High", "Medium", "Low", "Medium", "High"];
    const priority = priorities[index % priorities.length];
    
    // Default due date from createdAt + 3 days
    const created = new Date(task.createdAt);
    const dueDateObj = Number.isNaN(created.getTime()) ? new Date() : new Date(created.getTime() + 86400000 * 3);
    const dueDateStr = dueDateObj.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    const rawDateStr = dueDateObj.toISOString().split("T")[0];

    const meta = { priority, dueDate: dueDateStr, rawDueDate: rawDateStr };
    taskMetadataStore[task.id] = meta;
    saveTaskMeta(taskMetadataStore);
    return meta;
}

// =============================================================================
// Helper Utilities & Notifications
// =============================================================================

function showToast(title, description, icon = "⭐", variant = "") {
    if (!questToastContainer) return;

    const toast = document.createElement("div");
    toast.className = `quest-toast ${variant}`.trim();

    const iconSpan = document.createElement("span");
    iconSpan.className = "quest-toast-icon";
    iconSpan.textContent = icon;

    const bodyDiv = document.createElement("div");
    bodyDiv.className = "quest-toast-body";

    const titleEl = document.createElement("h5");
    titleEl.className = "quest-toast-title";
    titleEl.textContent = title;

    const descEl = document.createElement("p");
    descEl.className = "quest-toast-desc";
    descEl.textContent = description;

    bodyDiv.append(titleEl, descEl);

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "quest-toast-close";
    closeBtn.setAttribute("aria-label", "Close notification");
    closeBtn.textContent = "×";
    closeBtn.addEventListener("click", () => {
        toast.classList.add("toast-fade-out");
        setTimeout(() => toast.remove(), 250);
    });

    toast.append(iconSpan, bodyDiv, closeBtn);
    questToastContainer.appendChild(toast);

    setTimeout(() => {
        if (toast.isConnected) {
            toast.classList.add("toast-fade-out");
            setTimeout(() => toast.remove(), 250);
        }
    }, 4500);
}

function showGlobalMessage(message, type = "info") {
    if (!globalMessage) return;
    globalMessage.textContent = message;
    globalMessage.className = `global-banner-message ${type}`;
    globalMessage.hidden = false;
    setTimeout(() => {
        if (globalMessage.textContent === message) {
            globalMessage.hidden = true;
        }
    }, 5000);
}

function triggerFloatingXpReward(targetElement, text = "+20 XP") {
    if (!targetElement) return;
    const pill = document.createElement("div");
    pill.className = "floating-xp-pill";
    pill.textContent = text;
    targetElement.appendChild(pill);

    setTimeout(() => {
        if (pill.isConnected) pill.remove();
    }, 1200);
}

function updateConnectionStatus(connected) {
    if (!connectionStatus || !connectionText) return;
    connectionStatus.classList.toggle("disconnected", !connected);
    connectionText.textContent = connected ? "AWS Connected" : "Connection Offline";
}

// API Request Wrapper
async function apiRequest(path, options = {}) {
    const response = await fetch(`${API_URL}${path}`, options);
    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message || `API request failed with status ${response.status}`);
    }
    return data;
}

// =============================================================================
// Navigation & SPA Router
// =============================================================================

function switchView(viewName) {
    const isDashboard = viewName === "dashboard";

    if (isDashboard) {
        dashboardView.hidden = false;
        dashboardView.classList.add("active");
        plannerView.hidden = true;
        plannerView.classList.remove("active");

        navDashboard.classList.add("active");
        navPlanner.classList.remove("active");

        if (sidebarQuote) {
            sidebarQuote.textContent = '"Small steps today, bigger adventures tomorrow."';
        }
    } else {
        dashboardView.hidden = true;
        dashboardView.classList.remove("active");
        plannerView.hidden = false;
        plannerView.classList.add("active");

        navDashboard.classList.remove("active");
        navPlanner.classList.add("active");

        if (sidebarQuote) {
            sidebarQuote.textContent = '"Big goals start with a single step."';
        }
    }

    // Close mobile sidebar if open
    closeMobileSidebar();

    // Update URL hash without reload
    window.location.hash = isDashboard ? "#dashboard" : "#planner";
}

function openMobileSidebar() {
    appSidebar.classList.add("open");
    sidebarOverlay.classList.add("active");
}

function closeMobileSidebar() {
    appSidebar.classList.remove("open");
    sidebarOverlay.classList.remove("active");
}

navDashboard.addEventListener("click", () => switchView("dashboard"));
navPlanner.addEventListener("click", () => switchView("planner"));

if (mobileMenuBtn) mobileMenuBtn.addEventListener("click", openMobileSidebar);
if (sidebarCloseBtn) sidebarCloseBtn.addEventListener("click", closeMobileSidebar);
if (sidebarOverlay) sidebarOverlay.addEventListener("click", closeMobileSidebar);

// Restore view from URL hash on load
window.addEventListener("hashchange", () => {
    const hash = window.location.hash.toLowerCase();
    if (hash === "#planner") {
        switchView("planner");
    } else {
        switchView("dashboard");
    }
});

// =============================================================================
// Gamification Engine (XP, Levels, Badges, Donut Chart)
// =============================================================================

function computeQuestProfile(completedCount) {
    const count = Math.max(0, completedCount);
    const totalXp = count * XP_PER_TASK;

    let levelName = "Beginner";
    let tierText = "Level 1";
    let progressPercent = 0;
    let progressText = "";
    let xpDisplay = `${totalXp} / 100 XP`;

    if (totalXp >= 200) {
        levelName = "Productivity Champion";
        tierText = "Level 3";
        progressPercent = 100;
        progressText = "Max level achieved! 🏆";
        xpDisplay = `${totalXp} XP (Mastered)`;
    } else if (totalXp >= 100) {
        levelName = "Task Explorer";
        tierText = "Level 2";
        const needed = 200 - totalXp;
        progressPercent = Math.min(100, Math.round(((totalXp - 100) / 100) * 100));
        progressText = `${needed} XP to reach Level 3`;
        xpDisplay = `${totalXp} / 200 XP`;
    } else {
        levelName = "Beginner";
        tierText = "Level 1";
        const needed = 100 - totalXp;
        progressPercent = Math.min(100, Math.round((totalXp / 100) * 100));
        progressText = `${needed} XP to reach Level 2`;
        xpDisplay = `${totalXp} / 100 XP`;
    }

    const firstStepUnlocked = count >= 1;
    const highFiveUnlocked = count >= 5;
    const taskExplorerUnlocked = totalXp >= 100;
    const prodChampionUnlocked = totalXp >= 200;

    return {
        totalXp,
        completedCount: count,
        levelName,
        tierText,
        progressPercent,
        progressText,
        xpDisplay,
        badges: {
            firstStep: firstStepUnlocked,
            highFive: highFiveUnlocked,
            taskExplorer: taskExplorerUnlocked,
            prodChampion: prodChampionUnlocked
        }
    };
}

function updateGamificationDisplay(questData) {
    if (questLevelTier) questLevelTier.textContent = questData.tierText;
    if (questLevelTitle) questLevelTitle.textContent = questData.levelName;
    if (questXpDisplay) questXpDisplay.textContent = questData.xpDisplay;
    if (questProgressText) questProgressText.textContent = questData.progressText;

    if (questProgressFill) {
        questProgressFill.style.width = `${questData.progressPercent}%`;
    }
    if (questProgressbar) {
        questProgressbar.setAttribute("aria-valuenow", questData.progressPercent);
    }

    // Update 4 Achievements Badges
    updateBadgeElement(badgeFirstStep, questData.badges.firstStep);
    updateBadgeElement(badgeHighFive, questData.badges.highFive);
    updateBadgeElement(badgeTaskExplorer, questData.badges.taskExplorer);
    updateBadgeElement(badgeProdChampion, questData.badges.prodChampion);

    // Update Circular Donut Chart
    const totalCount = currentTasks.length;
    const completedCount = questData.completedCount;
    if (donutFraction) {
        donutFraction.textContent = `${completedCount}/${totalCount}`;
    }

    if (progressDonutMeter) {
        // Circumference for r=50 is 2 * PI * 50 = ~314.159
        const circumference = 314.159;
        const rate = totalCount > 0 ? completedCount / totalCount : 0;
        const offset = circumference - rate * circumference;
        progressDonutMeter.style.strokeDashoffset = `${offset}`;
    }

    // Update Total Tasks, Completed, and Rate Cards
    if (totalTasksEl) totalTasksEl.textContent = totalCount;
    if (completedTasksCountEl) completedTasksCountEl.textContent = completedCount;
    if (completionRateEl) {
        const ratePct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
        completionRateEl.textContent = `${ratePct}%`;
    }
}

function updateBadgeElement(badgeEl, isUnlocked) {
    if (!badgeEl) return;
    badgeEl.classList.toggle("unlocked", isUnlocked);
}

function checkMilestones(questData, isCompleting = true) {
    if (!isCompleting) {
        currentLevelName = questData.levelName;
        unlockedBadgeIds.clear();
        Object.entries(questData.badges).forEach(([id, unlocked]) => {
            if (unlocked) unlockedBadgeIds.add(id);
        });
        return;
    }

    const rankMap = { "Beginner": 1, "Task Explorer": 2, "Productivity Champion": 3 };
    if (currentLevelName && rankMap[questData.levelName] > rankMap[currentLevelName]) {
        showToast(
            "Level Up! 🎉",
            `You advanced to ${questData.levelName}! Outstanding accomplishment!`,
            "🏆",
            "toast-level-up"
        );
    }
    currentLevelName = questData.levelName;

    const badgeLabels = {
        firstStep: "First Step: Completed 1 task!",
        highFive: "High Five: Completed 5 tasks!",
        taskExplorer: "Task Explorer: Reached 100 XP milestone!",
        prodChampion: "Productivity Champion: Master of Tasks (200 XP)!"
    };

    Object.entries(questData.badges).forEach(([id, unlocked]) => {
        if (unlocked && !unlockedBadgeIds.has(id)) {
            unlockedBadgeIds.add(id);
            showToast("Achievement Unlocked! 🎖️", badgeLabels[id] || id, "🌟", "toast-badge");
        } else if (!unlocked && unlockedBadgeIds.has(id)) {
            unlockedBadgeIds.delete(id);
        }
    });
}

// =============================================================================
// Task Management (Fetch, Filter, Render, Toggle, Add, Edit, Delete)
// =============================================================================

async function loadTasks() {
    taskList.replaceChildren();

    const loadingEl = document.createElement("div");
    loadingEl.className = "loading-state";
    loadingEl.innerHTML = `<div class="spinner"></div><p>Loading your tasks...</p>`;
    taskList.appendChild(loadingEl);

    try {
        const data = await apiRequest("/tasks");
        currentTasks = Array.isArray(data.tasks) ? data.tasks : [];

        updateConnectionStatus(true);

        // Sync completed IDs
        completedTaskIds.clear();
        currentTasks.forEach((t) => {
            if (t.completed) completedTaskIds.add(t.id);
        });

        // Update gamification numbers
        const questData = computeQuestProfile(completedTaskIds.size);
        checkMilestones(questData, false);
        updateGamificationDisplay(questData);

        renderTasks();
    } catch (error) {
        console.error("Failed to fetch tasks:", error);
        updateConnectionStatus(false);
        taskList.replaceChildren();

        const errorEl = document.createElement("div");
        errorEl.className = "empty-state";
        errorEl.innerHTML = `<p>Unable to connect to AWS task service.<br><small>${error.message}</small></p>`;
        taskList.appendChild(errorEl);
        showGlobalMessage("Could not load tasks from AWS. Please retry.", "error");
    }
}

function renderTasks() {
    taskList.replaceChildren();

    // Sort newest first
    currentTasks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Calculate filter counts
    const totalCount = currentTasks.length;
    const activeCount = currentTasks.filter(t => !t.completed).length;
    const completedCount = currentTasks.filter(t => t.completed).length;

    if (filterCountAll) filterCountAll.textContent = totalCount;
    if (filterCountActive) filterCountActive.textContent = activeCount;
    if (filterCountCompleted) filterCountCompleted.textContent = completedCount;

    // Apply active filter and search query
    let filtered = currentTasks.filter(task => {
        if (currentFilter === "active" && task.completed) return false;
        if (currentFilter === "completed" && !task.completed) return false;
        if (searchQuery) {
            return task.title.toLowerCase().includes(searchQuery.toLowerCase());
        }
        return true;
    });

    if (filtered.length === 0) {
        const emptyEl = document.createElement("div");
        emptyEl.className = "empty-state";
        if (searchQuery) {
            emptyEl.textContent = `No tasks matching "${searchQuery}"`;
        } else if (currentFilter === "active") {
            emptyEl.textContent = "No active tasks! All caught up.";
        } else if (currentFilter === "completed") {
            emptyEl.textContent = "No completed tasks yet. Finish a task to earn XP!";
        } else {
            emptyEl.textContent = "No tasks yet. Create one with '+ Add Task' or generate a plan with AI Planner!";
        }
        taskList.appendChild(emptyEl);
        return;
    }

    filtered.forEach((task, index) => {
        const row = createTaskRowElement(task, index);
        taskList.appendChild(row);
    });
}

function createTaskRowElement(task, index) {
    const meta = getTaskMetadata(task, index);
    const isCompleted = Boolean(task.completed);

    const row = document.createElement("article");
    row.className = `task-row ${isCompleted ? "completed" : ""}`;
    row.dataset.taskId = task.id;

    // 1. Circular Checkbox button
    const colCheck = document.createElement("div");
    colCheck.className = "col-check";

    const checkBtn = document.createElement("button");
    checkBtn.type = "button";
    checkBtn.className = "custom-checkbox-btn";
    checkBtn.setAttribute("aria-label", `Mark "${task.title}" as ${isCompleted ? "incomplete" : "complete"}`);
    checkBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="20 6 9 17 4 12"/></svg>`;
    checkBtn.addEventListener("click", () => handleTaskToggle(task, row, checkBtn));

    colCheck.appendChild(checkBtn);

    // 2. Title
    const colTitle = document.createElement("div");
    colTitle.className = "col-title";
    colTitle.textContent = task.title;
    colTitle.title = task.title;

    // 3. Priority Pill
    const colPriority = document.createElement("div");
    colPriority.className = "col-priority";
    const priorityPill = document.createElement("span");
    const priorityClass = `priority-${(meta.priority || "medium").toLowerCase()}`;
    priorityPill.className = `priority-pill ${priorityClass}`;
    priorityPill.textContent = meta.priority || "Medium";
    colPriority.appendChild(priorityPill);

    // 4. Due Date
    const colDue = document.createElement("div");
    colDue.className = "col-due";
    colDue.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg><span>${meta.dueDate || "No date"}</span>`;

    // 5. XP Tag
    const colXp = document.createElement("div");
    colXp.className = "col-xp";
    colXp.innerHTML = `<span class="xp-tag-pill">+20 XP</span>`;

    // 6. Action buttons (Edit & Delete)
    const colActions = document.createElement("div");
    colActions.className = "col-actions";

    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "action-icon-btn btn-edit";
    editBtn.setAttribute("aria-label", `Edit task: ${task.title}`);
    editBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>`;
    editBtn.addEventListener("click", () => openEditModal(task, meta));

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "action-icon-btn btn-delete";
    deleteBtn.setAttribute("aria-label", `Delete task: ${task.title}`);
    deleteBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`;
    deleteBtn.addEventListener("click", () => handleDeleteTask(task, row));

    colActions.append(editBtn, deleteBtn);

    row.append(colCheck, colTitle, colPriority, colDue, colXp, colActions);
    return row;
}

// Checkbox Toggle (PATCH /tasks/{id})
async function handleTaskToggle(task, rowEl, buttonEl) {
    if (pendingTaskUpdates.has(task.id)) return;

    const willBeCompleted = !task.completed;
    pendingTaskUpdates.add(task.id);
    buttonEl.disabled = true;

    try {
        const response = await apiRequest(`/tasks/${encodeURIComponent(task.id)}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ completed: willBeCompleted })
        });

        task.completed = response?.task?.completed !== undefined ? Boolean(response.task.completed) : willBeCompleted;

        rowEl.classList.toggle("completed", task.completed);
        buttonEl.setAttribute("aria-label", `Mark "${task.title}" as ${task.completed ? "incomplete" : "complete"}`);

        if (task.completed) {
            completedTaskIds.add(task.id);
            triggerFloatingXpReward(rowEl, "+20 XP");
        } else {
            completedTaskIds.delete(task.id);
        }

        const questData = computeQuestProfile(completedTaskIds.size);
        updateGamificationDisplay(questData);
        checkMilestones(questData, task.completed);

        // Update tab count numbers
        const activeCount = currentTasks.filter(t => !t.completed).length;
        const completedCount = currentTasks.filter(t => t.completed).length;
        if (filterCountActive) filterCountActive.textContent = activeCount;
        if (filterCountCompleted) filterCountCompleted.textContent = completedCount;

        // If currently filtered on active or completed, re-render smoothly
        if (currentFilter !== "all") {
            setTimeout(renderTasks, 400);
        }
    } catch (error) {
        console.error("Toggle task completion failed:", error);
        showGlobalMessage(error.message || "Failed to update task completion on AWS.", "error");
    } finally {
        pendingTaskUpdates.delete(task.id);
        buttonEl.disabled = false;
    }
}

// Delete Task (DELETE /tasks/{id})
async function handleDeleteTask(task, rowEl) {
    if (!confirm(`Are you sure you want to delete "${task.title}"?`)) return;

    try {
        rowEl.style.opacity = "0.4";
        await apiRequest(`/tasks/${encodeURIComponent(task.id)}`, { method: "DELETE" });

        // Remove from memory
        currentTasks = currentTasks.filter(t => t.id !== task.id);
        completedTaskIds.delete(task.id);
        delete taskMetadataStore[task.id];
        saveTaskMeta(taskMetadataStore);

        // Update gamification display
        const questData = computeQuestProfile(completedTaskIds.size);
        updateGamificationDisplay(questData);

        showToast("Task Deleted", `"${task.title}" was removed.`, "🗑️");
        renderTasks();
    } catch (error) {
        rowEl.style.opacity = "1";
        console.error("Delete task failed:", error);
        showGlobalMessage(error.message || "Could not delete task from AWS.", "error");
    }
}

// Filter Tabs Handling
function setFilter(filterName) {
    currentFilter = filterName;
    [filterTabAll, filterTabActive, filterTabCompleted].forEach(tab => {
        if (tab) tab.classList.toggle("active", tab.dataset.filter === filterName);
    });
    renderTasks();
}

if (filterTabAll) filterTabAll.addEventListener("click", () => setFilter("all"));
if (filterTabActive) filterTabActive.addEventListener("click", () => setFilter("active"));
if (filterTabCompleted) filterTabCompleted.addEventListener("click", () => setFilter("completed"));

// Search Input Handling
if (taskSearchInput) {
    taskSearchInput.addEventListener("input", (e) => {
        searchQuery = e.target.value.trim();
        renderTasks();
    });
}

// =============================================================================
// Modals: Add Task & Edit Task
// =============================================================================

function openAddModal() {
    taskForm.reset();
    // Default due date to today + 3 days in the picker
    const defaultDate = new Date(Date.now() + 86400000 * 3).toISOString().split("T")[0];
    taskDueDateInput.value = defaultDate;
    addTaskModal.hidden = false;
    taskTitleInput.focus();
}

function closeAddModal() {
    addTaskModal.hidden = true;
}

if (openAddTaskModalBtn) openAddTaskModalBtn.addEventListener("click", openAddModal);
if (closeAddModalBtn) closeAddModalBtn.addEventListener("click", closeAddModal);
if (cancelAddTaskBtn) cancelAddTaskBtn.addEventListener("click", closeAddModal);

addTaskModal.addEventListener("click", (e) => {
    if (e.target === addTaskModal) closeAddModal();
});

// Create Task Submission (POST /tasks)
taskForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const title = taskTitleInput.value.trim();
    if (!title) return;

    const priority = taskPrioritySelect.value;
    const rawDue = taskDueDateInput.value;
    let formattedDue = "No date";
    if (rawDue) {
        const parts = rawDue.split("-");
        if (parts.length === 3) {
            const dateObj = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
            formattedDue = dateObj.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
        }
    }

    addTaskSubmitBtn.disabled = true;
    addTaskSubmitBtn.textContent = "Creating...";

    try {
        const response = await apiRequest("/tasks", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title })
        });

        const createdTask = response.task || {
            id: response.id || `task-${Date.now()}`,
            title,
            completed: false,
            createdAt: new Date().toISOString()
        };

        // Save metadata
        taskMetadataStore[createdTask.id] = {
            priority,
            dueDate: formattedDue,
            rawDueDate: rawDue
        };
        saveTaskMeta(taskMetadataStore);

        closeAddModal();
        showToast("Task Created! ✨", `"${title}" has been added.`, "📝");

        await loadTasks();
    } catch (error) {
        console.error("Create task failed:", error);
        showGlobalMessage(error.message || "Failed to create task on AWS.", "error");
    } finally {
        addTaskSubmitBtn.disabled = false;
        addTaskSubmitBtn.textContent = "Add Task";
    }
});

// Edit Modal
function openEditModal(task, meta) {
    editTaskIdInput.value = task.id;
    editTaskTitleInput.value = task.title;
    editTaskPrioritySelect.value = meta.priority || "Medium";
    editTaskDueInput.value = meta.rawDueDate || "";
    editTaskModal.hidden = false;
    editTaskTitleInput.focus();
}

function closeEditModal() {
    editTaskModal.hidden = true;
}

if (closeEditModalBtn) closeEditModalBtn.addEventListener("click", closeEditModal);
if (cancelEditTaskBtn) cancelEditTaskBtn.addEventListener("click", closeEditModal);

editTaskModal.addEventListener("click", (e) => {
    if (e.target === editTaskModal) closeEditModal();
});

editTaskForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const taskId = editTaskIdInput.value;
    const task = currentTasks.find(t => t.id === taskId);
    if (!task) return;

    const newPriority = editTaskPrioritySelect.value;
    const rawDue = editTaskDueInput.value;
    let formattedDue = "No date";
    if (rawDue) {
        const parts = rawDue.split("-");
        if (parts.length === 3) {
            const dateObj = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
            formattedDue = dateObj.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
        }
    }

    // Update metadata
    taskMetadataStore[taskId] = {
        priority: newPriority,
        dueDate: formattedDue,
        rawDueDate: rawDue
    };
    saveTaskMeta(taskMetadataStore);

    closeEditModal();
    showToast("Task Updated", `Preferences for "${task.title}" saved.`, "✏️");
    renderTasks();
});

// =============================================================================
// AI Task Planner Implementation (Amazon Bedrock POST /plan -> POST /tasks)
// =============================================================================

// Character counter
if (planGoalInput && goalCharCount) {
    planGoalInput.addEventListener("input", () => {
        const length = planGoalInput.value.length;
        goalCharCount.textContent = `${length}/500`;
    });
}

// Example chips click
goalChips.forEach(chip => {
    chip.addEventListener("click", () => {
        const text = chip.dataset.example;
        if (text && planGoalInput) {
            planGoalInput.value = text;
            if (goalCharCount) goalCharCount.textContent = `${text.length}/500`;
            planGoalInput.focus();
        }
    });
});

function showPlanMessage(text, type = "info") {
    if (!planMessageElement) return;
    planMessageElement.textContent = text;
    planMessageElement.className = `plan-status-message ${type}`;
    planMessageElement.hidden = false;
}

function hidePlanMessage() {
    if (!planMessageElement) return;
    planMessageElement.hidden = true;
    planMessageElement.textContent = "";
}

function isValidPlan(plan) {
    return (
        plan !== null &&
        typeof plan === "object" &&
        Array.isArray(plan.tasks) &&
        plan.tasks.length > 0 &&
        plan.tasks.every(t => typeof t.title === "string" && t.title.trim().length > 0)
    );
}

// Generate Plan Handler
planForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const goal = planGoalInput.value.trim();
    if (!goal) return;

    hidePlanMessage();
    generatePlanButton.disabled = true;
    generateButtonText.textContent = "AI Planning with Bedrock...";
    planGoalInput.disabled = true;

    try {
        const data = await apiRequest("/plan", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ goal })
        });

        if (!data || !isValidPlan(data.plan)) {
            throw new Error("Received an unexpected plan format from AI service. Please retry.");
        }

        renderGeneratedPlan(data.plan);
        showPlanMessage(`Generated 5 customized steps for: "${goal}"`, "success");
    } catch (error) {
        console.error("AI Plan generation failed:", error);
        showPlanMessage(error.message || "Failed to generate plan using Amazon Bedrock.", "error");
    } finally {
        generatePlanButton.disabled = false;
        generateButtonText.textContent = "Generate Plan →";
        planGoalInput.disabled = false;
    }
});

function renderGeneratedPlan(plan) {
    planTaskList.replaceChildren();

    const priorityTiers = ["High", "High", "Medium", "Medium", "Low"];

    plan.tasks.forEach((task, index) => {
        const priority = priorityTiers[index] || "Medium";
        const priorityClass = `priority-${priority.toLowerCase()}`;

        const li = document.createElement("li");
        li.className = "plan-task-item";

        // Checkbox
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.className = "plan-task-checkbox";
        checkbox.id = `plan-task-chk-${index}`;
        checkbox.checked = true; // Selected by default as shown in reference
        checkbox.dataset.taskTitle = task.title;
        checkbox.dataset.priority = priority;
        checkbox.addEventListener("change", syncAddSelectedButton);

        // Content meta
        const metaDiv = document.createElement("div");
        metaDiv.className = "plan-task-meta";

        const titleText = document.createElement("span");
        titleText.className = "plan-task-title-text";
        titleText.textContent = task.title;

        const priorityPill = document.createElement("span");
        priorityPill.className = `priority-pill ${priorityClass}`;
        priorityPill.textContent = priority;

        metaDiv.append(titleText, priorityPill);

        // Drag icon indicator
        const dragHandle = document.createElement("span");
        dragHandle.className = "plan-task-drag-handle";
        dragHandle.setAttribute("aria-hidden", "true");
        dragHandle.textContent = "⋮⋮";

        li.append(checkbox, metaDiv, dragHandle);
        planTaskList.appendChild(li);
    });

    // Reveal output
    if (planEmptyState) planEmptyState.hidden = true;
    if (planOutput) planOutput.hidden = false;
    if (planSelectAllCheckbox) planSelectAllCheckbox.checked = true;

    syncAddSelectedButton();
}

function syncAddSelectedButton() {
    const checked = planTaskList.querySelectorAll(".plan-task-checkbox:checked");
    const total = planTaskList.querySelectorAll(".plan-task-checkbox");
    addSelectedButton.disabled = checked.length === 0;

    if (planSelectAllCheckbox) {
        planSelectAllCheckbox.checked = total.length > 0 && checked.length === total.length;
    }
}

if (planSelectAllCheckbox) {
    planSelectAllCheckbox.addEventListener("change", (e) => {
        const checkboxes = planTaskList.querySelectorAll(".plan-task-checkbox");
        checkboxes.forEach(cb => { cb.checked = e.target.checked; });
        syncAddSelectedButton();
    });
}

// Add Selected Tasks to Dashboard
addSelectedButton.addEventListener("click", async () => {
    const checkedBoxes = [...planTaskList.querySelectorAll(".plan-task-checkbox:checked")];
    if (checkedBoxes.length === 0) return;

    addSelectedButton.disabled = true;
    addSelectedButton.textContent = "Adding Tasks to Dashboard...";
    generatePlanButton.disabled = true;
    hidePlanMessage();

    const saved = [];
    const failed = [];

    for (const checkbox of checkedBoxes) {
        const title = checkbox.dataset.taskTitle;
        const priority = checkbox.dataset.priority || "Medium";

        try {
            const response = await apiRequest("/tasks", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title })
            });

            const taskId = response?.task?.id || response?.id;
            if (taskId) {
                // Save priority metadata
                const dueDateObj = new Date(Date.now() + 86400000 * 3);
                taskMetadataStore[taskId] = {
                    priority,
                    dueDate: dueDateObj.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
                    rawDueDate: dueDateObj.toISOString().split("T")[0]
                };
                saveTaskMeta(taskMetadataStore);
            }

            saved.push(title);
            checkbox.checked = false; // Uncheck on success to prevent duplication
        } catch (error) {
            console.error(`Failed to save task "${title}":`, error);
            failed.push(title);
        }
    }

    // Refresh Dashboard tasks in the background
    if (saved.length > 0) {
        await loadTasks();
    }

    if (failed.length === 0) {
        showPlanMessage(`Successfully added all ${saved.length} tasks to your Dashboard! 🎉`, "success");
        showToast("Tasks Added! 🚀", `${saved.length} tasks added to your Dashboard.`, "✅");
    } else {
        showPlanMessage(`${saved.length} tasks added. ${failed.length} failed — failed tasks remain selected to retry.`, "error");
    }

    addSelectedButton.disabled = false;
    addSelectedButton.innerHTML = `<span class="plus-sign" aria-hidden="true">+</span> Add Selected Tasks to Dashboard`;
    generatePlanButton.disabled = false;
    syncAddSelectedButton();
});

// =============================================================================
// Initialization
// =============================================================================
document.addEventListener("DOMContentLoaded", () => {
    // Initial routing check
    if (window.location.hash.toLowerCase() === "#planner") {
        switchView("planner");
    } else {
        switchView("dashboard");
    }

    // Load tasks from AWS
    loadTasks();
});
