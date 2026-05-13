# WS DB Query Viewer

一个 Chrome 浏览器扩展，用于拦截 WebSocket 中的数据库查询结果，并以表格形式展示。

## 功能特性

- Hook 页面中的 WebSocket 通信
- 自动解析 STOMP 协议消息
- 表格展示数据库查询结果（数据库类型、耗时、返回行数）
- **导出功能**：支持 CSV、Excel（.xlsx）文件导出
- **复制功能**：支持复制为 JSON / CSV / Markdown 格式
- **单元格操作**：单击复制整行/整列，双击复制单个单元格
- 启用/禁用拦截开关
- 运行日志查看

## 工作原理

```
页面上下文 (inject.js)
    └─ Hook WebSocket，检测 STOMP 消息中的 /user/dataQuery/result
    └─ 通过 window.postMessage 发送 → content.js

Content Script (content.js)
    └─ 接收 postMessage，通过 chrome.runtime.sendMessage 转发 → background.js

Background Service Worker (background.js)
    └─ 接收消息，存储到 chrome.storage.local

Popup UI (popup.html / popup.js)
    └─ 从 storage 读取数据，渲染表格
```

## 安装

1. 打开 `chrome://extensions`
2. 开启右上角「开发者模式」
3. 点击「加载已解压的扩展程序」，选择本项目目录

## 使用

1. 打开目标系统（数据查询平台、在线 SQL 工具等）
2. 执行 SQL 查询
3. 点击浏览器工具栏中的插件图标，即可查看结果表格

## 当前支持

解析 STOMP WebSocket 消息，匹配目标：

```
destination:/user/dataQuery/result
```

如需支持其他 STOMP 目标，修改 `inject.js` 中的过滤条件即可。

## 项目结构

```
ws-db-query-plugin/
├── manifest.json          # 扩展配置（Manifest V3）
├── background.js          # Service Worker，存储拦截数据
├── content.js             # Content Script，桥接页面与扩展
├── inject.js              # 注入页面上下文，Hook WebSocket
├── popup.html             # Popup 页面
├── popup.js               # Popup 逻辑（渲染、导出、复制）
├── popup.css              # Popup 样式
├── xlsx.full.min.js       # SheetJS 库，用于导出 Excel
└── README.md
```

## License

MIT
