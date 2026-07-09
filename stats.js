const WORK_STEPS = [
  "起床",
  "吃完饭出发",
  "到地铁站",
  "上地铁",
  "过完关",
  "上港铁",
  "到大学站",
  "上巴士",
  "到公司",
];

const OFFWORK_STEPS = [
  "出办公室",
  "会合",
  "上巴士",
  "到大学站",
  "上港铁",
  "过完关",
  "上地铁",
  "到家",
];

const WORK_PREFIX = "work-steps-records-";
const OFFWORK_PREFIX = "offwork-steps-records-";

const today = getTodayKey();
let selectedDate = today;

const todayLabelEl = document.getElementById("todayLabel");
const datePickerEl = document.getElementById("datePicker");
const goTodayBtnEl = document.getElementById("goTodayBtn");
const summaryCardsEl = document.getElementById("summaryCards");
const workIntervalsEl = document.getElementById("workIntervals");
const offworkIntervalsEl = document.getElementById("offworkIntervals");
const compareListEl = document.getElementById("compareList");

async function init() {
  datePickerEl.max = today;
  datePickerEl.value = selectedDate;
  syncDateUI();
  await renderStats();
}

datePickerEl.addEventListener("change", async () => {
  selectedDate = datePickerEl.value || today;
  syncDateUI();
  await renderStats();
});

goTodayBtnEl.addEventListener("click", async () => {
  selectedDate = today;
  datePickerEl.value = selectedDate;
  syncDateUI();
  await renderStats();
});

async function renderStats() {
  const workRecords = await loadRecords("work", WORK_PREFIX, selectedDate);
  const offworkRecords = await loadRecords("offwork", OFFWORK_PREFIX, selectedDate);

  const [workMedians, offworkMedians] = await Promise.all([
    buildMedianMap("work", WORK_PREFIX, WORK_STEPS, selectedDate),
    buildMedianMap("offwork", OFFWORK_PREFIX, OFFWORK_STEPS, selectedDate),
  ]);

  const workIntervals = computeIntervals(WORK_STEPS, workRecords);
  const offworkIntervals = computeIntervals(OFFWORK_STEPS, offworkRecords);
  const workTotal = computeTotalDuration(WORK_STEPS, workRecords);
  const offworkTotal = computeTotalDuration(OFFWORK_STEPS, offworkRecords);

  renderSummary(workTotal, offworkTotal, workIntervals.length, offworkIntervals.length);
  renderIntervalList(workIntervalsEl, workIntervals, "上班", workMedians);
  renderIntervalList(offworkIntervalsEl, offworkIntervals, "下班", offworkMedians);
  renderCompare(workTotal, offworkTotal);
}

function renderSummary(workTotal, offworkTotal, workCount, offworkCount) {
  summaryCardsEl.innerHTML = "";

  const cards = [
    { label: "上班总耗时", value: workTotal ? formatDuration(workTotal) : "—", tone: "work" },
    { label: "下班总耗时", value: offworkTotal ? formatDuration(offworkTotal) : "—", tone: "offwork" },
    {
      label: "耗时差（下班-上班）",
      value: workTotal && offworkTotal ? formatSignedDuration(offworkTotal - workTotal) : "—",
      tone: "diff",
    },
    { label: "有效间隔段数", value: `上班 ${workCount} / 下班 ${offworkCount}`, tone: "meta" },
  ];

  cards.forEach((card) => {
    const el = document.createElement("article");
    el.className = `summary-card ${card.tone}`;
    el.innerHTML = `<p class="summary-label">${card.label}</p><p class="summary-value">${card.value}</p>`;
    summaryCardsEl.appendChild(el);
  });
}

function renderIntervalList(container, intervals, groupName, medianMap) {
  container.innerHTML = "";

  if (intervals.length === 0) {
    const empty = document.createElement("li");
    empty.className = "interval-empty";
    empty.textContent = `${groupName}该日记录不足，无法计算间隔。`;
    container.appendChild(empty);
    return;
  }

  intervals.forEach((item) => {
    const comparison = formatMedianComparison(item.seconds, medianMap.get(intervalKey(item)));
    const li = document.createElement("li");
    li.innerHTML = `
      <div class="interval-route">
        <span class="interval-from">${item.from}</span>
        <span class="interval-arrow">→</span>
        <span class="interval-to">${item.to}</span>
      </div>
      <div class="interval-meta">
        <span class="interval-time">${item.fromTime} - ${item.toTime}</span>
        <div class="interval-compare-group">
          <span class="interval-duration">${item.label}</span>
          <span class="interval-median ${comparison.tone}">${comparison.text}</span>
        </div>
      </div>
    `;
    container.appendChild(li);
  });
}

function renderCompare(workTotal, offworkTotal) {
  compareListEl.innerHTML = "";

  if (!workTotal && !offworkTotal) {
    const empty = document.createElement("li");
    empty.className = "interval-empty";
    empty.textContent = "该日期暂无上班或下班完整记录。";
    compareListEl.appendChild(empty);
    return;
  }

  const rows = [
    { name: "上班（首步→末步）", seconds: workTotal },
    { name: "下班（首步→末步）", seconds: offworkTotal },
  ];

  rows.forEach((row) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <span class="record-name">${row.name}</span>
      <span class="record-time">${row.seconds ? formatDuration(row.seconds) : "—"}</span>
    `;
    compareListEl.appendChild(li);
  });

  if (workTotal && offworkTotal) {
    const li = document.createElement("li");
    li.className = "compare-highlight";
    const faster = offworkTotal <= workTotal ? "下班更快" : "上班更快";
    li.innerHTML = `
      <span class="record-name">${faster}</span>
      <span class="record-time">${formatDuration(Math.abs(offworkTotal - workTotal))}</span>
    `;
    compareListEl.appendChild(li);
  }
}

function computeIntervals(steps, records) {
  const recordedSteps = steps.filter((step) => records[step]);
  const intervals = [];

  for (let i = 1; i < recordedSteps.length; i += 1) {
    const fromStep = recordedSteps[i - 1];
    const toStep = recordedSteps[i];
    const fromSeconds = parseTimeString(records[fromStep]);
    const toSeconds = parseTimeString(records[toStep]);

    if (fromSeconds === null || toSeconds === null) {
      continue;
    }

    const seconds = normalizeDiff(toSeconds - fromSeconds);
    intervals.push({
      from: fromStep,
      to: toStep,
      fromTime: extractDisplayTime(records[fromStep]),
      toTime: extractDisplayTime(records[toStep]),
      seconds,
      label: formatDuration(seconds),
    });
  }

  return intervals;
}

function computeTotalDuration(steps, records) {
  const recordedSteps = steps.filter((step) => records[step]);
  if (recordedSteps.length < 2) {
    return null;
  }

  const first = parseTimeString(records[recordedSteps[0]]);
  const last = parseTimeString(records[recordedSteps[recordedSteps.length - 1]]);

  if (first === null || last === null) {
    return null;
  }

  return normalizeDiff(last - first);
}

async function loadRecords(mode, prefix, dateKey) {
  await TimeSync.init(mode, prefix);
  return TimeSync.loadRecords(dateKey);
}

async function buildMedianMap(mode, prefix, steps, excludeDate) {
  const dates = await TimeSync.listAllDates(mode, prefix);
  const buckets = new Map();

  for (const dateKey of dates) {
    if (dateKey === excludeDate) {
      continue;
    }

    const records = await loadRecords(mode, prefix, dateKey);
    const intervals = computeIntervals(steps, records);

    intervals.forEach((item) => {
      const key = intervalKey(item);
      if (!buckets.has(key)) {
        buckets.set(key, []);
      }
      buckets.get(key).push(item.seconds);
    });
  }

  const medians = new Map();
  buckets.forEach((values, key) => {
    medians.set(key, calculateMedian(values));
  });

  return medians;
}

function intervalKey(item) {
  return `${item.from}→${item.to}`;
}

function calculateMedian(values) {
  if (values.length === 0) {
    return null;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return Math.round((sorted[mid - 1] + sorted[mid]) / 2);
  }

  return sorted[mid];
}

function formatMedianComparison(currentSeconds, medianSeconds) {
  if (medianSeconds === null || medianSeconds === undefined) {
    return { text: "暂无中位对比", tone: "neutral" };
  }

  const diff = currentSeconds - medianSeconds;
  const medianLabel = formatDuration(medianSeconds);

  if (diff === 0) {
    return { text: `中位 ${medianLabel} · 持平`, tone: "neutral" };
  }

  if (diff > 0) {
    return {
      text: `中位 ${medianLabel} · 慢 ${formatDuration(diff)}`,
      tone: "slower",
    };
  }

  return {
    text: `中位 ${medianLabel} · 快 ${formatDuration(Math.abs(diff))}`,
    tone: "faster",
  };
}

function parseTimeString(value) {
  const match = String(value).match(/(\d{2}):(\d{2}):(\d{2})/);
  if (!match) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);
  return hours * 3600 + minutes * 60 + seconds;
}

function extractDisplayTime(value) {
  const match = String(value).match(/\d{2}:\d{2}:\d{2}/);
  return match ? match[0] : value;
}

function normalizeDiff(diff) {
  if (diff < 0) {
    return diff + 86400;
  }
  return diff;
}

function formatDuration(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}小时${minutes}分${seconds}秒`;
  }
  if (minutes > 0) {
    return `${minutes}分${seconds}秒`;
  }
  return `${seconds}秒`;
}

function formatSignedDuration(totalSeconds) {
  const sign = totalSeconds >= 0 ? "+" : "-";
  return `${sign}${formatDuration(Math.abs(totalSeconds))}`;
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
  todayLabelEl.textContent = `统计日期：${formatDateLabel(selectedDate)}`;
}

init();
