// ==UserScript==
// @name         光鸭TMDB助手 By宝宝 QQ479874394
// @namespace    http://tampermonkey.net/
// @version      1
// @description  终极过滤版
// @author       宝宝
// @match        *://*.guangyapan.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @connect      api.zhconvert.org
// @connect      *
// ==/UserScript==

(function() {
    'use strict';

    const $ = s => document.querySelector(s);
    const $$ = s => document.querySelectorAll(s);

    // ================= 1. UI 样式 =================
    GM_addStyle(`
        :root{--v-bg:rgba(20,20,22,0.45);--v-border:rgba(255,255,255,0.18);--v-border-hl:rgba(255,255,255,0.4);--v-text:#fff;--v-text-m:rgba(255,255,255,0.55);--v-blue:#0A84FF;--v-red:#FF453A;--v-rm:28px;--v-ri:14px;--v-font:"SF Pro Display",-apple-system,BlinkMacSystemFont,sans-serif;}

        #tmdb-ui-container{
            position:fixed; bottom:35px; right:35px; width:420px;
            background:var(--v-bg); color:var(--v-text);
            border:1px solid var(--v-border); border-radius:var(--v-rm);
            box-shadow:0 30px 60px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.2);
            backdrop-filter:blur(50px) saturate(200%); -webkit-backdrop-filter:blur(50px) saturate(200%);
            z-index:99998; font-family:var(--v-font); display:flex; flex-direction:column; overflow:hidden;
            transition: width 0.5s cubic-bezier(0.34, 1.2, 0.64, 1),
                        border-radius 0.5s cubic-bezier(0.34, 1.2, 0.64, 1),
                        background 0.5s ease;
        }

        #tmdb-ui-container.collapsed {
            width: 260px; cursor: pointer; border-radius: 30px; background: rgba(20,20,22,0.85);
        }

        #tmdb-ui-header {
            padding:20px 24px 20px; font-weight:700; font-size:18px;
            display:flex; justify-content:space-between; align-items:center;
            transition: padding 0.5s cubic-bezier(0.34, 1.2, 0.64, 1), font-size 0.5s ease;
            white-space: nowrap;
        }

        #tmdb-title-text {
            -webkit-user-select: none;
            -moz-user-select: none;
            -ms-user-select: none;
            user-select: none;
            pointer-events: none;
        }

        #tmdb-ui-container.collapsed #tmdb-ui-header { padding: 16px 20px; font-size: 15px; }

        .tmdb-collapse-btn {
            cursor:pointer; opacity:0.6; transition:all 0.4s cubic-bezier(0.34, 1.2, 0.64, 1);
            font-size:24px; line-height:0.8; width:26px; height:26px;
            display:flex; align-items:center; justify-content:center; border-radius:50%;
        }
        .tmdb-collapse-btn:hover { opacity:1; background:rgba(255,255,255,0.15); }
        #tmdb-ui-container.collapsed .tmdb-collapse-btn { transform: rotate(180deg); }

        .tmdb-ui-body {
            padding: 0 24px 24px;
            max-height: 800px; opacity: 1; transform: translateY(0) scale(1);
            transition: max-height 0.6s cubic-bezier(0.34, 1.2, 0.64, 1),
                        opacity 0.4s ease 0.1s, transform 0.5s cubic-bezier(0.34, 1.2, 0.64, 1),
                        padding 0.5s cubic-bezier(0.34, 1.2, 0.64, 1);
        }

        #tmdb-ui-container.collapsed .tmdb-ui-body {
            max-height: 0; opacity: 0; transform: translateY(-10px) scale(0.98);
            padding-bottom: 0; pointer-events: none;
            transition: max-height 0.5s cubic-bezier(0.34, 1, 0.64, 1), opacity 0.2s ease,
                        transform 0.4s ease, padding 0.5s cubic-bezier(0.34, 1, 0.64, 1);
        }

        .tmdb-input-row{display:flex;gap:14px;margin-bottom:18px;} .tmdb-input-group{flex:1;}
        .tmdb-input-group label{display:block;font-size:12px;font-weight:600;margin-bottom:8px;color:var(--v-text-m);}
        .tmdb-input-group input,.tmdb-input-group select{width:100%;padding:12px 16px;border-radius:var(--v-ri);border:1px solid rgba(255,255,255,0.08);background:rgba(0,0,0,0.3);color:#fff;outline:none;transition:all 0.3s;font-size:14px;font-family:var(--v-font);appearance:none;box-shadow:inset 0 2px 4px rgba(0,0,0,0.2);}
        .tmdb-input-group input:focus,.tmdb-input-group select:focus{border-color:var(--v-border-hl);background:rgba(255,255,255,0.05);box-shadow:0 0 0 4px rgba(255,255,255,0.1),inset 0 2px 4px rgba(0,0,0,0.2);}
        .tmdb-input-group select option{background:#1c1c1e;} .tmdb-input-group input[type="password"]{letter-spacing:4px;font-family:monospace;font-size:16px;}

        .tmdb-segment-control{display:flex;background:rgba(0,0,0,0.3);border-radius:var(--v-ri);padding:4px;border:1px solid rgba(255,255,255,0.08);gap:4px;}
        .tmdb-segment-btn{flex:1;background:transparent;border:none;color:var(--v-text-m);padding:9px 0;font-size:13px;font-weight:600;cursor:pointer;border-radius:10px;transition:all 0.2s;}
        .tmdb-segment-btn.active{background:rgba(255,255,255,0.15);color:#fff;box-shadow:0 2px 8px rgba(0,0,0,0.3);}
        .tmdb-segment-btn:hover:not(.active){background:rgba(255,255,255,0.05);}

        .tmdb-btn-group{display:flex;gap:12px;margin-bottom:20px;}
        .tmdb-btn{width:100%;border:1px solid rgba(255,255,255,0.1);padding:14px;border-radius:16px;cursor:pointer;font-weight:700;font-size:14px;font-family:var(--v-font);transition:all 0.3s;backdrop-filter:blur(20px);}
        .tmdb-btn:active{transform:scale(0.96);} .tmdb-btn:disabled{opacity:0.3;cursor:not-allowed;transform:none!important;}
        #tmdb-start-btn{background:rgba(255,255,255,0.9);color:#000;box-shadow:0 8px 20px rgba(255,255,255,0.2);}
        #tmdb-start-btn:hover:not(:disabled){background:#fff;box-shadow:0 10px 25px rgba(255,255,255,0.3);transform:translateY(-1px);}
        #tmdb-fix-btn{background:rgba(255,159,10,0.9);color:#000;box-shadow:0 8px 20px rgba(255,159,10,0.2);}
        #tmdb-fix-btn:hover:not(:disabled){background:#ff9f0a;box-shadow:0 10px 25px rgba(255,159,10,0.3);transform:translateY(-1px);}

        #tmdb-log{height:200px;overflow-y:auto;background:rgba(0,0,0,0.15);padding:16px;border-radius:var(--v-ri);font-size:13px;color:#d1d1d6;line-height:1.6;box-shadow:inset 0 2px 10px rgba(0,0,0,0.2);scrollbar-width:thin;}
        #tmdb-log p{margin:0 0 10px;border-bottom:1px solid rgba(255,255,255,0.03);padding-bottom:8px;} #tmdb-log p:last-child{border:none;margin:0;padding:0;}
        .log-error{color:var(--v-red);font-weight:700;} .log-warn{color:#ffd60a;} .log-info{color:#fff;font-weight:500;} .log-season{color:#30d158;font-weight:700;}

        .log-item-visual { display:flex; align-items:center; gap:12px; background:rgba(48,209,88,0.1); border:1px solid rgba(48,209,88,0.2); padding:10px; border-radius:12px; margin-bottom:10px; }
        .log-item-visual .log-poster { width:32px; height:48px; border-radius:4px; object-fit:cover; background:rgba(0,0,0,0.3); box-shadow:0 2px 6px rgba(0,0,0,0.3); flex-shrink:0;}
        .log-item-visual .log-details { display:flex; flex-direction:column; gap:4px; overflow:hidden; }
        .log-item-visual .log-old { font-size:11px; color:var(--v-text-m); text-decoration:line-through; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .log-item-visual .log-new { font-size:13px; font-weight:700; color:#30d158; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }

        #tmdb-modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:99999;display:flex;justify-content:center;align-items:center;backdrop-filter:blur(20px);}
        #tmdb-modal{background:var(--v-bg);width:500px;max-height:90vh;border-radius:var(--v-rm);border:1px solid var(--v-border);box-shadow:0 40px 100px rgba(0,0,0,0.6);backdrop-filter:blur(60px) saturate(200%);display:flex;flex-direction:column;}
        #tmdb-modal-header{padding:24px 24px 16px;font-size:20px;font-weight:700;color:#fff;text-align:center;}
        #tmdb-modal-body{padding:0 24px 10px; display:flex; flex-direction:column; overflow:hidden;}
        .tmdb-search-bar{display:flex;gap:12px;margin-bottom:16px;} .tmdb-search-bar input{flex:1;padding:14px 16px;border-radius:12px;background:rgba(0,0,0,0.3);color:#fff;border:1px solid rgba(255,255,255,0.1);outline:none;}
        .tmdb-search-bar button{background:rgba(255,255,255,0.9);color:#000;border:none;padding:0 24px;border-radius:12px;cursor:pointer;font-weight:700;}

        #tmdb-mr{flex:1; max-height:400px; overflow-y:auto; background:rgba(0,0,0,0.2); border-radius:16px; border:1px solid rgba(255,255,255,0.05); scrollbar-width:thin;}
        #tmdb-mr::-webkit-scrollbar { width: 6px; }
        #tmdb-mr::-webkit-scrollbar-thumb { background-color: rgba(255,255,255,0.25); border-radius: 10px; }

        .tmdb-result-item{padding:12px 16px;border-bottom:1px solid rgba(255,255,255,0.03);cursor:pointer;display:flex;align-items:center;gap:14px;}
        .tmdb-result-item:hover{background:rgba(255,255,255,0.1);}
        .tmdb-result-poster{width:42px;height:63px;border-radius:6px;object-fit:cover;background:rgba(255,255,255,0.05);flex-shrink:0;}
        .tmdb-result-info{flex:1;display:flex;justify-content:space-between;align-items:center;}
        .tmdb-result-title{font-size:15px;color:#fff;font-weight:600;} .tmdb-result-year{font-size:13px;color:var(--v-text-m);margin-right:12px;}
        .tmdb-result-type{font-size:11px;font-weight:700;padding:4px 8px;border-radius:8px;background:rgba(255,255,255,0.15);color:#fff;}

        .tmdb-modal-footer{padding:20px 24px;background:rgba(0,0,0,0.1);display:flex;gap:16px; margin-top: auto;} .tmdb-modal-footer button{flex:1;padding:14px;border-radius:14px;cursor:pointer;font-weight:600;}
        .tmdb-btn-skip{background:rgba(255,255,255,0.1);color:#fff;border:1px solid rgba(255,255,255,0.05);} .tmdb-btn-stop{background:rgba(255,69,58,0.2);color:var(--v-red);border:1px solid rgba(255,69,58,0.3);}
    `);

    // ================= 2. 核心辅助函数 =================
    const addLog = (msg, type = 'normal') => {
        const logBox = $('#tmdb-log');
        if (type === 'raw') {
            logBox.insertAdjacentHTML('beforeend', msg);
        } else {
            logBox.insertAdjacentHTML('beforeend', `<p class="${type !== 'normal' ? 'log-' + type : ''}">${msg}</p>`);
        }
        logBox.scrollTop = logBox.scrollHeight;
    };

    const sanitize = n => n?.replace(/[:?*|"<>\/\\]/g, m => ({':':'：','?':'？','*':'＊','|':'｜','"':'”','<':'《','>':'》','/':'／','\\':'＼'})[m]).trim() || '';

    const cnToNum = s => {
        if (!s || !isNaN(s)) return +s || null;
        const map = {'一':1, '二':2, '三':3, '四':4, '五':5, '六':6, '七':7, '八':8, '九':9, '十':10};
        return s.includes('十') ? ((map[s.split('十')[0]] || 1) * 10 + (map[s.split('十')[1]] || 0)) : map[s];
    };

    const observeDOM = (sel, timeout, waitDisappear = false) => new Promise(res => {
        let el = document.querySelector(sel);
        if ((!!el) !== waitDisappear) return res(!waitDisappear ? el : true);
        const obs = new MutationObserver(() => {
            el = document.querySelector(sel);
            if ((!!el) !== waitDisappear) { obs.disconnect(); res(!waitDisappear ? el : true); }
        });
        obs.observe(document.body, { childList: true, subtree: true });
        setTimeout(() => { obs.disconnect(); res(waitDisappear ? !document.querySelector(sel) : null); }, timeout);
    });

    // ================= 3. UI 构建与事件 =================
    function createUI() {
        if ($('#tmdb-ui-container')) return;
        const getVal = (k, def) => GM_getValue(k, def);
        const sel = (k, val) => getVal(k, 'multi') === val ? 'active' : '';
        const bSel = (k, val) => getVal(k, 'title_only') === val ? 'selected' : '';
        const isCollapsed = getVal('tmdb_ui_collapsed', false);

        document.body.insertAdjacentHTML('beforeend', `
            <div id="tmdb-ui-container" class="${isCollapsed ? 'collapsed' : ''}">
                <div id="tmdb-ui-header">
                    <span id="tmdb-title-text">光鸭TMDB助手 By宝宝 QQ479874394</span>
                    <span class="tmdb-collapse-btn" title="收起/展开面板">${isCollapsed ? '+' : '−'}</span>
                </div>
                <div class="tmdb-ui-body">
                    <div class="tmdb-input-row">
                        <div class="tmdb-input-group"><label>Auth Key</label><input type="password" id="tmdb-api" value="${getVal('tmdb_api_key', '')}"></div>
                        <div class="tmdb-input-group"><label>Proxy Node</label><input type="text" id="tmdb-host" value="${getVal('tmdb_api_host', 'api.themoviedb.org')}"></div>
                    </div>
                    <div class="tmdb-input-row">
                        <div class="tmdb-input-group"><label>Target Class / 目标模式</label>
                            <div class="tmdb-segment-control" id="tmdb-mode-group">
                                <button class="tmdb-segment-btn ${sel('tmdb_search_mode','multi')}" data-val="multi">智能</button>
                                <button class="tmdb-segment-btn ${sel('tmdb_search_mode','movie')}" data-val="movie">电影</button>
                                <button class="tmdb-segment-btn ${sel('tmdb_search_mode','tv')}" data-val="tv">剧集</button>
                                <button class="tmdb-segment-btn ${sel('tmdb_search_mode','collection')}" data-val="collection">合集</button>
                            </div>
                        </div>
                        <div class="tmdb-input-group"><label>Typography / 命名排版</label>
                            <select id="tmdb-brackets">
                                <option value="title_only" ${bSel('tmdb_brackets_mode','title_only')}>《片名》 (年份)</option>
                                <option value="title_year" ${bSel('tmdb_brackets_mode','title_year')}>《片名 (年份)》</option>
                                <option value="none" ${bSel('tmdb_brackets_mode','none')}>纯文字 - 极简</option>
                            </select>
                        </div>
                    </div>
                    <div class="tmdb-btn-group">
                        <button id="tmdb-start-btn" class="tmdb-btn">开始刮削 (Auto)</button>
                        <button id="tmdb-fix-btn" class="tmdb-btn" title="选中识别有误的项目，强制调出搜索框">手动修正 (Fix)</button>
                    </div>
                    <div id="tmdb-log"><p class="log-info">System Online. 深度参数剥离引擎已上线。</p></div>
                </div>
            </div>
        `);


        const expectedTitle = "光鸭TMDB助手 By宝宝 QQ479874394";
        const titleEl = $('#tmdb-title-text');
        if (titleEl) {
            const antiTamper = new MutationObserver(() => {
                if (titleEl.innerText !== expectedTitle) titleEl.innerText = expectedTitle;
            });
            antiTamper.observe(titleEl, { childList: true, characterData: true, subtree: true });
        }

        $('#tmdb-ui-header').onclick = (e) => {
            const container = $('#tmdb-ui-container');
            container.classList.toggle('collapsed');
            const collapsedNow = container.classList.contains('collapsed');
            GM_setValue('tmdb_ui_collapsed', collapsedNow);
            $('.tmdb-collapse-btn').innerText = collapsedNow ? '+' : '−';
        };

        $('#tmdb-api').oninput = e => GM_setValue('tmdb_api_key', e.target.value.trim());
        $('#tmdb-host').oninput = e => GM_setValue('tmdb_api_host', e.target.value.trim().replace(/^https?:\/\//, '').replace(/\/$/, '') || 'api.themoviedb.org');
        $('#tmdb-brackets').onchange = e => GM_setValue('tmdb_brackets_mode', e.target.value);

        $$('.tmdb-segment-btn').forEach(btn => {
            btn.onclick = (e) => {
                $$('.tmdb-segment-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                GM_setValue('tmdb_search_mode', e.target.getAttribute('data-val'));
            };
        });

        $$('#tmdb-ui-container input, #tmdb-ui-container select').forEach(el => {
            ['keydown', 'keyup', 'keypress'].forEach(evt => el.addEventListener(evt, e => e.stopPropagation()));
        });

        $('#tmdb-start-btn').onclick = () => startBatchRename(false);
        $('#tmdb-fix-btn').onclick = () => startBatchRename(true);
    }

    // ================= 4. DOM 提取与改名 (双向核验执行器) =================
    async function unlockMultiSelectLimit() {
        let unchecked = 0;
        $$('input[type="checkbox"]').forEach(cb => {
            let isChecked = cb.checked || (cb.parentElement && /checked/i.test(cb.parentElement.className));
            if (isChecked) {
                let targetBtn = (cb.parentElement && !/TD|TR/i.test(cb.parentElement.tagName)) ? cb.parentElement : cb;
                targetBtn.click();
                unchecked++;
            }
        });
        if (unchecked) {
            addLog(`> 正在释放多选状态，避开菜单冲突...`, "info");
            await new Promise(r => setTimeout(r, 600));
        }
    }

    function getSelectedItemNames() {
        return Array.from($$('input[type="checkbox"]'))
            .filter(cb => cb.checked || cb.parentElement?.className.match(/checked/i))
            .map(cb => {
                let row = cb.closest('tr, [class*="row"], [class*="item"]');
                let text = row?.textContent || '';
                if (!row || text.match(/已选择|全选|文件名/)) return null;

                let nameRaw = "";
                let nameNode = row.querySelector('[class*="name"], [class*="title"], a[title]');
                if (nameNode) nameRaw = nameNode.getAttribute('title') || nameNode.textContent.split('\n')[0].trim();
                else nameRaw = text.split('\n').map(t=>t.trim()).filter(t => t && t !== '文件夹' && t !== '-' && !/^\d{4}-\d{2}-\d{2}|^\d{2}:\d{2}/.test(t)).sort((a,b)=>b.length-a.length)[0];

                return nameRaw ? nameRaw.replace(/\s*[-_]?\s*文件夹\s*\d{4}-\d{2}-\d{2}.*$/i, '').replace(/\s+\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}.*$/i, '').trim() : null;
            }).filter((n, i, arr) => n && arr.indexOf(n) === i);
    }

    async function executeRenameOnPage(oldName, newName) {
        if (oldName === newName) return;

        let strippedOld = oldName.replace(/\s+/g, '');

        let possibleRows = Array.from($$('tr, [class*="row"], [class*="item"], [class*="list-item"]')).filter(r => {
            let text = r.textContent || '';
            if (text.match(/已选择|全选|文件名/)) return false;
            return text.replace(/\s+/g, '').includes(strippedOld);
        });

        let liveRow = possibleRows.sort((a, b) => (a.textContent.length) - (b.textContent.length))[0];

        if (!liveRow) throw "核验失败：网页中找不到原文件 [" + oldName + "]";

        let cb = liveRow.querySelector('input[type="checkbox"]');
        if (cb) {
            let isChecked = cb.checked || (cb.parentElement && /checked/i.test(cb.parentElement.className));
            if (!isChecked) {
                let targetBtn = (cb.parentElement && !/TD|TR/i.test(cb.parentElement.tagName)) ? cb.parentElement : cb;
                targetBtn.click();
                await new Promise(r => setTimeout(r, 200));
            }
        } else {
            liveRow.click();
            await new Promise(r => setTimeout(r, 200));
        }

        const findRenameBtn = () => {
            let items = Array.from(document.querySelectorAll('span, div, a, button, li'));
            for (let el of items) {
                if (el.innerText && el.innerText.trim() === '重命名') {
                    let rect = el.getBoundingClientRect();
                    if (rect.width > 0 && rect.height > 0 && rect.top >= 0) return el;
                }
            }
            return null;
        };

        let renameBtn = liveRow.querySelector('[class*="rename" i], [class*="edit" i], [title*="重命名"]') || findRenameBtn();

        if (!renameBtn) {
            liveRow.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2, clientX: liveRow.getBoundingClientRect().x + 50, clientY: liveRow.getBoundingClientRect().y + 20 }));
            await new Promise(r => setTimeout(r, 200));
            renameBtn = findRenameBtn();
        }

        if (!renameBtn) throw "触发重命名按钮失败";
        renameBtn.click();

        let input = await observeDOM('input[type="text"]:not(#tmdb-api):not(#tmdb-host):not(#tmdb-mi)', 3000);
        if (!input) throw "输入框未就绪";

        (Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value')?.set || Object.getOwnPropertyDescriptor(input, 'value').set).call(input, newName);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        await new Promise(r => setTimeout(r, 100));

        let confirmBtn = input.parentElement.querySelector('.submit, .confirm, [class*="icon-check"], [class*="primary"]');
        if (confirmBtn && confirmBtn.type !== 'checkbox') confirmBtn.click();
        else input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));

        let inputGone = await observeDOM('input[type="text"]:not(#tmdb-api):not(#tmdb-host):not(#tmdb-mi)', 4000, true);
        if (!inputGone) throw "网络超时或拒绝改名";

        let strippedNew = newName.replace(/\s+/g, '');
        let verifySuccess = false;

        for (let t = 0; t < 15; t++) {
            await new Promise(r => setTimeout(r, 200));
            let nodes = Array.from(document.querySelectorAll('[title], [class*="name"], [class*="title"], a'));
            let found = nodes.some(n => {
                let txt = n.getAttribute('title') || n.innerText || n.textContent || '';
                return txt.replace(/\s+/g, '').includes(strippedNew);
            });

            if (found) {
                verifySuccess = true;
                break;
            }
        }

        if (!verifySuccess) {
            throw "页面未刷新，改名可能被服务器拒绝或过滤";
        }

        if (cb) {
            let stillChecked = cb.checked || (cb.parentElement && /checked/i.test(cb.parentElement.className));
            if (stillChecked) {
                let targetBtn = (cb.parentElement && !/TD|TR/i.test(cb.parentElement.tagName)) ? cb.parentElement : cb;
                targetBtn.click();
            }
        }
    }

    // ================= 5. 数据抓取与清洗 =================
    const fetchAPI = (url) => new Promise((res, rej) => GM_xmlhttpRequest({ method: "GET", url, onload: r => res(r.status===200 ? JSON.parse(r.responseText) : null), onerror: () => rej("Net Error") }));

    function convertToSimplified(text) {
        if (!text) return Promise.resolve(text);
        return new Promise(resolve => {
            GM_xmlhttpRequest({
                method: "POST", url: "https://api.zhconvert.org/convert",
                headers: { "Content-Type": "application/json" },
                data: JSON.stringify({ text: text, converter: "Simplified" }),
                onload: r => {
                    try {
                        let res = JSON.parse(r.responseText);
                        resolve((res.code === 0 && res.data && res.data.text) ? res.data.text : text);
                    } catch(e) { resolve(text); }
                },
                onerror: () => resolve(text)
            });
        });
    }

    async function fetchTmdbData(query, year, expected, mode, key, host) {
        let ep = mode === 'multi' ? 'multi' : mode;
        const doSearch = lang => fetchAPI(`https://${host}/3/search/${ep}?api_key=${key}&language=${lang}&query=${encodeURIComponent(query)}&page=1`);

        let data = await doSearch('zh-CN');
        let results = data?.results || [];

        if (results.length > 0 && !/[\u4e00-\u9fa5]/.test(results[0].title || results[0].name || '')) {
            let altData = await doSearch('zh-TW');
            if (!altData?.results?.length || !/[\u4e00-\u9fa5]/.test(altData.results[0].title || altData.results[0].name || '')) {
                altData = await doSearch('zh-HK');
            }

            if (altData?.results?.length && /[\u4e00-\u9fa5]/.test(altData.results[0].title || altData.results[0].name || '')) {
                results = altData.results;
                for (let i = 0; i < Math.min(results.length, 8); i++) {
                    if (results[i].title) results[i].title = await convertToSimplified(results[i].title);
                    if (results[i].name) results[i].name = await convertToSimplified(results[i].name);
                }
            }
        }

        return results.map(r => ({
            id: r.id,
            title: r.title || r.name || 'Unknown',
            year: (r.release_date || r.first_air_date || '').substring(0, 4) || 'N/A',
            media_type: r.media_type || (mode !== 'multi' ? mode : 'unknown'),
            poster: r.poster_path ? `https://image.tmdb.org/t/p/w92${r.poster_path}` : ''
        })).sort((a, b) => {
            let sA = (expected !== 'unknown' && a.media_type === expected ? 100 : 0) + (year && a.year === year ? 50 : 0);
            let sB = (expected !== 'unknown' && b.media_type === expected ? 100 : 0) + (year && b.year === year ? 50 : 0);
            return sB - sA;
        });
    }

    function extractMovieInfo(rawName) {
        let ext = '';
        let nameWithoutExt = rawName;
        let extMatch = rawName.match(/(\.[a-z0-9]{2,6})$/i);
        if (extMatch && !/^\.\d+$/.test(extMatch[1])) {
            ext = extMatch[1];
            nameWithoutExt = rawName.slice(0, -ext.length);
        }

        let clean = nameWithoutExt.replace(/\s*[-_]?\s*文件夹\s*\d{4}-\d{2}-\d{2}.*$/i, '').replace(/\s+\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}.*$/i, '');
        let sMatch = clean.match(/(?:\bS(\d{1,2})\b|第([一二三四五六七八九十\d]+)季|Season\s*(\d+))/i);
        let type = sMatch || /E\d{1,3}|EP\d+|全\d+集/i.test(clean) ? 'tv' : (/电影|Movie/i.test(clean) ? 'movie' : 'unknown');
        let yMatch = clean.match(/[\(\[\{](19\d{2}|20\d{2})[\)\]\}]|\.(19\d{2}|20\d{2})\./);
        let year = yMatch ? (yMatch[1] || yMatch[2]) : '';

        // 【终极解析引擎】：把括号连根拔起，标点化为空格
        let work = clean.replace(/\{tmdbid-\d+\}/i, '');
        let noBracket = work.replace(/[【\[［].*?[\]】］]/g, ' ');
        if (noBracket.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '').trim().length > 0) {
            work = noBracket;
        }

        work = work.replace(/[\._]/g, ' ');

        // 【终极切片刀】：暴力斩断常见的压制组英文与中文标签
        let title = work.split(/\b(1080p|1080i|2160p|720p|4k|8k|UHD|BluRay|WEB-DL|WEBRip|HDTV|Remux|x264|x265|H264|H265|HEVC|AVC|HQ|DTS|TrueHD|Dolby|AAC|AC3|FLAC|APE|\d+fps|HDR|10bit)\b/i)[0];
        title = title.split(/(国配|粤配|台配|国语|粤语|中配|双配|双语|多音轨|中字|简繁|特效字幕|未删减|原盘|\d+帧|高码|杜比|完整版|收藏版|加长版|导演剪辑版|版本)/i)[0];

        title = title.replace(/\bS\d{1,2}\b.*|第.*?[季集].*|全.*?集.*/i, '');
        if (year) title = title.replace(new RegExp(`\\b${year}\\b`, 'g'), ' ');

        title = title.replace(/[《》\(\)\{\}]/g, '').replace(/[-+]+$/, '').trim();
        title = title.replace(/\s{2,}/g, ' ').trim();

        let seasonNum = null;
        if (sMatch) {
            if (sMatch[1]) seasonNum = parseInt(sMatch[1], 10);
            else if (sMatch[2]) seasonNum = cnToNum(sMatch[2]);
            else if (sMatch[3]) seasonNum = parseInt(sMatch[3], 10);
        }

        return { title, year, type, season: sMatch?.[0]||'', seasonNum, extension: ext };
    }

    // ================= 6. 主逻辑 =================
    async function startBatchRename(forceManual = false) {
        const key = $('#tmdb-api').value.trim();
        const host = $('#tmdb-host').value.trim() || 'api.themoviedb.org';
        const mode = $('.tmdb-segment-btn.active').getAttribute('data-val');
        const bMode = $('#tmdb-brackets').value;

        if (!key) return addLog("[ERR] Missing Auth Key.", "error");

        let targets = getSelectedItemNames();
        if (!targets.length) return addLog("[WARN] 没有选中项目 (文件/文件夹)。", "warn");

        const btnAuto = $('#tmdb-start-btn');
        const btnFix = $('#tmdb-fix-btn');
        btnAuto.disabled = true; btnFix.disabled = true;

        const activeBtn = forceManual ? btnFix : btnAuto;
        addLog(`>> SEQUENCE INITIATED | Targets: ${targets.length}`, "info");
        await unlockMultiSelectLimit();

        for (let i = 0; i < targets.length; i++) {
            activeBtn.innerText = `Executing (${i+1}/${targets.length})`;
            try {
                let info = extractMovieInfo(targets[i]);
                if (mode !== 'multi') info.type = mode;

                if (mode === 'movie') {
                    info.season = '';
                    info.seasonNum = null;
                }

                let sStr = info.season;
                if (info.seasonNum !== null) sStr = `S${String(info.seasonNum).padStart(2, '0')}`;

                addLog(`> 提取: <span style="color:var(--v-text-m)">${info.title} ${info.year ? '['+info.year+']' : ''}</span>`);

                let tmdb = null;
                if (forceManual) {
                    tmdb = await showInteractiveModal(info.title, mode, key, host);
                } else {
                    let results = await fetchTmdbData(info.title, info.year, info.type, mode, key, host);
                    tmdb = results.length ? results[0] : await showInteractiveModal(info.title, mode, key, host);
                }

                if (!tmdb) { addLog(`> Skipped.`); continue; }

                if (tmdb.media_type === 'tv') {
                    if (info.seasonNum === null) {
                        info.seasonNum = 1;
                    }
                    let tvData = await fetchAPI(`https://${host}/3/tv/${tmdb.id}/season/${info.seasonNum}?api_key=${key}&language=zh-CN`);
                    if (tvData?.air_date) tmdb.year = tvData.air_date.substring(0, 4);
                }

                sStr = '';
                if (info.seasonNum !== null && tmdb.media_type !== 'collection' && tmdb.media_type !== 'movie') {
                    sStr = `S${String(info.seasonNum).padStart(2, '0')}`;
                }

                let safeTitle = sanitize(tmdb.title);
                let yPart = tmdb.year && tmdb.year !== 'N/A' ? ` (${tmdb.year})` : '';

                let base = mode === 'collection' || tmdb.media_type === 'collection'
                    ? (bMode === 'none' ? safeTitle : `《${safeTitle}》`)
                    : (bMode === 'title_only' ? `《${safeTitle}》${yPart}` : (bMode === 'title_year' ? (yPart?`《${safeTitle}${yPart}》`:`《${safeTitle}》`) : `${safeTitle}${yPart}`));

                let newName = `${base} ${sStr ? sStr+' ' : ''}{tmdbid-${tmdb.id}}`.replace(/\s+/g, ' ').replace(' {tmdbid', '{tmdbid').trim();
                newName += info.extension;

                let finalName = sanitize(newName);

                if (targets[i] !== finalName) {
                    await executeRenameOnPage(targets[i], finalName);
                    await new Promise(r => setTimeout(r, 250));
                }

                let posterSrc = tmdb.poster || "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='32' height='48'><rect width='32' height='48' fill='%23222'/></svg>";
                let visualLog = `
                    <div class="log-item-visual">
                        <img class="log-poster" src="${posterSrc}" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'32\\' height=\\'48\\'><rect width=\\'32\\' height=\\'48\\' fill=\\'%23222\\'/></svg>'" />
                        <div class="log-details">
                            <span class="log-old">${targets[i]}</span>
                            <span class="log-new">➔ ${finalName}</span>
                        </div>
                    </div>
                `;
                addLog(visualLog, 'raw');

            } catch (err) {
                if (err === 'USER_STOP') { addLog(`[ABORT] Pipeline halted.`, "error"); break; }
                addLog(`[ERR] ${err.message || err}`, "error");
                await new Promise(r => setTimeout(r, 1000));
            }
        }
        addLog(`>> SEQUENCE COMPLETE.`, "info");
        btnAuto.disabled = false; btnFix.disabled = false;
        btnAuto.innerText = "开始刮削 (Auto)";
        btnFix.innerText = "手动修正 (Fix)";
    }

    // ================= 7. 弹窗 UI =================
    function showInteractiveModal(query, mode, key, host) {
        return new Promise((res, rej) => {
            document.body.insertAdjacentHTML('beforeend', `<div id="tmdb-modal-overlay"><div id="tmdb-modal"><div id="tmdb-modal-header">Manual Search Node</div><div id="tmdb-modal-body"><div class="tmdb-search-bar"><input type="text" id="tmdb-mi" value="${query}"><button id="tmdb-ms">Search</button></div><div id="tmdb-mr"></div></div><div class="tmdb-modal-footer"><button class="tmdb-btn-skip" id="tmdb-mk">Skip</button><button class="tmdb-btn-stop" id="tmdb-mt">Abort All</button></div></div></div>`);

            const close = (v, isErr) => { $('#tmdb-modal-overlay').remove(); isErr ? rej(v) : res(v); };
            $('#tmdb-mk').onclick = () => close(null);
            $('#tmdb-mt').onclick = () => close('USER_STOP', true);

            ['keydown', 'keyup', 'keypress'].forEach(evt => $('#tmdb-mi').addEventListener(evt, e => {
                e.stopPropagation();
                if (evt === 'keydown' && e.key === 'Enter') search();
            }));

            const search = async () => {
                let kw = $('#tmdb-mi').value.trim(); if(!kw) return;
                $('#tmdb-mr').innerHTML = '<div style="padding:30px;text-align:center;color:var(--v-text-m);font-weight:600;">Querying Database...</div>';
                try {
                    let r = await fetchTmdbData(kw, "", "unknown", mode, key, host);
                    if (!r.length) return $('#tmdb-mr').innerHTML = '<div style="padding:30px;text-align:center;color:var(--v-red);font-weight:600;">No results. Refine keywords.</div>';

                    const placeholder = `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='42' height='63'><rect width='42' height='63' fill='%23222'/></svg>`;
                    $('#tmdb-mr').innerHTML = r.map(i => `
                        <div class="tmdb-result-item" data-id="${i.id}">
                            <img class="tmdb-result-poster" src="${i.poster || placeholder}" onerror="this.src='${placeholder}'"/>
                            <div class="tmdb-result-info">
                                <span class="tmdb-result-title">${i.title}</span>
                                <div>
                                    ${i.year && i.year!=='N/A' ? `<span class="tmdb-result-year">${i.year}</span>` : ''}
                                    <span class="tmdb-result-type" style="background:${i.media_type==='tv'?'var(--v-blue)':i.media_type==='movie'?'#5e5ce6':'#ff9f0a'}">${i.media_type.toUpperCase().substring(0,3)}</span>
                                </div>
                            </div>
                        </div>
                    `).join('');

                    $$('.tmdb-result-item').forEach((el, idx) => el.onclick = () => close(r[idx]));
                } catch(e) { $('#tmdb-mr').innerHTML = `<div style="padding:30px;color:var(--v-red);text-align:center;">ERROR: ${e}</div>`; }
            };
            $('#tmdb-ms').onclick = search;
            search();
        });
    }

    window.addEventListener('load', () => setTimeout(createUI, 1000));
})();