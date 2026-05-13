let currentMeta = null;
let currentRows = null;
let copyStatusTimer = null;

async function loadData() {

    const result = await chrome.storage.local.get(['latestResult', 'enabled']);

    const enabled = result.enabled !== false;

    document.getElementById('enableToggle').checked = enabled;
    updateEnableLabel(enabled);

    const data = result.latestResult;

    if (!data) {

        document.getElementById('sqlInfo').innerHTML = '';
        resetToolbar();
        renderLogs();

        return;
    }

    if (!data.data || !Array.isArray(data.data.executeResultList) || data.data.executeResultList.length === 0) {

        document.getElementById('sqlInfo').innerHTML = '';
        resetToolbar();
        renderLogs();

        return;
    }

    const executeResult = data.data.executeResultList[0];

    const meta = executeResult.meta;
    const rows = executeResult.data;

    renderInfo(executeResult);
    renderTable(meta, rows);

    currentMeta = meta;
    currentRows = rows;
    enableToolbar();
}

function renderInfo(executeResult) {

    const dbType = escapeHtml(executeResult.dbType);
    const elapsedTime = escapeHtml(executeResult.elapsedTime);
    const rowCount = Array.isArray(executeResult.data) ? executeResult.data.length : 0;

    const html = `
        <div>
            <b>数据库类型：</b>${dbType}
            &nbsp;&nbsp;
            <b>耗时：</b>${elapsedTime} ms
            &nbsp;&nbsp;
            <b>返回行数：</b>${rowCount}
        </div>
    `;

    document.getElementById('sqlInfo').innerHTML = html;
}

function escapeHtml(str) {
    if (str === null || str === undefined) {
        return '';
    }
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
}

function escapeMarkdown(s) {
    return String(s).replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function renderTable(meta, rows) {

    const container = document.getElementById('tableContainer');

    if (!meta || !Array.isArray(meta) || meta.length === 0) {
        container.innerHTML = '<p>无列信息</p>';
        return;
    }

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
        container.innerHTML = '<p>无数据</p>';
        return;
    }

    let html = '<table>';

    html += '<tr>';
    html += '<th>#</th>';

    meta.forEach((col, i) => {
        html += `<th data-col-index="${i}" title="点击复制该列数据">${escapeHtml(col.columnName)}</th>`;
    });

    html += '</tr>';

    rows.forEach((row, rowIndex) => {

        html += '<tr>';
        html += `<td data-row-index="${rowIndex}">${rowIndex + 1}</td>`;

        meta.forEach((col, index) => {
            const key = 'col' + (index + 1);
            html += `<td>${escapeHtml(row[key])}</td>`;
        });

        html += '</tr>';

    });

    html += '</table>';

    container.innerHTML = html;

    container.querySelectorAll('th[data-col-index]').forEach(th => {
        th.addEventListener('click', function () {
            const colIndex = parseInt(this.getAttribute('data-col-index'));
            const colName = meta[colIndex].columnName;
            const key = 'col' + (colIndex + 1);
            const values = rows.map(row => row[key] === undefined ? '' : String(row[key]));
            const text = [colName, ...values].join('\n');
            copyText(text, `"${colName}" 列`);

            this.style.backgroundColor = '#dbeafe';
            setTimeout(() => { this.style.backgroundColor = ''; }, 300);
        });
    });

    container.querySelectorAll('td[data-row-index]').forEach(td => {
        td.addEventListener('click', function () {
            const rowIndex = parseInt(this.getAttribute('data-row-index'));
            const row = rows[rowIndex];
            const values = meta.map((col, i) => {
                const val = row['col' + (i + 1)];
                return col.columnName + ': ' + (val === undefined ? '' : val);
            });
            copyText(values.join('\n'), '第 ' + (rowIndex + 1) + ' 行');

            this.style.backgroundColor = '#fef3c7';
            setTimeout(() => { this.style.backgroundColor = ''; }, 300);
        });
    });

    container.querySelectorAll('td').forEach(td => {
        td.addEventListener('dblclick', function () {
            const text = this.textContent.trim();
            if (text) {
                copyText(text, '单元格');
                this.style.backgroundColor = '#dcfce7';
                setTimeout(() => { this.style.backgroundColor = ''; }, 300);
            }
        });
    });

}

// ---- 日志展示 ----

async function renderLogs() {
    const container = document.getElementById('tableContainer');
    const logs = await new Promise(resolve => {
        chrome.runtime.sendMessage({ type: 'WS_DB_GET_LOGS' }, resp => {
            resolve(resp?.logs || []);
        });
    });

    if (logs.length === 0) {
        container.innerHTML = '<div class="log-empty">暂无数据，请先打开目标系统并执行 SQL。<br>日志将在插件运行后显示。</div>';
        return;
    }

    let html = '<div class="log-container">';
    html += '<div class="log-header">运行日志</div>';
    logs.forEach(log => {
        html += `<div class="log-entry"><span class="log-time">${escapeHtml(log.time)}</span> ${escapeHtml(log.msg)}</div>`;
    });
    html += '</div>';
    container.innerHTML = html;
}

// ---- 格式化函数 ----

function getColumnNames(meta) {
    return meta.map(col => col.columnName);
}

function toRows(meta, rows) {
    return rows.map(row =>
        meta.map((_, i) => row['col' + (i + 1)] === undefined ? '' : row['col' + (i + 1)])
    );
}

function formatCSV(meta, rows) {
    const keys = getColumnNames(meta);
    const data = toRows(meta, rows);
    return [keys, ...data]
        .map(row => row.map(cell => String(cell)).join(','))
        .join('\n');
}

function formatMarkdown(meta, rows) {
    const keys = getColumnNames(meta);
    const header = '|' + keys.join('|') + '|\n|' + keys.map(() => '---').join('|') + '|\n';
    const data = toRows(meta, rows);
    const body = data.map(row =>
        '|' + row.map(cell => escapeMarkdown(cell)).join('|') + '|'
    ).join('\n');
    return header + body;
}

function formatJSON(meta, rows) {
    const keys = getColumnNames(meta);
    const arr = rows.map(row => {
        const obj = {};
        meta.forEach((col, i) => {
            obj[keys[i]] = row['col' + (i + 1)] === undefined ? '' : row['col' + (i + 1)];
        });
        return obj;
    });
    return JSON.stringify(arr, null, 2);
}

// ---- 复制/导出函数 ----

function copyText(text, label) {
    navigator.clipboard.writeText(text).then(() => {
        showCopyStatus(`已复制 ${label} 到剪贴板`, 'green');
    }).catch(() => {
        showCopyStatus('复制失败', 'red');
    });
}

function showCopyStatus(message, color) {
    const el = document.getElementById('copyStatus');
    el.textContent = message;
    el.style.color = color;
    if (copyStatusTimer) clearTimeout(copyStatusTimer);
    copyStatusTimer = setTimeout(() => {
        el.textContent = '';
        el.style.color = '';
        copyStatusTimer = null;
    }, 3000);
}

function exportCSV() {
    const csv = formatCSV(currentMeta, currentRows);
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'data.csv';
    a.click();
    URL.revokeObjectURL(a.href);
    showCopyStatus('已导出 CSV', 'green');
}

function exportXlsx() {
    if (typeof XLSX === 'undefined') {
        showCopyStatus('XLSX 库未加载', 'red');
        return;
    }
    const keys = getColumnNames(currentMeta);
    const data = toRows(currentMeta, currentRows);
    const aoa = [keys, ...data];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    XLSX.writeFile(wb, 'data.xlsx');
    showCopyStatus('已导出 Excel', 'green');
}

// ---- 工具栏状态控制 ----

function enableToolbar() {
    document.getElementById('copyJsonBtn').disabled = false;
    document.getElementById('copyCsvBtn').disabled = false;
    document.getElementById('copyMdBtn').disabled = false;
    document.getElementById('exportCsvBtn').disabled = false;
    document.getElementById('exportXlsxBtn').disabled = false;
}

function resetToolbar() {
    currentMeta = null;
    currentRows = null;
    document.getElementById('copyJsonBtn').disabled = true;
    document.getElementById('copyCsvBtn').disabled = true;
    document.getElementById('copyMdBtn').disabled = true;
    document.getElementById('exportCsvBtn').disabled = true;
    document.getElementById('exportXlsxBtn').disabled = true;
}

// ---- 事件绑定 ----

document.getElementById('refreshBtn').addEventListener('click', loadData);

document.getElementById('clearBtn').addEventListener('click', async () => {
    await chrome.storage.local.remove('latestResult');
    document.getElementById('sqlInfo').innerHTML = '';
    resetToolbar();
    renderLogs();
});

document.getElementById('enableToggle').addEventListener('change', async (e) => {
    const enabled = e.target.checked;
    await chrome.storage.local.set({ enabled });
    updateEnableLabel(enabled);
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
            chrome.tabs.sendMessage(tabs[0].id, {
                type: 'WS_DB_QUERY_TOGGLE',
                enabled
            });
        }
    });
});

document.getElementById('copyJsonBtn').addEventListener('click', () => {
    copyText(formatJSON(currentMeta, currentRows), 'JSON');
});

document.getElementById('copyCsvBtn').addEventListener('click', () => {
    copyText(formatCSV(currentMeta, currentRows), 'CSV');
});

document.getElementById('copyMdBtn').addEventListener('click', () => {
    copyText(formatMarkdown(currentMeta, currentRows), 'Markdown');
});

document.getElementById('exportCsvBtn').addEventListener('click', exportCSV);
document.getElementById('exportXlsxBtn').addEventListener('click', exportXlsx);

function updateEnableLabel(enabled) {
    document.getElementById('enableLabel').textContent = enabled ? '已启用' : '已禁用';
}

loadData();