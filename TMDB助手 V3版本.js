// ==UserScript==
// @name         TMDB助手 By宝宝 Q479874394
// @namespace    http://tampermonkey.net/
// @version      3
// @description  修复Bug & 增强刮削逻辑。
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

    GM_addStyle(`
        :root{--v-bg:rgba(20,20,22,0.45);--v-border:rgba(255,255,255,0.18);--v-border-hl:rgba(255,255,255,0.4);--v-text:#fff;--v-text-m:rgba(255,255,255,0.55);--v-blue:#0A84FF;--v-red:#FF453A;--v-rm:28px;--v-ri:14px;--v-font:"SF Pro Display",-apple-system,BlinkMacSystemFont,sans-serif;}

        #tmdb-ui-container{
            position:fixed; bottom:35px; right:35px; width:420px;
            background:var(--v-bg); color:var(--v-text);
            border:1px solid var(--v-border); border-radius:var(--v-rm);
            box-shadow:0 30px 60px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.2);
            backdrop-filter:blur(50px) saturate(200%); -webkit-backdrop-filter:blur(50px) saturate(200%);
            z-index:99998; font-family:var(--v-font); display:flex; flex-direction:column; overflow:hidden;
            transition: width 0.5s cubic-bezier(0.34, 1.2, 0.64, 1), border-radius 0.5s cubic-bezier(0.34, 1.2, 0.64, 1), background 0.5s ease;
        }

        #tmdb-ui-container.collapsed { width: 140px; cursor: pointer; border-radius: 30px; background: rgba(20,20,22,0.85); }

        #tmdb-ui-header {
            padding:20px 24px 20px; font-weight:700; font-size:18px;
            display:flex; justify-content:space-between; align-items:center;
            transition: padding 0.5s cubic-bezier(0.34, 1.2, 0.64, 1), font-size 0.5s ease;
            white-space: nowrap; position: relative; z-index: 10;
        }
        #tmdb-title-text { -webkit-user-select: none; user-select: none; pointer-events: none; }
        #tmdb-ui-container.collapsed #tmdb-ui-header { padding: 16px 20px; font-size: 15px; }

        .tmdb-header-actions { display: flex; align-items: center; gap: 6px; }
        .tmdb-icon-btn { cursor:pointer; opacity:0.6; transition:all 0.4s cubic-bezier(0.34, 1.2, 0.64, 1); font-size:20px; width:28px; height:28px; display:flex; align-items:center; justify-content:center; border-radius:50%; }
        .tmdb-icon-btn:hover { opacity:1; background:rgba(255,255,255,0.15); }
        .tmdb-collapse-btn { font-size:24px; line-height:0.8; }
        #tmdb-ui-container.collapsed .tmdb-collapse-btn { transform: rotate(180deg); }
        #tmdb-ui-container.collapsed #tmdb-settings-btn { display: none; }
        #tmdb-settings-btn.active { opacity: 1; color: #0A84FF; transform: rotate(90deg); background: rgba(255,255,255,0.1); }

        #tmdb-settings-panel {
            max-height: 0; overflow: hidden; opacity: 0; background: rgba(0,0,0,0.25); box-shadow: inset 0 2px 10px rgba(0,0,0,0.3); transition: all 0.4s cubic-bezier(0.34, 1.2, 0.64, 1);
        }
        #tmdb-ui-container.show-settings #tmdb-settings-panel { max-height: 220px; opacity: 1; padding: 16px 24px; border-bottom: 1px solid rgba(255,255,255,0.05); }
        #tmdb-ui-container.collapsed #tmdb-settings-panel { max-height: 0!important; opacity: 0!important; padding: 0 24px!important; }

        .tmdb-ui-body {
            padding: 0 24px 24px; max-height: 800px; opacity: 1; transform: translateY(0) scale(1);
            transition: max-height 0.6s cubic-bezier(0.34, 1.2, 0.64, 1), opacity 0.4s ease 0.1s, transform 0.5s cubic-bezier(0.34, 1.2, 0.64, 1), padding 0.5s cubic-bezier(0.34, 1.2, 0.64, 1);
        }
        #tmdb-ui-container.collapsed .tmdb-ui-body {
            max-height: 0; opacity: 0; transform: translateY(-10px) scale(0.98); padding-bottom: 0; pointer-events: none;
            transition: max-height 0.5s cubic-bezier(0.34, 1, 0.64, 1), opacity 0.2s ease, transform 0.4s ease, padding 0.5s cubic-bezier(0.34, 1, 0.64, 1);
        }

        .tmdb-input-row{display:flex;gap:14px;margin-bottom:18px;} .tmdb-input-group{flex:1; display:flex; flex-direction:column;}
        .tmdb-input-group label{display:block;font-size:12px;font-weight:600;margin-bottom:8px;color:var(--v-text-m);}

        .tmdb-input-group input {width:100%;padding:12px 16px;border-radius:var(--v-ri);border:1px solid rgba(255,255,255,0.08);background:rgba(0,0,0,0.3);color:#fff;outline:none;transition:all 0.3s;font-size:14px;font-family:var(--v-font);appearance:none;box-shadow:inset 0 2px 4px rgba(0,0,0,0.2);}
        .tmdb-input-group input:focus {border-color:var(--v-border-hl);background:rgba(255,255,255,0.05);box-shadow:0 0 0 4px rgba(255,255,255,0.1),inset 0 2px 4px rgba(0,0,0,0.2);}

        .tmdb-input-group input[type="password"]{letter-spacing:4px;font-family:monospace;font-size:16px;}

        .tmdb-input-wrapper { position: relative; width: 100%; display: flex; align-items: center; }
        .tmdb-input-wrapper input { padding-right: 66px !important; }

        .tmdb-sniff-btn { position: absolute; right: 14px; color: var(--v-text-m); font-size: 16px; cursor: pointer; user-select: none; transition: right 0.4s cubic-bezier(0.34, 1.2, 0.64, 1), transform 0.2s, color 0.2s; }
        .tmdb-sniff-btn.shifted { right: 38px; }
        .tmdb-sniff-btn:hover { color: #30d158; transform: scale(1.15) rotate(10deg); }

        .tmdb-clear-btn { position: absolute; right: 12px; color: var(--v-text-m); font-size: 20px; cursor: pointer; user-select: none; font-weight: bold; line-height: 1; opacity: 0; pointer-events: none; transform: scale(0.5) rotate(-90deg); transition: all 0.4s cubic-bezier(0.34, 1.2, 0.64, 1); }
        .tmdb-clear-btn.show { opacity: 1; pointer-events: auto; transform: scale(1) rotate(0deg); }
        .tmdb-clear-btn:hover { color: #FF453A; transform: scale(1.2); }

        .tmdb-turbo-btn {
            display:flex; flex-direction:row; justify-content:center; align-items:center; gap:8px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: var(--v-ri); cursor: pointer; transition: all 0.3s cubic-bezier(0.34, 1.2, 0.64, 1); outline: none; position: relative; overflow: hidden;
        }
        .tmdb-turbo-btn.active { background: linear-gradient(135deg, rgba(48,209,88,0.15), rgba(10,132,255,0.15)); border: 1px solid rgba(48,209,88,0.6); box-shadow: inset 0 0 15px rgba(48,209,88,0.2), 0 0 15px rgba(48,209,88,0.4); transform: scale(1.02); }
        .tmdb-turbo-btn .turbo-text { color: var(--v-text-m); font-weight: 700; font-size: 13px; transition: all 0.3s; }
        .tmdb-turbo-btn.active .turbo-text { color: #30d158; text-shadow: 0 0 8px rgba(48,209,88,0.8); letter-spacing: 0.5px; }
        .tmdb-turbo-btn:active { transform: scale(0.95); }

        .tmdb-segment-control { display: flex; position: relative; z-index: 1; background: rgba(0,0,0,0.25); border-radius: 10px; padding: 3px; border: 1px solid rgba(255,255,255,0.06); gap: 4px; flex: 1; --idx: 0; }
        .tmdb-segment-indicator { position: absolute; top: 3px; bottom: 3px; left: 3px; background: rgba(255,255,255,0.15); border-radius: 8px; box-shadow: 0 2px 6px rgba(0,0,0,0.2); transform: translateX(calc(var(--idx) * 100% + var(--idx) * 4px)); transition: transform 0.4s cubic-bezier(0.34, 1.2, 0.64, 1); z-index: -1; pointer-events: none; }
        #tmdb-mode-group .tmdb-segment-indicator, #tmdb-tooltip-delay-group .tmdb-segment-indicator { width: calc((100% - 18px) / 4); }
        #tmdb-typography-group .tmdb-segment-indicator, #tmdb-tooltip-toggle-group .tmdb-segment-indicator { width: calc((100% - 10px) / 2); }
        .tmdb-segment-btn { flex: 1; background: transparent !important; border: none; color: var(--v-text-m); padding: 7px 0; font-size: 12px; font-weight: 600; cursor: pointer; border-radius: 8px; transition: color 0.3s ease; box-shadow: none !important; transform: none !important; white-space: nowrap; overflow: hidden; }
        .tmdb-segment-btn.active { color: #fff; }
        .tmdb-segment-btn:hover:not(.active) { color: #ddd; background: rgba(255,255,255,0.05) !important; }

        .tmdb-btn-group{display:flex;gap:12px;}
        .tmdb-btn{width:100%;border:1px solid rgba(255,255,255,0.1);padding:14px;border-radius:16px;cursor:pointer;font-weight:700;font-size:14px;font-family:var(--v-font);transition:all 0.3s cubic-bezier(0.34, 1.2, 0.64, 1);backdrop-filter:blur(20px);}
        .tmdb-btn:disabled{opacity:0.3;cursor:not-allowed;transform:none!important;box-shadow:none!important;background:rgba(255,255,255,0.05)!important;color:var(--v-text-m)!important;}

        #tmdb-start-btn { background: linear-gradient(135deg, rgba(10,132,255,0.15), rgba(0,201,255,0.15)); border: 1px solid rgba(10,132,255,0.6); box-shadow: inset 0 0 15px rgba(10,132,255,0.2), 0 0 15px rgba(10,132,255,0.4); color: #fff; text-shadow: 0 0 8px rgba(10,132,255,0.8); letter-spacing: 0.5px; }
        #tmdb-fix-btn { background: linear-gradient(135deg, rgba(255,159,10,0.15), rgba(255,69,58,0.15)); border: 1px solid rgba(255,159,10,0.6); box-shadow: inset 0 0 15px rgba(255,159,10,0.2), 0 0 15px rgba(255,159,10,0.4); color: #fff; text-shadow: 0 0 8px rgba(255,159,10,0.8); letter-spacing: 0.5px; }
        #tmdb-parent-btn { background: linear-gradient(135deg, rgba(48,209,88,0.15), rgba(10,132,255,0.15)); border: 1px solid rgba(48,209,88,0.6); box-shadow: inset 0 0 15px rgba(48,209,88,0.2), 0 0 15px rgba(48,209,88,0.4); color: #fff; text-shadow: 0 0 8px rgba(48,209,88,0.8); letter-spacing: 0.5px; }

        #tmdb-start-btn:active:not(:disabled), #tmdb-fix-btn:active:not(:disabled), #tmdb-parent-btn:active:not(:disabled) {
            background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); box-shadow: none; text-shadow: none; color: var(--v-text-m); transform: scale(0.95);
        }

        #tmdb-parent-section {
            background: rgba(0,0,0,0.15); padding: 16px; border-radius: 20px;
            border: 1px solid rgba(255,255,255,0.05); margin-bottom: 20px;
            transition: all 0.4s cubic-bezier(0.34, 1.2, 0.64, 1); overflow: hidden;
        }
        .tmdb-parent-header {
            display: flex; justify-content: space-between; align-items: center;
            cursor: pointer; user-select: none; margin-bottom: 12px; transition: margin 0.4s;
        }
        .tmdb-parent-header label { color: #30d158; margin: 0 !important; cursor: pointer; }
        .tmdb-parent-toggle-icon { color: var(--v-text-m); font-size: 12px; transition: transform 0.4s cubic-bezier(0.34, 1.2, 0.64, 1); }

        .tmdb-parent-body { max-height: 200px; opacity: 1; transform: translateY(0); transition: all 0.4s cubic-bezier(0.34, 1.2, 0.64, 1); }

        #tmdb-parent-section.collapsed { padding: 12px 16px; background: rgba(0,0,0,0.25); }
        #tmdb-parent-section.collapsed .tmdb-parent-header { margin-bottom: 0; }
        #tmdb-parent-section.collapsed .tmdb-parent-toggle-icon { transform: rotate(-90deg); }
        #tmdb-parent-section.collapsed .tmdb-parent-body { max-height: 0; opacity: 0; transform: translateY(-10px) scale(0.98); pointer-events: none; }

        #tmdb-log{height:200px;overflow-y:auto;background:rgba(0,0,0,0.15);padding:16px;border-radius:var(--v-ri);font-size:13px;color:#d1d1d6;line-height:1.6;box-shadow:inset 0 2px 10px rgba(0,0,0,0.2);}
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

        #tmdb-mr{flex:1; max-height:400px; overflow-y:auto; background:rgba(0,0,0,0.2); border-radius:16px; border:1px solid rgba(255,255,255,0.05); }

        #tmdb-log, #tmdb-mr { scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.15) transparent; }
        #tmdb-log::-webkit-scrollbar, #tmdb-mr::-webkit-scrollbar { width: 6px; height: 6px; }
        #tmdb-log::-webkit-scrollbar-track, #tmdb-mr::-webkit-scrollbar-track { background: transparent; border-radius: 8px; }
        #tmdb-log::-webkit-scrollbar-thumb, #tmdb-mr::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 8px; }
        #tmdb-log::-webkit-scrollbar-thumb:hover, #tmdb-mr::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.4); }

        .tmdb-result-item{padding:12px 16px;border-bottom:1px solid rgba(255,255,255,0.03);cursor:pointer;display:flex;align-items:center;gap:14px;}
        .tmdb-result-item:hover{background:rgba(255,255,255,0.1);}
        .tmdb-result-poster{width:60px;height:90px;border-radius:8px;object-fit:cover;background:rgba(255,255,255,0.05);flex-shrink:0;}
        .tmdb-result-info{flex:1;display:flex;justify-content:space-between;align-items:center;}
        .tmdb-result-title{font-size:15px;color:#fff;font-weight:600;} .tmdb-result-year{font-size:13px;color:var(--v-text-m);margin-right:12px;}
        .tmdb-result-type{font-size:11px;font-weight:700;padding:4px 8px;border-radius:8px;background:rgba(255,255,255,0.15);color:#fff;}

        .tmdb-modal-footer{padding:20px 24px;background:rgba(0,0,0,0.1);display:flex;gap:16px; margin-top: auto;} .tmdb-modal-footer button{flex:1;padding:14px;border-radius:14px;cursor:pointer;font-weight:600;}
        .tmdb-btn-skip{background:rgba(255,255,255,0.1);color:#fff;border:1px solid rgba(255,255,255,0.05);} .tmdb-btn-stop{background:rgba(255,69,58,0.2);color:var(--v-red);border:1px solid rgba(255,69,58,0.3);}

        #tmdb-custom-tooltip {
            position: fixed; background: rgba(20, 20, 22, 0.85); color: rgba(255, 255, 255, 0.95);
            padding: 8px 14px; border-radius: 10px; font-size: 13px; font-weight: 500;
            max-width: 260px; word-break: break-word; white-space: pre-wrap; line-height: 1.5;
            box-shadow: 0 10px 30px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1);
            border: 1px solid rgba(255,255,255,0.1);
            backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
            pointer-events: none; z-index: 999999;
            opacity: 0; transform: translateY(8px) scale(0.95);
            transition: opacity 0.2s ease, transform 0.2s cubic-bezier(0.34, 1.2, 0.64, 1);
            letter-spacing: 0.5px;
        }
        #tmdb-custom-tooltip.show { opacity: 1; transform: translateY(0) scale(1); }
    `);

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

    function autoSniffParentName() {
        let candidateTexts = [];
        let uiContainer = document.querySelector('#tmdb-ui-container');

        const getDirectText = (el) => {
            let t = el.getAttribute('title') || "";
            if (!t) t = el.innerText || el.textContent || "";
            return t.trim();
        };

        let breadcrumbs = document.querySelectorAll('[class*="breadcrumb"] span, [class*="breadcrumb"] a, [class*="nav-path"] span, [class*="mbx"] a, [class*="mbx"] span, [class*="path"] span, .ant-breadcrumb-link, .el-breadcrumb__inner');
        Array.from(breadcrumbs).forEach(el => {
            if (uiContainer && uiContainer.contains(el)) return;
            let t = getDirectText(el);
            if (t) candidateTexts.push(t);
        });

        let allNodes = document.querySelectorAll('span, a, div, h1, h2, h3, li, p');
        Array.from(allNodes).forEach(el => {
            if (uiContainer && uiContainer.contains(el)) return;
            if (el.children.length === 0 || el.tagName === 'A' || el.tagName === 'SPAN') {
                let t = getDirectText(el);
                if (t.includes('{tmdbid-')) candidateTexts.push(t);
            }
        });

        if (document.title) candidateTexts.push(document.title);

        const isGarbage = (str) => {
            if (!str) return true;
            if (str.length > 80) return true;
            if (/^(文件|全部文件|全部|首页|资源|我的资源|测试|新建文件夹|TMDB助手|Target Class|Typography|System Online|返回上一级)$/i.test(str)) return true;
            if (/(云盘|网盘|广雅盘|光腾云盘|云添加|来自：|雷达嗅探|大小|修改时间|文件名称|类型|已选择|文件夹大小|序列号|TMDB API|⚠️|➔)/i.test(str)) return true;
            return false;
        };

        for (let i = candidateTexts.length - 1; i >= 0; i--) {
            let text = candidateTexts[i];
            if (!text) continue;

            if (text.includes('>')) text = text.split('>').pop();
            if (text.includes('/')) {
                 if (/(文件|云盘|资源)/.test(text)) text = text.split('/').pop();
            }
            text = text.trim();

            if (isGarbage(text)) continue;

            let cleanInfo = extractMovieInfo(text);
            let finalTitle = cleanInfo.title.replace(/[（\(]\s*[）\)]/g, '').trim();

            if (finalTitle && finalTitle.length >= 1 && !/^(S\d{1,2}|第[一二三四五六七八九十\d]+[季集]|Season\s*\d+)$/i.test(finalTitle)) {
                return finalTitle;
            }
        }
        return null;
    }

    function createUI() {
        if ($('#tmdb-ui-container')) return;
        const getVal = (k, def) => GM_getValue(k, def);
        const sel = (k, val) => getVal(k, 'multi') === val ? 'active' : '';
        const bSel = (k, val) => {
            let v = getVal(k, 'title_year');
            if (v === 'title_only') v = 'title_year';
            return v === val;
        };
        const isCollapsed = getVal('tmdb_ui_collapsed', false);
        const isTurbo = getVal('tmdb_turbo_mode', false);

        const savedMode = getVal('tmdb_search_mode', 'multi');
        const modeIdxMap = { 'multi': 0, 'movie': 1, 'tv': 2, 'collection': 3 };
        const initModeIdx = modeIdxMap[savedMode] !== undefined ? modeIdxMap[savedMode] : 0;

        let savedBMode = getVal('tmdb_brackets_mode', 'title_year');
        if (savedBMode === 'title_only') savedBMode = 'title_year';
        const bModeIdxMap = { 'title_year': 0, 'none': 1 };
        const initBModeIdx = bModeIdxMap[savedBMode] !== undefined ? bModeIdxMap[savedBMode] : 0;

        const isTooltipEnabled = String(getVal('tmdb_tooltip_enabled', 'true')) === 'true';
        const initTooltipIdx = isTooltipEnabled ? 0 : 1;

        const tooltipDelay = parseInt(getVal('tmdb_tooltip_delay', 1000), 10);
        const delayIdxMap = { 0: 0, 500: 1, 1000: 2, 2000: 3 };
        const initDelayIdx = delayIdxMap[tooltipDelay] !== undefined ? delayIdxMap[tooltipDelay] : 2;

        let pOverrideVal = getVal('tmdb_parent_override', '');
        let isParentCollapsed = getVal('tmdb_parent_ui_collapsed', true);
        if (pOverrideVal !== '') isParentCollapsed = false;

        document.body.insertAdjacentHTML('beforeend', `
            <div id="tmdb-ui-container" class="${isCollapsed ? 'collapsed' : ''}">
                <div id="tmdb-ui-header">
                    <span id="tmdb-title-text">${isCollapsed ? 'TMDB助手' : 'TMDB助手 By宝宝 Q479874394'}</span>
                    <div class="tmdb-header-actions">
                        <span id="tmdb-settings-btn" class="tmdb-icon-btn" title="设置">⚙</span>
                        <span class="tmdb-collapse-btn" title="收起/展开面板">${isCollapsed ? '+' : '−'}</span>
                    </div>
                </div>

                <div id="tmdb-settings-panel">
                    <div class="tmdb-input-group" style="margin-bottom:12px;">
                        <label>TMDB API 密钥 (API Key)</label>
                        <input type="password" id="tmdb-api" placeholder="••••••••••••" value="${getVal('tmdb_api_key', '')}">
                    </div>
                    <div class="tmdb-input-row" style="margin-bottom:0;">
                        <div class="tmdb-input-group">
                            <label>悬浮提示 (Tooltip)</label>
                            <div class="tmdb-segment-control" id="tmdb-tooltip-toggle-group" style="--idx: ${initTooltipIdx};">
                                <div class="tmdb-segment-indicator"></div>
                                <button class="tmdb-segment-btn ${isTooltipEnabled ? 'active' : ''}" data-val="1" data-idx="0">开启</button>
                                <button class="tmdb-segment-btn ${!isTooltipEnabled ? 'active' : ''}" data-val="0" data-idx="1">关闭</button>
                            </div>
                        </div>
                        <div class="tmdb-input-group">
                            <label>显示延迟 (Delay)</label>
                            <div class="tmdb-segment-control" id="tmdb-tooltip-delay-group" style="--idx: ${initDelayIdx};">
                                <div class="tmdb-segment-indicator"></div>
                                <button class="tmdb-segment-btn ${tooltipDelay === 0 ? 'active' : ''}" data-val="0" data-idx="0">0s</button>
                                <button class="tmdb-segment-btn ${tooltipDelay === 500 ? 'active' : ''}" data-val="500" data-idx="1">0.5s</button>
                                <button class="tmdb-segment-btn ${tooltipDelay === 1000 ? 'active' : ''}" data-val="1000" data-idx="2">1s</button>
                                <button class="tmdb-segment-btn ${tooltipDelay === 2000 ? 'active' : ''}" data-val="2000" data-idx="3">2s</button>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="tmdb-ui-body">
                    <div class="tmdb-input-row" style="margin-top: 10px;">
                        <button id="tmdb-turbo-btn" class="tmdb-turbo-btn ${isTurbo ? 'active' : ''}" style="width:100%; padding: 12px; border-radius: 14px;" title="点击切换：开启物理极限速度">
                            <span class="turbo-text">⚡ 极速模式 </span>
                        </button>
                    </div>

                    <div class="tmdb-input-row" style="margin-bottom: 24px;">
                        <div class="tmdb-input-group"><label>Target Class / 目标模式</label>
                            <div class="tmdb-segment-control" id="tmdb-mode-group" style="--idx: ${initModeIdx};">
                                <div class="tmdb-segment-indicator"></div>
                                <button class="tmdb-segment-btn ${sel('tmdb_search_mode','multi')}" data-val="multi" data-idx="0">智能</button>
                                <button class="tmdb-segment-btn ${sel('tmdb_search_mode','movie')}" data-val="movie" data-idx="1">电影</button>
                                <button class="tmdb-segment-btn ${sel('tmdb_search_mode','tv')}" data-val="tv" data-idx="2">剧集</button>
                                <button class="tmdb-segment-btn ${sel('tmdb_search_mode','collection')}" data-val="collection" data-idx="3">合集</button>
                            </div>
                        </div>
                        <div class="tmdb-input-group"><label>Typography / 命名排版</label>
                            <div class="tmdb-segment-control" id="tmdb-typography-group" style="--idx: ${initBModeIdx};">
                                <div class="tmdb-segment-indicator"></div>
                                <button class="tmdb-segment-btn ${bSel('tmdb_brackets_mode','title_year') ? 'active' : ''}" data-val="title_year" data-idx="0">《名(年)》</button>
                                <button class="tmdb-segment-btn ${bSel('tmdb_brackets_mode','none') ? 'active' : ''}" data-val="none" data-idx="1">纯文字</button>
                            </div>
                        </div>
                    </div>

                    <div class="tmdb-btn-group" style="margin-bottom: 24px;">
                        <button id="tmdb-start-btn" class="tmdb-btn" title="按照上方配置，对所有选中的文件进行自动搜刮并重命名">开始刮削 (Auto)</button>
                        <button id="tmdb-fix-btn" class="tmdb-btn" title="选中识别有误的项目，强制调出搜索框进行手动搜索">手动修正 (Fix)</button>
                    </div>

                    <div id="tmdb-parent-section" class="${isParentCollapsed ? 'collapsed' : ''}">
                        <div class="tmdb-parent-header" id="tmdb-parent-header-toggle" title="点击展开/收起父级关联选项">
                            <label>Parent Series Override / 季数强制关联</label>
                            <span class="tmdb-parent-toggle-icon">▼</span>
                        </div>
                        <div class="tmdb-parent-body">
                            <div class="tmdb-input-row" style="margin-bottom: 12px;">
                                <div class="tmdb-input-group">
                                    <div class="tmdb-input-wrapper">
                                        <input type="text" id="tmdb-parent-override" placeholder="留空将自动抓取当前网页文件夹名" value="${pOverrideVal}">
                                        <span id="tmdb-sniff-btn" class="tmdb-sniff-btn" title="点击自动读取当前页面文件夹名">🎯</span>
                                        <span id="tmdb-clear-override" class="tmdb-clear-btn" title="一键清空">×</span>
                                    </div>
                                </div>
                            </div>
                            <div class="tmdb-btn-group" style="margin-bottom: 0;">
                                <button id="tmdb-parent-btn" class="tmdb-btn" title="无视单独的文件名，强制所有勾选项使用上方框内的剧名进行统一刮削">⬇ 强制按父级关联刮削</button>
                            </div>
                        </div>
                    </div>

                    <div id="tmdb-log"><p class="log-info">System Online. 【排版升级+缓存克隆】极限引擎就绪。</p></div>
                </div>
            </div>
        `);

        const tooltip = document.createElement('div');
        tooltip.id = 'tmdb-custom-tooltip';
        document.body.appendChild(tooltip);

        let tooltipTimeout;
        let globalMouseX = 0;
        let globalMouseY = 0;

        document.addEventListener('mousemove', e => {
            globalMouseX = e.clientX;
            globalMouseY = e.clientY;

            if (tooltip.classList.contains('show')) {
                let x = globalMouseX + 14;
                let y = globalMouseY + 14;
                if (x + tooltip.offsetWidth + 10 > window.innerWidth) x = globalMouseX - tooltip.offsetWidth - 14;
                if (y + tooltip.offsetHeight + 10 > window.innerHeight) y = globalMouseY - tooltip.offsetHeight - 14;
                tooltip.style.left = x + 'px';
                tooltip.style.top = y + 'px';
            }
        });

        const attachTooltip = (el) => {
            if(el.hasAttribute('title') && el.getAttribute('title')) {
                el.setAttribute('data-tmdb-title', el.getAttribute('title'));
                el.removeAttribute('title');

                el.addEventListener('mouseenter', () => {
                    const isEnabled = String(GM_getValue('tmdb_tooltip_enabled', 'true')) === 'true';
                    if (!isEnabled) return;

                    const delay = parseInt(GM_getValue('tmdb_tooltip_delay', 1000), 10);

                    clearTimeout(tooltipTimeout);
                    tooltipTimeout = setTimeout(() => {
                        tooltip.textContent = el.getAttribute('data-tmdb-title');
                        tooltip.classList.add('show');

                        requestAnimationFrame(() => {
                            let x = globalMouseX + 14;
                            let y = globalMouseY + 14;
                            if (x + tooltip.offsetWidth + 10 > window.innerWidth) x = globalMouseX - tooltip.offsetWidth - 14;
                            if (y + tooltip.offsetHeight + 10 > window.innerHeight) y = globalMouseY - tooltip.offsetHeight - 14;
                            tooltip.style.left = x + 'px';
                            tooltip.style.top = y + 'px';
                        });
                    }, delay);
                });

                el.addEventListener('mouseleave', () => {
                    clearTimeout(tooltipTimeout);
                    tooltip.classList.remove('show');
                });

                el.addEventListener('click', () => {
                    clearTimeout(tooltipTimeout);
                    tooltip.classList.remove('show');
                });
            }
        };

        $$('#tmdb-ui-container [title]').forEach(attachTooltip);

        const toggleClearBtn = () => {
            const input = $('#tmdb-parent-override');
            const clearBtn = $('#tmdb-clear-override');
            const sniffBtn = $('#tmdb-sniff-btn');
            if (input && clearBtn && sniffBtn) {
                if (input.value.trim() !== '') {
                    clearBtn.classList.add('show');
                    sniffBtn.classList.add('shifted');
                } else {
                    clearBtn.classList.remove('show');
                    sniffBtn.classList.remove('shifted');
                }
            }
        };

        const titleEl = $('#tmdb-title-text');
        if (titleEl) {
            const antiTamper = new MutationObserver(() => {
                const containerEl = $('#tmdb-ui-container');
                const targetTitle = (containerEl && containerEl.classList.contains('collapsed')) ? "TMDB助手" : "TMDB助手 By宝宝 Q479874394";
                if (titleEl.textContent !== targetTitle) {
                    antiTamper.disconnect();
                    titleEl.textContent = targetTitle;
                    antiTamper.observe(titleEl, { childList: true, characterData: true, subtree: true });
                }
            });
            antiTamper.observe(titleEl, { childList: true, characterData: true, subtree: true });
        }

        $('#tmdb-settings-btn').onclick = (e) => {
            e.stopPropagation();
            const container = $('#tmdb-ui-container');
            const btn = e.currentTarget;
            if (container.classList.contains('collapsed')) $('#tmdb-ui-header').click();
            container.classList.toggle('show-settings');
            btn.classList.toggle('active');
        };

        $('#tmdb-ui-header').onclick = (e) => {
            const container = $('#tmdb-ui-container');
            container.classList.toggle('collapsed');
            const collapsedNow = container.classList.contains('collapsed');
            GM_setValue('tmdb_ui_collapsed', collapsedNow);
            $('.tmdb-collapse-btn').textContent = collapsedNow ? '+' : '−';

            const targetTitle = collapsedNow ? 'TMDB助手' : 'TMDB助手 By宝宝 Q479874394';
            if ($('#tmdb-title-text').textContent !== targetTitle) {
                $('#tmdb-title-text').textContent = targetTitle;
            }
        };

        $('#tmdb-parent-header-toggle').onclick = () => {
            const sec = $('#tmdb-parent-section');
            sec.classList.toggle('collapsed');
            GM_setValue('tmdb_parent_ui_collapsed', sec.classList.contains('collapsed'));
        };

        $('#tmdb-turbo-btn').onclick = (e) => {
            const btn = e.currentTarget;
            btn.classList.toggle('active');
            const turboNow = btn.classList.contains('active');
            GM_setValue('tmdb_turbo_mode', turboNow);
            addLog(turboNow ? "> ⚡ 极速引擎已点火！所有 DOM 等待时间强制切断至 1ms，高频核验开启！" : "> 🐌 已切回安全稳定模式。");
        };

        $('#tmdb-api').oninput = e => GM_setValue('tmdb_api_key', e.target.value.trim());

        $('#tmdb-parent-override').oninput = e => {
            GM_setValue('tmdb_parent_override', e.target.value.trim());
            toggleClearBtn();
        };

        $('#tmdb-sniff-btn').onclick = () => {
            const name = autoSniffParentName();
            if (name) {
                $('#tmdb-parent-override').value = name;
                GM_setValue('tmdb_parent_override', name);
                toggleClearBtn();
                addLog(`> 🎯 雷达嗅探成功，提取纯净片名: <span style="color:#30d158">${name}</span>`, 'info');
            } else {
                addLog(`> ⚠️ 雷达嗅探失败，未检测到有效文件夹名，请手动填写。`, 'warn');
            }
        };

        $('#tmdb-clear-override').onclick = () => {
            $('#tmdb-parent-override').value = '';
            GM_setValue('tmdb_parent_override', '');
            toggleClearBtn();
        };

        $$('.tmdb-segment-btn').forEach(btn => {
            btn.onclick = (e) => {
                const targetBtn = e.target;
                const parentGroup = targetBtn.closest('.tmdb-segment-control');
                parentGroup.querySelectorAll('.tmdb-segment-btn').forEach(b => b.classList.remove('active'));
                targetBtn.classList.add('active');
                parentGroup.style.setProperty('--idx', targetBtn.getAttribute('data-idx'));

                if (parentGroup.id === 'tmdb-mode-group') {
                    GM_setValue('tmdb_search_mode', targetBtn.getAttribute('data-val'));
                } else if (parentGroup.id === 'tmdb-typography-group') {
                    GM_setValue('tmdb_brackets_mode', targetBtn.getAttribute('data-val'));
                } else if (parentGroup.id === 'tmdb-tooltip-toggle-group') {
                    GM_setValue('tmdb_tooltip_enabled', targetBtn.getAttribute('data-val') === '1');
                } else if (parentGroup.id === 'tmdb-tooltip-delay-group') {
                    GM_setValue('tmdb_tooltip_delay', parseInt(targetBtn.getAttribute('data-val'), 10));
                }
            };
        });

        $$('#tmdb-ui-container input').forEach(el => { ['keydown', 'keyup', 'keypress'].forEach(evt => el.addEventListener(evt, e => e.stopPropagation())); });

        $('#tmdb-start-btn').onclick = () => startBatchRename(false, false);
        $('#tmdb-fix-btn').onclick = () => startBatchRename(true, false);
        $('#tmdb-parent-btn').onclick = () => startBatchRename(false, true);

        toggleClearBtn();
    }

    async function unlockMultiSelectLimit(isTurbo) {
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
            await new Promise(r => setTimeout(r, isTurbo ? 50 : 600));
        }
    }

    function getSelectedItemNames() {
        return Array.from($$('input[type="checkbox"]'))
            .filter(cb => cb.checked || cb.parentElement?.className.match(/checked/i))
            .map(cb => {
                if (cb.closest('thead') || cb.closest('th')) return null;

                let row = cb.closest('tr, [class*="row"], [class*="item"]');
                if (!row) return null;

                let nameRaw = "";
                let titleNode = row.querySelector('[title]');
                if (titleNode && /\.[a-z0-9]{2,6}$/i.test(titleNode.getAttribute('title'))) {
                    nameRaw = titleNode.getAttribute('title');
                } else {
                    let fullText = (row.textContent || '').replace(/[\n\t\r]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
                    if (/(^\d+\s*个文件)|(大小.*类型.*修改时间)/.test(fullText)) return null;
                    fullText = fullText.replace(/已选择|全选|文件名/g, '').trim();

                    if (/(\.(?!\d+[KMG]B)[a-zA-Z0-9]{2,6})(?:\s*\d+(?:\.\d+)?[KMG]B|视频|音频|文档|图片|\d{4}-\d{2}-\d{2})/i.test(fullText)) {
                        nameRaw = fullText.replace(/(\.(?!\d+[KMG]B)[a-zA-Z0-9]{2,6})(?:\s*\d+(?:\.\d+)?[KMG]B|视频|音频|文档|图片|\d{4}-\d{2}-\d{2}).*/i, '$1');
                    } else {
                        nameRaw = fullText.replace(/(.*?)(?:\s*\d+(?:\.\d+)?[KMG]B|\s*视频|\s*音频|\s*文档|\s*图片|\s*\d{4}-\d{2}-\d{2}).*/i, '$1');
                    }
                }

                if (nameRaw && nameRaw.replace(/\s+/g, '').includes('个文件/文件夹大小')) return null;
                return nameRaw ? nameRaw.trim() : null;
            }).filter((n, i, arr) => n && arr.indexOf(n) === i);
    }

    async function executeRenameOnPage(oldName, newName, isTurbo) {
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
                await new Promise(r => setTimeout(r, isTurbo ? 1 : 200));
            }
        } else {
            liveRow.click();
            await new Promise(r => setTimeout(r, isTurbo ? 1 : 200));
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
            await new Promise(r => setTimeout(r, isTurbo ? 1 : 200));
            renameBtn = findRenameBtn();
        }

        if (!renameBtn) throw "触发重命名按钮失败";
        renameBtn.click();

        let input = await observeDOM('input[type="text"]:not(#tmdb-api):not(#tmdb-mi):not(#tmdb-parent-override)', 3000);
        if (!input) throw "输入框未就绪";

        (Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value')?.set || Object.getOwnPropertyDescriptor(input, 'value').set).call(input, newName);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        await new Promise(r => setTimeout(r, isTurbo ? 1 : 100));

        let confirmBtn = input.parentElement.querySelector('.submit, .confirm, [class*="icon-check"], [class*="primary"]');
        if (confirmBtn && confirmBtn.type !== 'checkbox') confirmBtn.click();
        else input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));

        let inputGone = await observeDOM('input[type="text"]:not(#tmdb-api):not(#tmdb-mi):not(#tmdb-parent-override)', 4000, true);
        if (!inputGone) throw "网络超时或拒绝改名";

        let strippedNew = newName.replace(/\s+/g, '');
        let verifySuccess = false;
        let pollInterval = isTurbo ? 20 : 200;
        let maxLoops = isTurbo ? 150 : 15;

        for (let t = 0; t < maxLoops; t++) {
            await new Promise(r => setTimeout(r, pollInterval));
            let nodes = Array.from(document.querySelectorAll('[title], [class*="name"], [class*="title"], a'));
            let found = nodes.some(n => {
                let txt = n.getAttribute('title') || n.innerText || n.textContent || '';
                return txt.replace(/\s+/g, '').includes(strippedNew);
            });

            if (found) { verifySuccess = true; break; }
        }

        if (!verifySuccess) throw "页面未刷新，改名可能被服务器拒绝或过滤";

        if (cb) {
            let stillChecked = cb.checked || (cb.parentElement && /checked/i.test(cb.parentElement.className));
            if (stillChecked) {
                let targetBtn = (cb.parentElement && !/TD|TR/i.test(cb.parentElement.tagName)) ? cb.parentElement : cb;
                targetBtn.click();
            }
        }
    }

    const fetchAPI = (url) => new Promise((res, rej) => GM_xmlhttpRequest({ method: "GET", url, onload: r => res(r.status===200 ? JSON.parse(r.responseText) : null), onerror: () => rej("Net Error") }));

    function convertToSimplified(text) {
        if (!text) return Promise.resolve(text);
        return new Promise(resolve => {
            GM_xmlhttpRequest({
                method: "POST", url: "https://api.zhconvert.org/convert", headers: { "Content-Type": "application/json" },
                data: JSON.stringify({ text: text, converter: "Simplified" }),
                onload: r => { try { let res = JSON.parse(r.responseText); resolve((res.code === 0 && res.data && res.data.text) ? res.data.text : text); } catch(e) { resolve(text); } },
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
            if (!altData?.results?.length || !/[\u4e00-\u9fa5]/.test(altData.results[0].title || altData.results[0].name || '')) { altData = await doSearch('zh-HK'); }
            if (altData?.results?.length && /[\u4e00-\u9fa5]/.test(altData.results[0].title || altData.results[0].name || '')) {
                results = altData.results;
                for (let i = 0; i < Math.min(results.length, 8); i++) {
                    if (results[i].title) results[i].title = await convertToSimplified(results[i].title);
                    if (results[i].name) results[i].name = await convertToSimplified(results[i].name);
                }
            }
        }

        return results.map(r => ({
            id: r.id, title: r.title || r.name || 'Unknown', year: (r.release_date || r.first_air_date || '').substring(0, 4) || 'N/A', media_type: r.media_type || (mode !== 'multi' ? mode : 'unknown'), poster: r.poster_path ? `https://image.tmdb.org/t/p/w92${r.poster_path}` : ''
        })).sort((a, b) => {
            let sA = (expected !== 'unknown' && a.media_type === expected ? 100 : 0) + (year && a.year === year ? 50 : 0);
            let sB = (expected !== 'unknown' && b.media_type === expected ? 100 : 0) + (year && b.year === year ? 50 : 0);
            return sB - sA;
        });
    }

    function extractMovieInfo(rawName) {
        let ext = '';
        let nameWithoutExt = rawName;
        let extMatch = rawName.match(/(\.(?!\d+[KMG]B)[a-z0-9]{2,6})$/i);
        if (extMatch && !/^\.\d+$/.test(extMatch[1])) {
            ext = extMatch[1];
            nameWithoutExt = rawName.slice(0, -ext.length);
        }

        let rawType = 'unknown';
        if (/(剧集|第[一二三四五六七八九十\d]+季|S\d{1,2}|E\d{1,3}|EP\d+|全\d+集)/i.test(nameWithoutExt)) { rawType = 'tv'; }
        else if (/(电影|Movie)/i.test(nameWithoutExt)) { rawType = 'movie'; }

        let clean = nameWithoutExt.replace(/\s*[-_]?\s*文件夹.*$/i, '').replace(/\s+\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}.*$/i, '');
        let sMatch = clean.match(/(?:\bS(\d{1,2})\b|第([一二三四五六七八九十\d]+)季|Season\s*(\d+))/i);
        let type = rawType !== 'unknown' ? rawType : (sMatch || /E\d{1,3}|EP\d+|全\d+集/i.test(clean) ? 'tv' : 'unknown');

        let yMatches = [...clean.matchAll(/(?:(?<=[\(\[\{\.\s_-])|^)(19[0-9]{2}|20[0-2][0-9])(?:(?=[\)\]\}\.\s_-])|$)/g)];
        let year = yMatches.length > 0 ? yMatches[yMatches.length - 1][1] : '';

        let work = clean.replace(/\{tmdbid-\d+\}/i, '');

        // 【新增逻辑：提前剥离数字序号前缀，如 "197.", "01 - "】
        work = work.replace(/^\d{1,3}(?:\.|、|-|\s)+(?=[\u4e00-\u9fa5a-zA-Z])/i, '');

        let noBracket = work.replace(/[【\[［].*?[\]】］]/g, ' ');
        if (noBracket.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '').trim().length > 0) { work = noBracket; }
        work = work.replace(/[\._]/g, ' ');

        let engTags = /(?:^|[\.\-\s_\[\(【])(1080p|1080i|2160p|720p|4k|8k|UHD|BluRay|WEB-DL|WEB|WEBRip|HDTV|Remux|BDRip|x264|x265|H264|H265|HEVC|AVC|HQ|DTS|TrueHD|Dolby|Atmos|AAC|AC3|DDP\d*\.?\d*|FLAC|APE|\d+fps|HDR\d*|10bit|DoVi|DV|HKG|CHS|CHT|ENG|DreamHD|ColorWEB|BlackTV|SSDSSE|BBQDDQ|BBEDDE|PTHDTV|QQHDTV|DDHDTV|S-ParkL|S-CTRLHD|QuickIO|Repack|AMZN|Amazon|NF|Netflix|Disney\+|AppleTV|Hulu)(?:[\.\-\s_\]\)】]|$)/i;
        let cnTags = /(国配|粤配|台配|国语|粤语|中配|双配|双语|多音轨|中字|简繁|特效字幕|无删减|未删减|原盘|\d+帧|高码|杜比|完整版|收藏版|加长版|导演剪辑版|版本|双版本|全\d+集)/i;

        let minIndex = work.length;
        let matchEng = work.match(engTags); if (matchEng) minIndex = Math.min(minIndex, matchEng.index);
        let matchCn = work.match(cnTags); if (matchCn) minIndex = Math.min(minIndex, matchCn.index);
        work = work.substring(0, minIndex);

        let title = work;
        title = title.replace(/\bS\d{1,2}\b.*|第.*?[季集].*|全.*?集.*|系列/ig, '');
        title = title.replace(/[《》\(\)\{\}（）]/g, ' ').replace(/[-+]+$/, '').trim();
        if (year) title = title.replace(new RegExp(`(^|\\s)${year}(?=\\s|$)`, 'g'), ' ');
        title = title.replace(/\s{2,}/g, ' ').trim();

        let seasonNum = null;
        if (sMatch) {
            if (sMatch[1]) seasonNum = parseInt(sMatch[1], 10);
            else if (sMatch[2]) seasonNum = cnToNum(sMatch[2]);
            else if (sMatch[3]) seasonNum = parseInt(sMatch[3], 10);
        }

        return { title, year, type, season: sMatch?.[0]||'', seasonNum, extension: ext };
    }

    async function startBatchRename(forceManual = false, forceParent = false) {
        const key = $('#tmdb-api').value.trim();
        const host = 'api.tmdb.org';
        const modeBtn = $('#tmdb-mode-group .tmdb-segment-btn.active');
        const mode = modeBtn ? modeBtn.getAttribute('data-val') : 'multi';
        const bModeBtn = $('#tmdb-typography-group .tmdb-segment-btn.active');
        const bMode = bModeBtn ? bModeBtn.getAttribute('data-val') : 'title_year';
        const isTurbo = GM_getValue('tmdb_turbo_mode', false);

        if (!key) return addLog("[ERR] Missing TMDB API Key.", "error");

        let targets = getSelectedItemNames();
        if (!targets.length) return addLog("[WARN] 没有选中项目 (文件/文件夹)。", "warn");

        const btnAuto = $('#tmdb-start-btn'); const btnFix = $('#tmdb-fix-btn'); const btnParent = $('#tmdb-parent-btn');
        btnAuto.disabled = true; btnFix.disabled = true; btnParent.disabled = true;
        const activeBtn = forceParent ? btnParent : (forceManual ? btnFix : btnAuto);
        let origBtnText = activeBtn.innerText;

        addLog(`>> SEQUENCE INITIATED | Targets: ${targets.length} ${isTurbo ? '⚡[TURBO]' : ''}`, "info");
        await unlockMultiSelectLimit(isTurbo);

        let overrideStr = $('#tmdb-parent-override').value.trim();
        let cachedParentTmdbData = null;

        for (let i = 0; i < targets.length; i++) {
            activeBtn.innerText = `Executing (${i+1}/${targets.length})`;
            try {
                let info = extractMovieInfo(targets[i]);

                let tempTitle = info.title.replace(/[\s\(\)\[\]]/g, '');
                let isIsolatedSeason = /^(season|s|第.*?季|季)$/i.test(tempTitle) || tempTitle === '';
                let shouldUseParent = forceParent || isIsolatedSeason;

                if (shouldUseParent) {
                    if (!overrideStr) {
                        let sniffedName = autoSniffParentName();
                        if (sniffedName) {
                            overrideStr = sniffedName;
                            $('#tmdb-parent-override').value = overrideStr;
                            GM_setValue('tmdb_parent_override', overrideStr);

                            const clearBtn = $('#tmdb-clear-override');
                            const sniffBtn = $('#tmdb-sniff-btn');
                            if(clearBtn && sniffBtn) {
                                clearBtn.classList.add('show');
                                sniffBtn.classList.add('shifted');
                            }

                            addLog(`> 🤖 自动嗅探到页面文件夹名: <span style="color:#30d158">${overrideStr}</span>`, 'info');
                        } else {
                            if (forceParent) {
                                addLog(`[ERR] 强制刮削失败：无法自动嗅探到有效文件夹名，请手动填写！`, 'error');
                                break;
                            } else {
                                addLog(`[WARN] 孤立季数未嗅探到父级剧名，跳过。`, 'warn');
                                continue;
                            }
                        }
                    }

                    let overrideInfo = extractMovieInfo(overrideStr);
                    info.title = overrideInfo.title;
                    if (overrideInfo.year) info.year = overrideInfo.year;
                    info.type = 'tv';
                }

                let searchMode = mode;
                if (mode === 'multi') {
                    if (info.type === 'tv') searchMode = 'tv'; else if (info.type === 'movie') searchMode = 'movie';
                }
                if (mode === 'movie') { info.season = ''; info.seasonNum = null; }

                let sStr = info.season;
                if (info.seasonNum !== null) sStr = `S${String(info.seasonNum).padStart(2, '0')}`;

                addLog(`> 提取: <span style="color:var(--v-text-m)">${info.title} ${info.year ? '['+info.year+']' : ''} <span style="color:#0A84FF;font-size:11px;">[路由:${searchMode}]</span></span>`);

                let tmdb = null;

                if (shouldUseParent) {
                    if (cachedParentTmdbData) { tmdb = Object.assign({}, cachedParentTmdbData); }
                    else {
                        let results = await fetchTmdbData(info.title, info.year, info.type, searchMode, key, host);
                        tmdb = results.length ? results[0] : await showInteractiveModal(info.title, searchMode, key, host);
                        if (tmdb) cachedParentTmdbData = Object.assign({}, tmdb);
                    }
                } else {
                    if (forceManual) { tmdb = await showInteractiveModal(info.title, searchMode, key, host); }
                    else {
                        let results = await fetchTmdbData(info.title, info.year, info.type, searchMode, key, host);
                        tmdb = results.length ? results[0] : await showInteractiveModal(info.title, searchMode, key, host);
                    }
                }

                if (!tmdb) { addLog(`> Skipped.`); continue; }

                if (tmdb.media_type === 'tv' || searchMode === 'tv') {
                    if (info.seasonNum === null) info.seasonNum = 1;
                    if (!shouldUseParent) {
                        let tvData = await fetchAPI(`https://${host}/3/tv/${tmdb.id}/season/${info.seasonNum}?api_key=${key}&language=zh-CN`);
                        if (tvData?.air_date) tmdb.year = tvData.air_date.substring(0, 4);
                    }
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
                    await executeRenameOnPage(targets[i], finalName, isTurbo);
                    await new Promise(r => setTimeout(r, isTurbo ? 1 : 250));
                }

                let posterSrc = tmdb.poster || "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='60' height='90'><rect width='60' height='90' fill='%23222'/></svg>";
                addLog(`
                    <div class="log-item-visual">
                        <img class="log-poster" src="${posterSrc}" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'60\\' height=\\'90\\'><rect width=\\'60\\' height=\\'90\\' fill=\\'%23222\\'/></svg>'" />
                        <div class="log-details">
                            <span class="log-old">${targets[i]}</span>
                            <span class="log-new">➔ ${finalName}</span>
                        </div>
                    </div>
                `, 'raw');

            } catch (err) {
                if (err === 'USER_STOP') { addLog(`[ABORT] Pipeline halted.`, "error"); break; }
                addLog(`[ERR] ${err.message || err}`, "error");
                await new Promise(r => setTimeout(r, 1000));
            }
        }
        addLog(`>> SEQUENCE COMPLETE.`, "info");
        btnAuto.disabled = false; btnFix.disabled = false; btnParent.disabled = false;
        activeBtn.innerText = origBtnText;
    }

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

                    const placeholder = `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='60' height='90'><rect width='60' height='90' fill='%23222'/></svg>`;
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