(function () {

    function log(msg) {
        console.log('[WS-DB] ' + msg);
        try {
            window.postMessage({ type: 'WS_DB_LOG', msg: msg }, window.location.origin);
        } catch (e) { /* ignore */ }
    }

    log('inject.js 已加载，WebSocket hook 开始');

    function unpackSockJS(text) {
        if (text.startsWith('a[')) {
            try {
                const arr = JSON.parse(text.substring(1));
                return arr;
            } catch (e) {
                console.warn('[WS-DB] SockJS 解包失败:', e);
                return null;
            }
        }
        return [text];
    }

    const OldWebSocket = window.WebSocket;

    window.WebSocket = function (...args) {

        log('检测到 WebSocket 创建，URL: ' + args[0]);

        const ws = new OldWebSocket(...args);

        ws.addEventListener('message', (event) => {

            try {

                const text = event.data;

                if (typeof text !== 'string') return;

                const messages = unpackSockJS(text);

                if (!messages) return;

                for (const msg of messages) {

                    if (!msg.includes('/user/dataQuery/result')) continue;

                    log('检测到目标 destination，开始解析');

                    const bodyIndex = msg.indexOf('\n\n');

                    if (bodyIndex === -1) {
                        log('未找到 STOMP body 分隔符');
                        continue;
                    }

                    let body = msg.substring(bodyIndex + 2);

                    body = body.replace(/\0/g, '');

                    const json = JSON.parse(body);

                    log('JSON 解析成功，数据长度: ' + JSON.stringify(json).length);

                    window.postMessage({
                        type: 'WS_DB_QUERY_RESULT',
                        payload: json
                    }, window.location.origin);

                    log('数据已发送给 content.js');

                }

            } catch (e) {

                console.error('[WS-DB] 解析 websocket 消息失败', e);

            }

        });

        return ws;
    };

    window.WebSocket.prototype = OldWebSocket.prototype;

    log('WebSocket hook 完成');

})();