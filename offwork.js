const STEPS = [
  "出办公室",
  "会合",
  "上巴士",
  "到大学站",
  "上港铁",
  "过完关",
  "上地铁",
  "到家",
];

const STORAGE_KEY_PREFIX = "offwork-steps-records-";

const today = getTodayKey();
let selectedDate = today;
let state = loadRecords(selectedDate);

const actionsEl = document.getElementById("actions");
const recordsListEl = document.getElementById("recordsList");
const resetBtnEl = document.getElementById("resetBtn");
const todayLabelEl = document.getElementById("todayLabel");
const datePickerEl = document.getElementById("datePicker");
const goTodayBtnEl = document.getElementById("goTodayBtn");
const btnTemplate = document.getElementById("actionButtonTemplate");

renderActionButtons();
renderRecordsList();
syncDateUI();

datePickerEl.max = today;
datePickerEl.value = selectedDate;

datePickerEl.addEventListener("change", () => {
  selectedDate = datePickerEl.value || today;
  state = loadRecords(selectedDate);
  syncDateUI();
  renderActionButtons();
  renderRecordsList();
});

goTodayBtnEl.addEventListener("click", () => {
  selectedDate = today;
  state = loadRecords(selectedDate);
  syncDateUI();
  renderActionButtons();
  renderRecordsList();
});

resetBtnEl.addEventListener("click", () => {
  if (selectedDate !== today) {
    return;
  }

  if (!window.confirm("确认清空今天的记录吗？")) {
    return;
  }

  saveRecords(selectedDate, {});
  Object.keys(state).forEach((key) => {
    delete state[key];
  });
  renderActionButtons();
  renderRecordsList();
});

function renderActionButtons() {
  actionsEl.innerHTML = "";
  const isToday = selectedDate === today;

  STEPS.forEach((step) => {
    const button = btnTemplate.content.firstElementChild.cloneNode(true);
    const nameEl = button.querySelector(".name");
    const timeEl = button.querySelector(".time");

    nameEl.textContent = step;
    timeEl.textContent = state[step] || "未记录";

    if (state[step]) {
      button.classList.add("done");
    }

    button.disabled = !isToday;

    button.addEventListener("click", () => {
      if (!isToday) {
        return;
      }
      const currentTime = formatTime(new Date());
      state[step] = currentTime;
      saveRecords(selectedDate, state);
      renderActionButtons();
      renderRecordsList();
    });

    actionsEl.appendChild(button);
  });
}

function renderRecordsList() {
  recordsListEl.innerHTML = "";

  const recordedSteps = STEPS.filter((step) => state[step]);
  if (recordedSteps.length === 0) {
    const empty = document.createElement("li");
    empty.textContent =
      selectedDate === today
        ? "今天还没有记录，点击上方按钮开始。"
        : "该日期还没有记录。";
    recordsListEl.appendChild(empty);
    return;
  }

  recordedSteps.forEach((step) => {
    const li = document.createElement("li");
    const name = document.createElement("span");
    const time = document.createElement("span");

    name.className = "record-name";
    time.className = "record-time";
    name.textContent = step;
    time.textContent = state[step];

    li.appendChild(name);
    li.appendChild(time);
    recordsListEl.appendChild(li);
  });
}

function loadRecords(dateKey) {
  try {
    const raw = localStorage.getItem(getStorageKey(dateKey));
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch (error) {
    console.error("读取记录失败：", error);
    return {};
  }
}

function saveRecords(dateKey, records) {
  localStorage.setItem(getStorageKey(dateKey), JSON.stringify(records));
}

function formatTime(date) {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

function getTodayKey() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDateLabel(dateKey) {
  return dateKey.replaceAll("-", "/");
}

function getStorageKey(dateKey) {
  return `${STORAGE_KEY_PREFIX}${dateKey}`;
}

function syncDateUI() {
  const isToday = selectedDate === today;

  todayLabelEl.textContent = isToday
    ? `今天：${formatDateLabel(today)}`
    : `查看：${formatDateLabel(selectedDate)}（历史记录）`;

  datePickerEl.value = selectedDate;
  goTodayBtnEl.disabled = isToday;
  resetBtnEl.disabled = !isToday;
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch((error) => {
      console.error("Service Worker 注册失败：", error);
    });
  });
}
