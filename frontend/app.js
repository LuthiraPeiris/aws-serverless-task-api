
const API_URL = "https://emx62ryde0.execute-api.ap-south-1.amazonaws.com";

// HTML elements
const taskForm = document.getElementById("task-form");
const taskTitleInput = document.getElementById("task-title");
const taskList = document.getElementById("task-list");
const totalTasksElement = document.getElementById("total-tasks");
const completedActionsElement = document.getElementById("completed-actions");
const taskCountElement = document.getElementById("task-count");
const refreshButton = document.getElementById("refresh-button");
const addTaskButton = document.getElementById("add-task-button");
const messageElement = document.getElementById("message");
const connectionStatus = document.getElementById("connection-status");
const connectionText = document.getElementById("connection-text");

// Quest gamification HTML elements
const questLevelCard = document.getElementById("quest-level-card");
const questLevelEmblem = document.getElementById("quest-level-emblem");
const questLevelTier = document.getElementById("quest-level-tier");
const questLevelTitle = document.getElementById("quest-level-title");
const questTotalXp = document.getElementById("quest-total-xp");
const questCompletedCount = document.getElementById("quest-completed-count");
const questProgressText = document.getElementById("quest-progress-text");
const questProgressbar = document.getElementById("quest-progressbar");
const questProgressFill = document.getElementById("quest-progress-fill");
const questBadgesGrid = document.getElementById("quest-badges-grid");
const questBadgesUnlockedCount = document.getElementById("quest-badges-unlocked-count");
const questToastContainer = document.getElementById("quest-toast-container");

// Gamification state (in-memory prototype session progress)
const XP_PER_TASK = 20;
const completedTaskIds = new Set();
const pendingTaskUpdates = new Set();
const unlockedBadgeIds = new Set();
let currentLevelName = "Beginner";
let completedActions = 0;

// SVG Emblems for Levels
const LEVEL_EMBLEMS = {
    beginner: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><path d="m9 12 2 2 4-4"></path></svg>`,
    taskExplorer: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"></polygon></svg>`,
    productivityChampion: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path><path d="M4 22h16"></path><path d="M10 14.66V17c0 .55-.45 1-1 1H7v4h10v-4h-2c-.55 0-1-.45-1-1v-2.34"></path><path d="M6 4h12v7a6 6 0 0 1-12 0V4z"></path></svg>`
};

// SVG Icons for Badges
const BADGE_ICONS = {
    firstStep: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 14 14"></polyline><path d="m9 12 2 2 4-4"></path></svg>`,
    highFive: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`
};

// Safely render SVG content into an element using DOMParser
function setSvgContent(element, svgString) {
    if (!element || !svgString) return;
    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(svgString, "image/svg+xml");
        const svgEl = doc.querySelector("svg");
        if (svgEl) {
            element.replaceChildren(svgEl);
        }
    } catch {
        element.textContent = "★";
    }
}

// Show friendly toast notifications
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
        setTimeout(() => toast.remove(), 300);
    });

    toast.append(iconSpan, bodyDiv, closeBtn);
    questToastContainer.appendChild(toast);

    setTimeout(() => {
        if (toast.isConnected) {
            toast.classList.add("toast-fade-out");
            setTimeout(() => toast.remove(), 300);
        }
    }, 4500);
}

// Show floating +20 XP reward animation anchored on the completed card
function triggerFloatingXpReward(targetElement, text = "+20 XP") {
    if (!targetElement) return;

    const pill = document.createElement("div");
    pill.className = "floating-xp-pill";
    pill.textContent = text;
    targetElement.appendChild(pill);

    setTimeout(() => {
        if (pill.isConnected) {
            pill.remove();
        }
    }, 1300);
}

// Compute level, progress, and badges from accumulated XP and completed tasks
function computeQuestProfile(totalXp, completedCount) {
    const validXp = Math.max(0, totalXp);
    const validCount = Math.max(0, completedCount);

    let level = "Beginner";
    let tier = "LEVEL 1";
    let cardClass = "level-beginner";
    let emblemKey = "beginner";
    let progressPercent = 0;
    let progressText = "";

    if (validXp >= 200) {
        level = "Productivity Champion";
        tier = "LEVEL 3";
        cardClass = "level-productivity-champion";
        emblemKey = "productivityChampion";
        progressPercent = 100;
        progressText = "Max level achieved! Productivity Champion";
    } else if (validXp >= 100) {
        level = "Task Explorer";
        tier = "LEVEL 2";
        cardClass = "level-task-explorer";
        emblemKey = "taskExplorer";
        const rem = 200 - validXp;
        progressPercent = Math.min(100, Math.round(((validXp - 100) / 100) * 100));
        progressText = `${rem} XP to Productivity Champion`;
    } else {
        level = "Beginner";
        tier = "LEVEL 1";
        cardClass = "level-beginner";
        emblemKey = "beginner";
        const rem = 100 - validXp;
        progressPercent = Math.min(100, Math.round((validXp / 100) * 100));
        progressText = `${rem} XP to Task Explorer`;
    }

    const firstStepUnlocked = validCount >= 1;
    const highFiveUnlocked = validCount >= 5;

    const badges = [
        {
            id: "first_step",
            name: "First Step",
            description: "Completed your first task",
            unlocked: firstStepUnlocked,
            progressLabel: firstStepUnlocked ? "Unlocked" : "0 / 1"
        },
        {
            id: "high_five",
            name: "High Five",
            description: "Completed five unique tasks",
            unlocked: highFiveUnlocked,
            progressLabel: highFiveUnlocked ? "Unlocked" : `${Math.min(5, validCount)} / 5`
        }
    ];

    return {
        totalXp: validXp,
        completedCount: validCount,
        level,
        tier,
        cardClass,
        emblemKey,
        progressPercent,
        progressText,
        badges
    };
}

// Compute quest profile strictly from the currently completed tasks in session
function computeQuestProfileFromCompletedTasks() {
    const completedCount = completedTaskIds.size;
    const totalXp = Math.max(0, completedCount * XP_PER_TASK);
    return computeQuestProfile(totalXp, completedCount);
}


// Render the Quest Dashboard
function renderQuestDashboard(questData) {
    if (!questLevelCard) return;

    questLevelCard.className = `quest-level-card ${questData.cardClass}`;
    if (questLevelTier) questLevelTier.textContent = questData.tier;
    if (questLevelTitle) questLevelTitle.textContent = questData.level;

    if (questLevelEmblem) {
        setSvgContent(questLevelEmblem, LEVEL_EMBLEMS[questData.emblemKey]);
    }

    if (questTotalXp) questTotalXp.textContent = questData.totalXp;
    if (questCompletedCount) questCompletedCount.textContent = questData.completedCount;

    if (questProgressText) questProgressText.textContent = questData.progressText;
    if (questProgressbar) {
        questProgressbar.setAttribute("aria-valuenow", questData.progressPercent);
    }
    if (questProgressFill) {
        questProgressFill.style.width = `${questData.progressPercent}%`;
    }

    if (questBadgesGrid) {
        questBadgesGrid.replaceChildren();
        const unlockedCount = questData.badges.filter((b) => b.unlocked).length;
        if (questBadgesUnlockedCount) {
            questBadgesUnlockedCount.textContent = `${unlockedCount} / ${questData.badges.length} Unlocked`;
        }

        questData.badges.forEach((badge) => {
            const card = document.createElement("article");
            card.className = `quest-badge-card ${badge.unlocked ? "unlocked" : "locked"}`;
            card.setAttribute("role", "listitem");

            const iconBox = document.createElement("div");
            iconBox.className = "quest-badge-icon-box";
            iconBox.setAttribute("aria-hidden", "true");
            setSvgContent(
                iconBox,
                badge.id === "first_step" ? BADGE_ICONS.firstStep : BADGE_ICONS.highFive
            );

            const details = document.createElement("div");
            details.className = "quest-badge-details";

            const titleRow = document.createElement("div");
            titleRow.className = "quest-badge-title-row";

            const name = document.createElement("h5");
            name.className = "quest-badge-name";
            name.textContent = badge.name;

            const pill = document.createElement("span");
            pill.className = "quest-badge-status-pill";
            pill.textContent = badge.progressLabel;

            titleRow.append(name, pill);

            const desc = document.createElement("p");
            desc.className = "quest-badge-desc";
            desc.textContent = badge.description;

            details.append(titleRow, desc);
            card.append(iconBox, details);
            questBadgesGrid.appendChild(card);
        });
    }
}

// Check for Level-Up and Badge Unlock milestones
function checkGamificationMilestones(newQuestData, isCompleting = true) {
    if (!isCompleting) {
        // When uncompleting or silently syncing, update level and unlocked badges without firing celebration toasts
        currentLevelName = newQuestData.level;
        unlockedBadgeIds.clear();
        newQuestData.badges.forEach((b) => {
            if (b.unlocked) unlockedBadgeIds.add(b.id);
        });
        return;
    }

    const levelRanks = { "Beginner": 1, "Task Explorer": 2, "Productivity Champion": 3 };
    if (currentLevelName && (levelRanks[newQuestData.level] || 0) > (levelRanks[currentLevelName] || 0)) {
        showToast(
            `Level Up! 🎉`,
            `You reached ${newQuestData.level}! Keep crushing your goals.`,
            "🏆",
            "toast-level-up"
        );
    }
    currentLevelName = newQuestData.level;

    newQuestData.badges.forEach((badge) => {
        if (badge.unlocked && !unlockedBadgeIds.has(badge.id)) {
            unlockedBadgeIds.add(badge.id);
            showToast(
                `Badge Unlocked! 🌟`,
                `${badge.name}: ${badge.description}`,
                "🎖️",
                "toast-badge"
            );
        } else if (!badge.unlocked && unlockedBadgeIds.has(badge.id)) {
            unlockedBadgeIds.delete(badge.id);
        }
    });
}

// Update or toggle XP status badge on a task card
function updateTaskXpPill(taskItem, isCompleted) {
    const dateEl = taskItem.querySelector(".task-date");
    if (!dateEl) return;
    const existingPill = dateEl.querySelector(".task-xp-pill");

    if (isCompleted && !existingPill) {
        const xpPill = document.createElement("span");
        xpPill.className = "task-xp-pill";
        xpPill.textContent = "Completed (+20 XP)";
        dateEl.appendChild(xpPill);
    } else if (!isCompleted && existingPill) {
        existingPill.remove();
    }
}

// Handle task completion toggle with PATCH /tasks/{id}
async function handleTaskToggle(task, checkbox, taskItem) {
    const isNowCompleted = checkbox.checked;

    // Prevent duplicate in-flight requests for this task
    if (pendingTaskUpdates.has(task.id)) {
        checkbox.checked = !isNowCompleted;
        return;
    }

    // Ignore if target state already matches task state
    if (Boolean(task.completed) === isNowCompleted) {
        return;
    }

    pendingTaskUpdates.add(task.id);
    checkbox.disabled = true;

    try {
        const responseData = await apiRequest(`/tasks/${encodeURIComponent(task.id)}`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ completed: isNowCompleted })
        });

        task.completed = isNowCompleted;
        if (responseData?.task?.completed !== undefined) {
            task.completed = Boolean(responseData.task.completed);
        }

        taskItem.classList.toggle("completed", task.completed);
        checkbox.checked = task.completed;
        checkbox.setAttribute(
            "aria-label",
            `Mark task "${task.title}" as ${task.completed ? "incomplete" : "complete"}`
        );

        updateTaskXpPill(taskItem, task.completed);

        if (task.completed) {
            // Task checked: add to completed set and show floating reward
            completedTaskIds.add(task.id);
            triggerFloatingXpReward(taskItem, "+20 XP");
        } else {
            // Task unchecked: remove from completed set without floating reward
            completedTaskIds.delete(task.id);
        }

        // Recalculate quest profile strictly based on current completed tasks
        const updatedQuest = computeQuestProfileFromCompletedTasks();
        renderQuestDashboard(updatedQuest);

        // Update milestones (celebrate on completion, silently sync on uncompletion)
        checkGamificationMilestones(updatedQuest, task.completed);

        completedActions++;
        updateActionCounter();

    } catch (error) {
        console.error("Failed to update task completion:", error);
        // Restore previous checkbox and card state without altering XP
        checkbox.checked = !isNowCompleted;
        taskItem.classList.toggle("completed", !isNowCompleted);
        showMessage(error.message || "Failed to update task completion status.", "error");
    } finally {
        pendingTaskUpdates.delete(task.id);
        checkbox.disabled = false;
    }
}

// Show success or error messages
function showMessage(message, type) {
    messageElement.textContent = message;
    messageElement.className = `message ${type}`;
    messageElement.hidden = false;
}

// Hide the message
function hideMessage() {
    messageElement.hidden = true;
    messageElement.textContent = "";
}

// Update API connection status
function updateConnectionStatus(connected) {
    connectionStatus.classList.toggle("connected", connected);
    connectionStatus.classList.toggle("disconnected", !connected);

    connectionText.textContent = connected
        ? "Connected to AWS"
        : "Connection unavailable";
}

// Update the action counter
function updateActionCounter() {
    completedActionsElement.textContent = completedActions;
}

// Make an API request and handle HTTP errors
async function apiRequest(path, options = {}) {
    const response = await fetch(`${API_URL}${path}`, options);

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message || "The request failed.");
    }

    return data;
}

// Load all tasks from DynamoDB through API Gateway
async function loadTasks() {
    taskList.replaceChildren();

    const loadingMessage = document.createElement("div");
    loadingMessage.className = "loading-state";
    loadingMessage.textContent = "Loading your tasks...";
    taskList.appendChild(loadingMessage);

    refreshButton.disabled = true;
    hideMessage();

    try {
        const data = await apiRequest("/tasks");
        const tasks = Array.isArray(data.tasks) ? data.tasks : [];

        updateConnectionStatus(true);
        totalTasksElement.textContent = tasks.length;
        taskCountElement.textContent =
            `${tasks.length} ${tasks.length === 1 ? "task" : "tasks"}`;

        // Sync completedTaskIds with loaded completed tasks from DynamoDB
        completedTaskIds.clear();
        tasks.forEach((t) => {
            if (t.completed) {
                completedTaskIds.add(t.id);
            }
        });

        // Compute gamification state strictly from completed tasks
        const questData = computeQuestProfileFromCompletedTasks();
        checkGamificationMilestones(questData, false);
        renderQuestDashboard(questData);

        taskList.replaceChildren();

        if (tasks.length === 0) {
            const emptyMessage = document.createElement("div");
            emptyMessage.className = "empty-state";
            emptyMessage.textContent =
                "No tasks yet. Add your first task above!";
            taskList.appendChild(emptyMessage);
            return;
        }

        // Display newest tasks first
        tasks.sort((a, b) =>
            new Date(b.createdAt) - new Date(a.createdAt)
        );

        tasks.forEach((task) => {
            const taskItem = document.createElement("article");
            taskItem.className = `task-item${task.completed ? " completed" : ""}`;

            // Accessible completion checkbox
            const checkboxWrapper = document.createElement("div");
            checkboxWrapper.className = "task-checkbox-wrapper";

            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.className = "task-checkbox";
            checkbox.id = `task-chk-${task.id}`;
            checkbox.checked = Boolean(task.completed);
            checkbox.setAttribute(
                "aria-label",
                `Mark task "${task.title}" as ${task.completed ? "incomplete" : "complete"}`
            );
            checkbox.addEventListener("change", () =>
                handleTaskToggle(task, checkbox, taskItem)
            );

            checkboxWrapper.appendChild(checkbox);

            const taskDetails = document.createElement("div");
            taskDetails.className = "task-details";

            const title = document.createElement("h4");
            title.className = "task-title";
            title.textContent = task.title;

            const date = document.createElement("p");
            date.className = "task-date";

            const parsedDate = new Date(task.createdAt);
            date.textContent = Number.isNaN(parsedDate.getTime())
                ? "Date unavailable"
                : `Created ${parsedDate.toLocaleString()}`;

            if (task.completed) {
                const xpPill = document.createElement("span");
                xpPill.className = "task-xp-pill";
                xpPill.textContent = "Completed (+20 XP)";
                date.appendChild(xpPill);
            }

            const deleteButton = document.createElement("button");
            deleteButton.type = "button";
            deleteButton.className = "delete-button";
            deleteButton.textContent = "Delete";
            deleteButton.setAttribute(
                "aria-label",
                `Delete task: ${task.title}`
            );
            deleteButton.dataset.taskId = task.id;

            taskDetails.append(title, date);
            taskItem.append(checkboxWrapper, taskDetails, deleteButton);
            taskList.appendChild(taskItem);
        });
    } catch (error) {
        updateConnectionStatus(false);
        totalTasksElement.textContent = "—";
        taskCountElement.textContent = "Unavailable";

        taskList.replaceChildren();

        const errorMessage = document.createElement("div");
        errorMessage.className = "empty-state";
        errorMessage.textContent =
            "Unable to load tasks. Check your connection and try again.";
        taskList.appendChild(errorMessage);

        showMessage(error.message, "error");
        console.error("Failed to load tasks:", error);
    } finally {
        refreshButton.disabled = false;
    }
}

// Create a task
taskForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const title = taskTitleInput.value.trim();

    if (!title) {
        showMessage("Please enter a task title.", "error");
        return;
    }

    addTaskButton.disabled = true;
    addTaskButton.textContent = "Adding...";
    hideMessage();

    try {
        const data = await apiRequest("/tasks", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ title })
        });

        completedActions++;
        updateActionCounter();

        taskForm.reset();

        await loadTasks();

        showMessage(
            data.message || "Task created successfully.",
            "success"
        );
    } catch (error) {
        showMessage(error.message, "error");
        console.error("Failed to create task:", error);
    } finally {
        addTaskButton.disabled = false;
        addTaskButton.textContent = "Add task";
    }
});

// Delete a task using its ID
taskList.addEventListener("click", async (event) => {
    const deleteButton = event.target.closest(".delete-button");

    if (!deleteButton) {
        return;
    }

    const taskId = deleteButton.dataset.taskId;

    if (!taskId) {
        showMessage("Unable to identify this task.", "error");
        return;
    }

    if (!confirm("Are you sure you want to delete this task?")) {
        return;
    }

    deleteButton.disabled = true;
    deleteButton.textContent = "Deleting...";
    hideMessage();

    try {
        const data = await apiRequest(
            `/tasks/${encodeURIComponent(taskId)}`,
            { method: "DELETE" }
        );

        completedActions++;
        updateActionCounter();

        await loadTasks();

        showMessage(
            data.message || "Task deleted successfully.",
            "success"
        );
    } catch (error) {
        showMessage(error.message, "error");
        console.error("Failed to delete task:", error);

        // Restore the list so the user can retry
        await loadTasks();
    }
});

// Refresh the task list manually
refreshButton.addEventListener("click", loadTasks);

// Load tasks when the page opens
loadTasks();

// =============================================================
// AI Task Planner
// =============================================================

const planForm = document.getElementById("plan-form");
const planGoalInput = document.getElementById("plan-goal");
const generatePlanButton = document.getElementById("generate-plan-button");
const planMessageElement = document.getElementById("plan-message");
const planOutput = document.getElementById("plan-output");
const planTitleElement = document.getElementById("plan-title");
const planTaskList = document.getElementById("plan-task-list");
const addSelectedButton = document.getElementById("add-selected-button");

// Show or hide the planner status message.
function showPlanMessage(text, type) {
    planMessageElement.textContent = text;
    planMessageElement.className = `message ${type}`;
    planMessageElement.hidden = false;
}

function hidePlanMessage() {
    planMessageElement.hidden = true;
    planMessageElement.textContent = "";
}

// Enable the add-selected button only when at least one task is checked.
function syncAddSelectedButton() {
    const anyChecked = planTaskList.querySelectorAll(
        ".plan-task-checkbox:checked"
    ).length > 0;
    addSelectedButton.disabled = !anyChecked;
}

// Validate the structure the backend contract guarantees.
// Returns true only if the plan is safe to render.
function isValidPlan(plan) {
    return (
        plan !== null &&
        typeof plan === "object" &&
        !Array.isArray(plan) &&
        typeof plan.planTitle === "string" &&
        plan.planTitle.trim().length > 0 &&
        Array.isArray(plan.tasks) &&
        plan.tasks.length === 5 &&
        plan.tasks.every(
            (task, index) =>
                task !== null &&
                typeof task === "object" &&
                typeof task.title === "string" &&
                task.title.trim().length > 0 &&
                typeof task.description === "string" &&
                task.description.trim().length > 0 &&
                Number.isInteger(task.day) &&
                task.day === index + 1  // tasks arrive sorted 1–5 from the backend
        )
    );
}

// Render the validated plan into the DOM using textContent only —
// no untrusted model output is ever passed to innerHTML.
function renderPlan(plan) {
    // Set the plan title.
    planTitleElement.textContent = plan.planTitle;

    // Build one <li> per task.
    planTaskList.replaceChildren();

    plan.tasks.forEach((task) => {
        const li = document.createElement("li");
        li.className = "plan-task-item";

        // Checkbox — identified by day so the save handler can read it.
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.className = "plan-task-checkbox";
        checkbox.dataset.taskTitle = task.title;
        checkbox.dataset.taskDay = task.day;
        checkbox.id = `plan-task-${task.day}`;
        checkbox.addEventListener("change", syncAddSelectedButton);

        const checkboxLabel = document.createElement("label");
        checkboxLabel.htmlFor = checkbox.id;
        checkboxLabel.className = "plan-task-label";

        // Day badge.
        const badge = document.createElement("span");
        badge.className = "plan-day-badge";
        badge.textContent = `Day ${task.day}`;

        // Task title.
        const title = document.createElement("strong");
        title.className = "plan-task-title";
        title.textContent = task.title;

        // Task description.
        const description = document.createElement("p");
        description.className = "plan-task-description";
        description.textContent = task.description;

        checkboxLabel.append(badge, title, description);
        li.append(checkbox, checkboxLabel);
        planTaskList.appendChild(li);
    });

    // Reveal the plan output and reset button state.
    addSelectedButton.disabled = true;
    planOutput.hidden = false;
}

// Generate a plan from the /plan endpoint.
planForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const goal = planGoalInput.value.trim();

    if (!goal) {
        showPlanMessage("Please enter a goal.", "error");
        return;
    }

    // Lock the form to prevent duplicate submissions.
    generatePlanButton.disabled = true;
    generatePlanButton.textContent = "Generating…";
    planGoalInput.disabled = true;
    planOutput.hidden = true;
    hidePlanMessage();

    try {
        const data = await apiRequest("/plan", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ goal })
        });

        if (!data || !isValidPlan(data.plan)) {
            showPlanMessage(
                "The server returned an unexpected response. Please try again.",
                "error"
            );
            return;
        }

        renderPlan(data.plan);

    } catch (error) {
        showPlanMessage(error.message, "error");
        console.error("Failed to generate plan:", error);
    } finally {
        generatePlanButton.disabled = false;
        generatePlanButton.textContent = "Generate Plan";
        planGoalInput.disabled = false;
    }
});

// Save each selected task's title to DynamoDB via POST /tasks.
// Keeps failed tasks checked so the user can retry them.
addSelectedButton.addEventListener("click", async () => {
    const checkedBoxes = [
        ...planTaskList.querySelectorAll(".plan-task-checkbox:checked")
    ];

    if (checkedBoxes.length === 0) {
        return;
    }

    // Lock both buttons for the duration of the save operation.
    addSelectedButton.disabled = true;
    addSelectedButton.textContent = "Saving…";
    generatePlanButton.disabled = true;
    hidePlanMessage();

    const saved = [];
    const failed = [];

    // Save tasks sequentially to avoid racing DynamoDB writes.
    for (const checkbox of checkedBoxes) {
        const title = checkbox.dataset.taskTitle;

        try {
            await apiRequest("/tasks", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title })
            });

            saved.push(title);

            // Uncheck successfully saved tasks so they cannot be double-saved.
            checkbox.checked = false;

        } catch {
            // Leave the checkbox checked so the user can retry.
            failed.push(title);
        }
    }

    // Update the action counter for each successfully saved task.
    completedActions += saved.length;
    updateActionCounter();

    // Reload the task list to show the newly added tasks.
    if (saved.length > 0) {
        await loadTasks();
    }

    // Report the outcome clearly and accurately.
    if (failed.length === 0) {
        const noun = saved.length === 1 ? "task" : "tasks";
        showPlanMessage(
            `${saved.length} ${noun} added to your task list.`,
            "success"
        );
    } else if (saved.length === 0) {
        showPlanMessage(
            `All ${failed.length} tasks failed to save. The checked tasks are still selected — please try again.`,
            "error"
        );
    } else {
        showPlanMessage(
            `${saved.length} task${saved.length === 1 ? "" : "s"} saved. ` +
            `${failed.length} task${failed.length === 1 ? "" : "s"} failed — ` +
            `the failed tasks are still selected so you can retry them.`,
            "error"
        );
    }

    // Re-sync the button state after unchecking saved tasks.
    syncAddSelectedButton();
    generatePlanButton.disabled = false;
    addSelectedButton.textContent = "Add selected tasks";
});
