console.log('[WS-DB] background.js 已加载');

let latestResult = null;
const MAX_LOGS = 200;

function addLog(msg) {
    const now = new Date();
    const time = [now.getHours(), now.getMinutes(), now.getSeconds()]
        .map(n => String(n).padStart(2, '0')).join(':');
    const entry = { time, msg };

    chrome.storage.local.get('logs', (result) => {
        const logs = result.logs || [];
        logs.push(entry);
        if (logs.length > MAX_LOGS) {
            logs.splice(0, logs.length - MAX_LOGS);
        }
        chrome.storage.local.set({ logs });
    });
}

addLog('background.js 已加载');

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

    if (message.type === 'WS_DB_QUERY_RESULT') {
        console.log('[WS-DB] background.js 收到数据');
        console.log('[WS-DB] 来源页面:', sender.tab?.url || 'unknown');

        latestResult = message.payload;

        chrome.storage.local.set({ latestResult }).then(() => {
            console.log('[WS-DB] 数据已存储到 chrome.storage');
        }).catch((err) => {
            console.error('[WS-DB] 存储失败:', err);
        });

        addLog('收到查询结果 (' + sender.tab?.url + ')');
    }

    if (message.type === 'WS_DB_LOG') {
        addLog(message.msg);
    }

    if (message.type === 'WS_DB_GET_LOGS') {
        chrome.storage.local.get('logs', (result) => {
            sendResponse({ logs: result.logs || [] });
        });
        return true;
    }

});
