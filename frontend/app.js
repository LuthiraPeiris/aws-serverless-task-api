
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

let completedActions = 0;

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
            taskItem.className = "task-item";

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
            taskItem.append(taskDetails, deleteButton);
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
