let isEnabled = true;

function isContextValid() {
    return !!chrome.runtime?.id;
}

function sendLog(msg) {
    console.log('[WS-DB] ' + msg);
    if (!isContextValid()) return;
    chrome.runtime.sendMessage({ type: 'WS_DB_LOG', msg: msg });
}

sendLog('content.js 已加载');

chrome.storage.local.get('enabled', (result) => {
    if (!isContextValid()) return;
    isEnabled = result.enabled !== false;
    sendLog('初始状态: ' + (isEnabled ? '启用' : '禁用'));
    injectScript();
    if (!isEnabled) {
        setTimeout(() => {
            if (!isContextValid()) return;
            window.postMessage({
                type: 'WS_DB_QUERY_TOGGLE',
                enabled: false
            }, window.location.origin);
            sendLog('已通知 inject.js 禁用');
        }, 100);
    }
});

function injectScript() {
    sendLog('正在注入 inject.js');
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('inject.js');
    script.onload = function () {
        sendLog('inject.js 注入成功');
    };
    script.onerror = function () {
        sendLog('inject.js 注入失败');
    };
    (document.head || document.documentElement).appendChild(script);
}

chrome.runtime.onMessage.addListener((message) => {
    if (!isContextValid()) return;
    if (message.type === 'WS_DB_QUERY_TOGGLE') {
        isEnabled = message.enabled;
        window.postMessage({
            type: 'WS_DB_QUERY_TOGGLE',
            enabled: message.enabled
        }, window.location.origin);
        sendLog('插件状态: ' + (message.enabled ? '已启用' : '已禁用'));
    }
});

window.addEventListener('message', (event) => {

    if (event.source !== window) return;

    if (!isEnabled) return;

    if (event.data.type === 'WS_DB_QUERY_RESULT') {
        sendLog('收到来自 inject.js 的数据，正在转发给 background.js');

        if (!isContextValid()) {
            sendLog('扩展上下文已失效，请刷新页面');
            return;
        }

        chrome.runtime.sendMessage({
            type: 'WS_DB_QUERY_RESULT',
            payload: event.data.payload
        });

    }

    if (event.data.type === 'WS_DB_LOG') {
        if (!isContextValid()) return;
        chrome.runtime.sendMessage({
            type: 'WS_DB_LOG',
            msg: event.data.msg
        });
    }

});
