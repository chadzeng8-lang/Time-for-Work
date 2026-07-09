const SYNC_CODE_KEY = "time-app-sync-code";

let db = null;
let appMode = "work";
let storageKeyPrefix = "";
let syncStatus = "disabled";

const TimeSync = {
  async init(mode, keyPrefix) {
    appMode = mode;
    storageKeyPrefix = keyPrefix;
    syncStatus = isFirebaseConfigured() ? "ready" : "disabled";

    if (!isFirebaseConfigured() || typeof firebase === "undefined") {
      return;
    }

    if (!firebase.apps.length) {
      firebase.initializeApp(window.FIREBASE_CONFIG);
    }
    db = firebase.firestore();
    updateSyncStatusUI();
  },

  isConfigured() {
    return isFirebaseConfigured() && db !== null;
  },

  isEnabled() {
    return this.isConfigured() && Boolean(localStorage.getItem(SYNC_CODE_KEY));
  },

  getSyncCode() {
    return localStorage.getItem(SYNC_CODE_KEY) || "";
  },

  async setSyncCode(code) {
    const trimmed = code.trim();
    if (trimmed.length < 6) {
      throw new Error("同步码至少 6 位");
    }

    localStorage.setItem(SYNC_CODE_KEY, trimmed);
    await this.uploadAllLocalRecords();
    updateSyncStatusUI();
  },

  getStatus() {
    if (!this.isConfigured()) {
      return "disabled";
    }
    if (!this.getSyncCode()) {
      return "ready";
    }
    return syncStatus;
  },

  async loadRecords(dateKey) {
    const local = loadLocalRecords(dateKey);

    if (!this.isEnabled()) {
      return local;
    }

    try {
      const cloud = await fetchCloudDoc(dateKey);
      if (!cloud) {
        syncStatus = "ok";
        updateSyncStatusUI();
        return local;
      }

      const localUpdated = getLocalUpdatedAt(dateKey);
      if (cloud.updatedAt >= localUpdated) {
        saveLocalRecords(dateKey, cloud.records, cloud.updatedAt);
        syncStatus = "ok";
        updateSyncStatusUI();
        return cloud.records;
      }

      syncStatus = "ok";
      updateSyncStatusUI();
      return local;
    } catch (error) {
      console.error("云端读取失败：", error);
      syncStatus = "offline";
      updateSyncStatusUI();
      return local;
    }
  },

  async saveRecords(dateKey, records) {
    const now = new Date().toISOString();
    saveLocalRecords(dateKey, records, now);

    if (!this.isEnabled()) {
      return;
    }

    try {
      await writeCloudDoc(dateKey, records, now);
      syncStatus = "ok";
      updateSyncStatusUI();
    } catch (error) {
      console.error("云端保存失败：", error);
      syncStatus = "offline";
      updateSyncStatusUI();
    }
  },

  async syncCurrentDate(dateKey) {
    if (!this.isEnabled()) {
      return loadLocalRecords(dateKey);
    }

    const local = loadLocalRecords(dateKey);
    const cloud = await fetchCloudDoc(dateKey);

    if (!cloud) {
      if (Object.keys(local).length > 0) {
        await writeCloudDoc(dateKey, local, new Date().toISOString());
      }
      syncStatus = "ok";
      updateSyncStatusUI();
      return local;
    }

    const localUpdated = getLocalUpdatedAt(dateKey);
    let merged = local;
    let mergedUpdated = localUpdated;

    if (cloud.updatedAt > localUpdated) {
      merged = cloud.records;
      mergedUpdated = cloud.updatedAt;
    } else if (localUpdated > cloud.updatedAt) {
      await writeCloudDoc(dateKey, local, localUpdated);
      merged = local;
      mergedUpdated = localUpdated;
    } else {
      merged = mergeRecords(local, cloud.records);
      mergedUpdated = new Date().toISOString();
      await writeCloudDoc(dateKey, merged, mergedUpdated);
    }

    saveLocalRecords(dateKey, merged, mergedUpdated);
    syncStatus = "ok";
    updateSyncStatusUI();
    return merged;
  },

  async listAllDates(mode, keyPrefix) {
    appMode = mode;
    storageKeyPrefix = keyPrefix;
    const dates = new Set();

    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key && key.startsWith(keyPrefix) && !key.endsWith("-updated")) {
        dates.add(key.slice(keyPrefix.length));
      }
    }

    if (!this.isEnabled()) {
      return [...dates].sort();
    }

    try {
      const syncId = await hashSyncCode(localStorage.getItem(SYNC_CODE_KEY));
      const snapshot = await db
        .collection("sync")
        .doc(syncId)
        .collection("data")
        .get();
      const docPrefix = `${mode}_`;

      snapshot.forEach((doc) => {
        if (doc.id.startsWith(docPrefix)) {
          dates.add(doc.id.slice(docPrefix.length));
        }
      });
    } catch (error) {
      console.error("读取历史日期失败：", error);
    }

    return [...dates].sort();
  },

  async uploadAllLocalRecords() {
    if (!this.isEnabled()) {
      return;
    }

    const savedMode = appMode;
    const savedPrefix = storageKeyPrefix;
    const modes = [
      { mode: "work", prefix: "work-steps-records-" },
      { mode: "offwork", prefix: "offwork-steps-records-" },
    ];

    for (const { mode, prefix } of modes) {
      appMode = mode;
      storageKeyPrefix = prefix;

      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (!key || !key.startsWith(prefix) || key.endsWith("-updated")) {
          continue;
        }

        const dateKey = key.slice(prefix.length);
        const records = loadLocalRecords(dateKey);
        if (Object.keys(records).length === 0) {
          continue;
        }

        const updatedAt = getLocalUpdatedAt(dateKey) || new Date().toISOString();
        await writeCloudDoc(dateKey, records, updatedAt);
      }
    }

    appMode = savedMode;
    storageKeyPrefix = savedPrefix;
  },
};

window.TimeSync = TimeSync;

function isFirebaseConfigured() {
  const config = window.FIREBASE_CONFIG;
  return Boolean(
    config &&
      config.apiKey &&
      config.projectId &&
      config.apiKey !== "YOUR_API_KEY" &&
      config.projectId !== "YOUR_PROJECT_ID"
  );
}

async function hashSyncCode(code) {
  const data = new TextEncoder().encode(code.trim());
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function getStorageKey(dateKey) {
  return `${storageKeyPrefix}${dateKey}`;
}

function getUpdatedKey(dateKey) {
  return `${storageKeyPrefix}${dateKey}-updated`;
}

function loadLocalRecords(dateKey) {
  try {
    const raw = localStorage.getItem(getStorageKey(dateKey));
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch (error) {
    console.error("读取本地记录失败：", error);
    return {};
  }
}

function getLocalUpdatedAt(dateKey) {
  return localStorage.getItem(getUpdatedKey(dateKey)) || "";
}

function saveLocalRecords(dateKey, records, updatedAt) {
  localStorage.setItem(getStorageKey(dateKey), JSON.stringify(records));
  localStorage.setItem(getUpdatedKey(dateKey), updatedAt);
}

function mergeRecords(localRecords, cloudRecords) {
  const merged = { ...cloudRecords };
  Object.entries(localRecords).forEach(([step, value]) => {
    if (!merged[step]) {
      merged[step] = value;
    }
  });
  return merged;
}

async function getCloudDocRef(dateKey) {
  const syncId = await hashSyncCode(localStorage.getItem(SYNC_CODE_KEY));
  const docId = `${appMode}_${dateKey}`;
  return db.collection("sync").doc(syncId).collection("data").doc(docId);
}

async function fetchCloudDoc(dateKey) {
  const docRef = await getCloudDocRef(dateKey);
  const snapshot = await docRef.get();
  if (!snapshot.exists) {
    return null;
  }
  const data = snapshot.data();
  return {
    records: data.records || {},
    updatedAt: data.updatedAt || "",
  };
}

async function writeCloudDoc(dateKey, records, updatedAt) {
  const docRef = await getCloudDocRef(dateKey);
  await docRef.set({ records, updatedAt });
}

function updateSyncStatusUI() {
  const statusEl = document.getElementById("syncStatus");
  if (!statusEl) {
    return;
  }

  const status = TimeSync.getStatus();
  const labels = {
    disabled: "同步未配置",
    ready: "未设置同步码",
    ok: "已同步",
    offline: "离线（仅本机）",
  };

  statusEl.textContent = labels[status] || labels.disabled;
  statusEl.dataset.status = status;
}

function setupSyncUI() {
  const syncBtn = document.getElementById("syncSettingsBtn");
  const pullBtn = document.getElementById("syncPullBtn");
  const modal = document.getElementById("syncModal");
  const backdrop = document.getElementById("syncBackdrop");
  const saveBtn = document.getElementById("syncSaveBtn");
  const cancelBtn = document.getElementById("syncCancelBtn");
  const inputEl = document.getElementById("syncCodeInput");

  if (!syncBtn || !modal) {
    return;
  }

  updateSyncStatusUI();

  syncBtn.addEventListener("click", () => {
    if (!TimeSync.isConfigured()) {
      window.alert(
        "请先在 firebase-config.js 填入 Firebase 配置，并在 Firebase 控制台启用 Firestore。"
      );
      return;
    }
    inputEl.value = TimeSync.getSyncCode();
    modal.hidden = false;
  });

  const closeModal = () => {
    modal.hidden = true;
  };

  cancelBtn.addEventListener("click", closeModal);
  backdrop.addEventListener("click", closeModal);

  saveBtn.addEventListener("click", async () => {
    try {
      await TimeSync.setSyncCode(inputEl.value);
      closeModal();
      window.alert("同步码已保存，本机历史记录已尝试上传到云端。");
      if (typeof window.onSyncSettingsSaved === "function") {
        await window.onSyncSettingsSaved();
      }
    } catch (error) {
      window.alert(error.message || "保存同步码失败");
    }
  });

  if (pullBtn) {
    pullBtn.addEventListener("click", async () => {
      if (!TimeSync.isEnabled()) {
        window.alert("请先设置同步码。");
        return;
      }
      if (typeof window.onManualSync === "function") {
        await window.onManualSync();
      }
      window.alert("已从云端拉取并合并当前日期记录。");
    });
  }
}

document.addEventListener("DOMContentLoaded", setupSyncUI);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch((error) => {
      console.error("Service Worker 注册失败：", error);
    });
  });
}
