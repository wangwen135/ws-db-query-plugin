function isContextValid() {
    return !!chrome.runtime?.id;
}

function sendLog(msg) {
    console.log('[WS-DB] ' + msg);
    if (!isContextValid()) return;
    chrome.runtime.sendMessage({ type: 'WS_DB_LOG', msg: msg });
}

sendLog('content.js 已加载');

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

injectScript();

window.addEventListener('message', (event) => {

    if (event.source !== window) return;

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