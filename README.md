# 上班时间记录

一款轻量的通勤打卡 PWA，用于记录每天上班、下班各步骤的到达时间，并统计相邻步骤耗时与历史对比。

## 功能

- **上班打卡** — 从起床到公司，逐步记录时间戳
- **下班打卡** — 从出办公室到家，逐步记录时间戳
- **时间统计** — 计算相邻步骤间隔、总耗时，并与历史中位数对比
- **历史查看** — 按日期回看任意一天的打卡记录
- **跨设备同步** — 通过 Firebase Firestore + 同步码，在多台设备间共享数据
- **离线可用** — 数据优先存于 `localStorage`，配合 Service Worker 缓存，无网也能打卡

## 打卡步骤

### 上班

| 步骤 |
|------|
| 起床 → 吃完饭出发 → 到地铁站 → 上地铁 → 过完关 → 上港铁 → 到大学站 → 上巴士 → 到公司 |

记录「到地铁站」时，可选择 **骑车** 或 **走路**。

### 下班

| 步骤 |
|------|
| 出办公室 → 会合 → 上巴士 → 到大学站 → 上港铁 → 过完关 → 上地铁 → 到家 |

## 快速开始

### 本地运行

本项目为纯静态前端，无需构建步骤。任选一种方式即可：

```bash
# 方式一：Python
python -m http.server 8080

# 方式二：Node.js（需安装 npx）
npx serve .
```

浏览器访问 `http://localhost:8080` 即可使用。

### 安装到手机 / 桌面（PWA）

在支持 PWA 的浏览器中打开页面，选择「添加到主屏幕」或「安装应用」，即可像原生 App 一样使用。

## 云端同步（可选）

跨设备同步需要自行配置 Firebase：

1. 在 [Firebase 控制台](https://console.firebase.google.com/) 创建项目，启用 **Firestore**
2. 添加 Web 应用，复制配置信息
3. 编辑 `firebase-config.js`，填入你的 Firebase 配置：

```js
window.FIREBASE_CONFIG = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID",
};
```

4. 在应用中点击 **同步设置**，输入至少 6 位的同步码
5. 在另一台设备输入相同同步码，即可共享打卡记录

> 同步码经 SHA-256 哈希后作为 Firestore 文档 ID，不会以明文存储在云端。

不配置 Firebase 时，应用仍可正常使用，数据仅保存在本机。

## 项目结构

```
├── index.html          # 上班打卡页
├── offwork.html        # 下班打卡页
├── stats.html          # 统计页
├── app.js              # 上班打卡逻辑
├── offwork.js          # 下班打卡逻辑
├── stats.js            # 统计与对比逻辑
├── sync.js             # 本地存储 + Firebase 同步
├── firebase-config.js  # Firebase 配置（需自行填写）
├── sw.js               # Service Worker（离线缓存）
├── style.css           # 样式
├── manifest.webmanifest
└── icons/              # PWA 图标
```

## 技术栈

- 原生 HTML / CSS / JavaScript（无框架、无构建工具）
- [localStorage](https://developer.mozilla.org/zh-CN/docs/Web/API/Window/localStorage) 本地持久化
- [Firebase Firestore](https://firebase.google.com/docs/firestore) 可选云端同步
- [Service Worker](https://developer.mozilla.org/zh-CN/docs/Web/API/Service_Worker_API) + Web App Manifest

## 统计说明

统计页会基于选定日期的打卡记录计算：

- 相邻步骤之间的时间间隔
- 上班 / 下班全程总耗时
- 与历史同日步骤间隔的 **中位数** 对比（快/慢多少）
- 上班与下班总耗时的横向对比

## License

MIT
