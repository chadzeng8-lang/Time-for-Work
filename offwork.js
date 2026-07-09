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
let state = {};

const actionsEl = document.getElementById("actions");
const recordsListEl = document.getElementById("recordsList");
const resetBtnEl = document.getElementById("resetBtn");
const todayLabelEl = document.getElementById("todayLabel");
const datePickerEl = document.getElementById("datePicker");
const goTodayBtnEl = document.getElementById("goTodayBtn");
const btnTemplate = document.getElementById("actionButtonTemplate");

async function init() {
  await TimeSync.init("offwork", STORAGE_KEY_PREFIX);
  state = await loadRecords(selectedDate);
  renderActionButtons();
  renderRecordsList();
  syncDateUI();

  datePickerEl.max = today;
  datePickerEl.value = selectedDate;
}

datePickerEl.addEventListener("change", async () => {
  selectedDate = datePickerEl.value || today;
  state = await loadRecords(selectedDate);
  syncDateUI();
  renderActionButtons();
  renderRecordsList();
});

goTodayBtnEl.addEventListener("click", async () => {
  selectedDate = today;
  state = await loadRecords(selectedDate);
  syncDateUI();
  renderActionButtons();
  renderRecordsList();
});

resetBtnEl.addEventListener("click", async () => {
  if (selectedDate !== today) {
    return;
  }

  if (!window.confirm("确认清空今天的记录吗？")) {
    return;
  }

  await saveRecords(selectedDate, {});
  state = {};
  renderActionButtons();
  renderRecordsList();
});

window.onSyncSettingsSaved = async () => {
  state = await loadRecords(selectedDate);
  renderActionButtons();
  renderRecordsList();
};

window.onManualSync = async () => {
  state = await TimeSync.syncCurrentDate(selectedDate);
  renderActionButtons();
  renderRecordsList();
};

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

    button.addEventListener("click", async () => {
      if (!isToday) {
        return;
      }
      const currentTime = formatTime(new Date());
      state[step] = currentTime;
      await saveRecords(selectedDate, { ...state });
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

async function loadRecords(dateKey) {
  return TimeSync.loadRecords(dateKey);
}

async function saveRecords(dateKey, records) {
  await TimeSync.saveRecords(dateKey, records);
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

function syncDateUI() {
  const isToday = selectedDate === today;

  todayLabelEl.textContent = isToday
    ? `今天：${formatDateLabel(today)}`
    : `查看：${formatDateLabel(selectedDate)}（历史记录）`;

  datePickerEl.value = selectedDate;
  goTodayBtnEl.disabled = isToday;
  resetBtnEl.disabled = !isToday;
}

init();
