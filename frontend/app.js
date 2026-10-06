
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
