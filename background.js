console.log('[WS-DB] background.js 已加载');

let latestResult = null;
const MAX_LOGS = 200;
const CONTENT_SCRIPT_ID_PREFIX = 'ws-db-query-';

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

// ---- Whitelist Management ----

async function getWhitelist() {
    const result = await chrome.storage.local.get('whitelist');
    return result.whitelist || [];
}

async function saveWhitelist(whitelist) {
    await chrome.storage.local.set({ whitelist });
}

function domainToScriptId(domain) {
    return CONTENT_SCRIPT_ID_PREFIX + domain.replace(/[^a-zA-Z0-9._-]/g, '_');
}

async function registerDomain(domain) {
    const id = domainToScriptId(domain);
    try {
        await chrome.scripting.registerContentScripts([{
            id: id,
            matches: [domain],
            js: ['content.js'],
            runAt: 'document_start'
        }]);
        addLog('已注册内容脚本: ' + domain);
    } catch (e) {
        if (e.message && e.message.includes('Duplicate')) {
            await chrome.scripting.unregisterContentScripts({ ids: [id] });
            await chrome.scripting.registerContentScripts([{
                id: id,
                matches: [domain],
                js: ['content.js'],
                runAt: 'document_start'
            }]);
            addLog('已重新注册内容脚本: ' + domain);
        } else {
            addLog('注册内容脚本失败: ' + domain + ' - ' + e.message);
        }
    }
}

async function unregisterDomain(domain) {
    const id = domainToScriptId(domain);
    try {
        await chrome.scripting.unregisterContentScripts({ ids: [id] });
        addLog('已注销内容脚本: ' + domain);
    } catch (e) {
        addLog('注销内容脚本失败: ' + domain + ' - ' + e.message);
    }
}

async function registerAllWhitelistedDomains() {
    const whitelist = await getWhitelist();
    for (const domain of whitelist) {
        await registerDomain(domain);
    }
    if (whitelist.length > 0) {
        addLog('已注册 ' + whitelist.length + ' 个域名的内容脚本');
    }
}

// ---- Lifecycle Events ----

chrome.runtime.onInstalled.addListener(async (details) => {
    addLog('扩展已安装/更新: ' + details.reason);
    await registerAllWhitelistedDomains();
});

chrome.runtime.onStartup.addListener(async () => {
    addLog('浏览器启动，重新注册内容脚本');
    await registerAllWhitelistedDomains();
});

// ---- Message Handlers ----

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

    // Whitelist message handlers (async)
    if (message.type === 'WS_DB_GET_WHITELIST') {
        getWhitelist().then(whitelist => {
            sendResponse({ whitelist });
        });
        return true;
    }

    if (message.type === 'WS_DB_ADD_DOMAIN') {
        (async () => {
            const domain = message.domain;
            const whitelist = await getWhitelist();
            if (!whitelist.includes(domain)) {
                whitelist.push(domain);
                await saveWhitelist(whitelist);
                await registerDomain(domain);
                addLog('已添加域名到白名单: ' + domain);
            }
            sendResponse({ success: true, whitelist });
        })();
        return true;
    }

    if (message.type === 'WS_DB_REMOVE_DOMAIN') {
        (async () => {
            const domain = message.domain;
            let whitelist = await getWhitelist();
            whitelist = whitelist.filter(d => d !== domain);
            await saveWhitelist(whitelist);
            await unregisterDomain(domain);
            addLog('已从白名单移除域名: ' + domain);
            sendResponse({ success: true, whitelist });
        })();
        return true;
    }

});