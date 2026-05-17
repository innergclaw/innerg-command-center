const config = window.INNERG_COMMAND_CENTER_CONFIG || {};

const boards = {
  all: "All Boards",
  energy: "Energy",
  eco: "Eco",
  ownyourweb: "OWNYOURWEB",
  shopnasgfx: "ShopNasGraphics",
};

const state = {
  items: [],
  board: "all",
  timer: null,
};

const elements = {
  token: document.querySelector("#access-token"),
  saveToken: document.querySelector("#save-token"),
  accessStatus: document.querySelector("#access-status"),
  boardTabs: document.querySelectorAll(".board-tab"),
  boardTitle: document.querySelector("#board-title"),
  quickForm: document.querySelector("#quick-form"),
  quickMessage: document.querySelector("#quick-message"),
  manualBoard: document.querySelector("#manual-board"),
  priority: document.querySelector("#priority"),
  dueAt: document.querySelector("#due-at"),
  formStatus: document.querySelector("#form-status"),
  boardGrid: document.querySelector("#board-grid"),
  itemTemplate: document.querySelector("#item-template"),
  refresh: document.querySelector("#refresh"),
  statOpen: document.querySelector("#stat-open"),
  statDue: document.querySelector("#stat-due"),
  statDone: document.querySelector("#stat-done"),
};

elements.token.value = localStorage.getItem("innerg-command-center-token") || config.token || "";

function endpoint() {
  return String(config.endpoint || "").replace(/\/$/, "");
}

function token() {
  return elements.token.value.trim();
}

function headers() {
  return {
    "Content-Type": "application/json",
    "x-command-center-token": token(),
  };
}

function dueSoon(item) {
  if (!item.due_at || item.status === "done") return false;
  const due = new Date(item.due_at).getTime();
  const now = Date.now();
  return due >= now && due <= now + 1000 * 60 * 60 * 48;
}

function formatDate(value) {
  if (!value) return "No deadline";
  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function filteredItems() {
  if (state.board === "all") return state.items;
  return state.items.filter((item) => item.board === state.board);
}

function renderStats() {
  elements.statOpen.textContent = state.items.filter((item) => item.status !== "done").length;
  elements.statDue.textContent = state.items.filter(dueSoon).length;
  elements.statDone.textContent = state.items.filter((item) => item.status === "done").length;
}

function renderItems() {
  renderStats();
  const items = filteredItems();
  elements.boardTitle.textContent = boards[state.board];

  if (!items.length) {
    elements.boardGrid.innerHTML = '<div class="empty-state">No updates in this board yet.</div>';
    return;
  }

  elements.boardGrid.innerHTML = "";
  items.forEach((item) => {
    const clone = elements.itemTemplate.content.cloneNode(true);
    const card = clone.querySelector(".item-card");
    card.dataset.id = item.id;
    clone.querySelector(".board-pill").textContent = boards[item.board] || item.board;
    const priority = clone.querySelector(".priority-pill");
    priority.textContent = item.priority || "medium";
    priority.classList.add(item.priority || "medium");
    clone.querySelector(".status-pill").textContent = item.status || "active";
    clone.querySelector("h3").textContent = item.title || "Untitled update";
    clone.querySelector(".item-body").textContent = item.body || item.raw_message || "";
    clone.querySelector("time").textContent = formatDate(item.due_at || item.created_at);
    elements.boardGrid.appendChild(clone);
  });
}

async function fetchItems() {
  if (!endpoint() || !token()) {
    elements.accessStatus.textContent = "Token required to sync.";
    renderItems();
    return;
  }

  const response = await fetch(endpoint(), { headers: headers() });
  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data.ok) {
    elements.accessStatus.textContent = data.error || "Sync failed.";
    return;
  }

  state.items = data.items || [];
  elements.accessStatus.textContent = `Synced ${state.items.length} updates.`;
  renderItems();
}

async function addItem(event) {
  event.preventDefault();
  if (!token()) {
    elements.formStatus.textContent = "Paste and save your dashboard token first.";
    return;
  }

  elements.formStatus.textContent = "Routing update...";

  const payload = {
    message: elements.quickMessage.value.trim(),
    board: elements.manualBoard.value,
    priority: elements.priority.value,
    due_at: elements.dueAt.value || null,
    source: "dashboard",
  };

  const response = await fetch(endpoint(), {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data.ok) {
    elements.formStatus.textContent = data.error || "Update failed.";
    return;
  }

  elements.quickForm.reset();
  elements.formStatus.textContent = `Added to ${boards[data.item.board] || data.item.board}.`;
  await fetchItems();
}

async function updateStatus(id, status) {
  const response = await fetch(endpoint(), {
    method: "PATCH",
    headers: headers(),
    body: JSON.stringify({ id, status }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.ok) {
    elements.accessStatus.textContent = data.error || "Status update failed.";
    return;
  }
  await fetchItems();
}

elements.saveToken.addEventListener("click", async () => {
  localStorage.setItem("innerg-command-center-token", token());
  await fetchItems();
});

elements.refresh.addEventListener("click", fetchItems);
elements.quickForm.addEventListener("submit", addItem);

elements.boardTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    state.board = tab.dataset.board;
    elements.boardTabs.forEach((item) => item.classList.toggle("is-active", item === tab));
    renderItems();
  });
});

elements.boardGrid.addEventListener("click", (event) => {
  const button = event.target.closest(".status-button");
  if (!button) return;
  const card = button.closest(".item-card");
  updateStatus(card.dataset.id, button.dataset.status);
});

fetchItems();
state.timer = window.setInterval(fetchItems, config.refreshMs || 15000);
