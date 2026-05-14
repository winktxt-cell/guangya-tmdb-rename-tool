// ==UserScript==
// @name         TMDB助手 By宝宝 Q479874394 (V4 修复版)
// @namespace    http://tampermonkey.net/
// @version      V4
// @description  修复bug
// @author       宝宝
// @match        *://*.guangyapan.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @grant        unsafeWindow
// @connect      api.guangyapan.com
// @connect      api.tmdb.org
// @connect      api.zhconvert.org
// @connect      *
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    
    const TMDB_CORE = {
        auth: '', did: '', dt: '4',
        fileMap: new Map(),
        manualOverrideData: null,

        extractFiles: function(obj) {
            if (!obj) return;
            try {
                let search = (target, depth) => {
                    if (depth > 20) return;
                    if (Array.isArray(target)) {
                        target.forEach(t => search(t, depth + 1));
                    } else if (typeof target === 'object' && target !== null) {
                        let id = target.fileId || target.file_id || target.id || target.rowKey || target.key;
                        let name = target.name || target.fileName || target.file_name || target.title;
                        if (id && name && String(id).length >= 15) {
                            TMDB_CORE.fileMap.set(name.trim(), String(id));
                        }
                        Object.keys(target).forEach(k => {
                            if(!['parent', 'children', 'creator', 'modifier', 'vnode', '$parent'].includes(k)) search(target[k], depth + 1);
                        });
                    }
                };
                search(obj, 0);
            } catch(e) {}
        },

        getId: function(rawName) {
            if (!rawName) return null;
            let nameTrim = rawName.trim();
            if (this.fileMap.has(nameTrim)) return { id: this.fileMap.get(nameTrim), fullName: nameTrim };

            if (nameTrim.includes('...')) {
                let parts = nameTrim.split('...');
                let prefix = parts[0].trim();
                let suffix = parts[1] ? parts[1].trim() : '';
                for (let [fullName, id] of this.fileMap.entries()) {
                    if (fullName.startsWith(prefix) && fullName.endsWith(suffix)) return { id: id, fullName: fullName };
                }
            }

            let cleanRaw = nameTrim.replace(/\s+/g, '');
            for (let [fullName, id] of this.fileMap.entries()) {
                if (fullName.replace(/\s+/g, '').includes(cleanRaw)) return { id: id, fullName: fullName };
            }
            return null;
        }
    };

    const originalFetch = window.fetch;
    window.fetch = async function(...args) {
        if (args[1] && args[1].headers) {
            let h = args[1].headers;
            let getHeader = (key) => {
                if (h instanceof Headers) return h.get(key);
                for (let k in h) if (k.toLowerCase() === key.toLowerCase()) return h[k];
                return null;
            };
            let auth = getHeader('authorization');
            let did = getHeader('did');
            if (auth && auth.startsWith('Bearer')) TMDB_CORE.auth = auth;
            if (did) TMDB_CORE.did = did;
        }
        const response = await originalFetch.apply(this, args);
        try {
            const clone = response.clone();
            clone.text().then(txt => {
                if (txt && txt.includes('fileId') && txt.includes('{')) {
                    TMDB_CORE.extractFiles(JSON.parse(txt));
                }
            }).catch(()=>{});
        } catch(e) {}
        return response;
    };

    const origSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;
    XMLHttpRequest.prototype.setRequestHeader = function(name, value) {
        if (name.toLowerCase() === 'authorization' && value.startsWith('Bearer')) TMDB_CORE.auth = value;
        if (name.toLowerCase() === 'did') TMDB_CORE.did = value;
        origSetRequestHeader.apply(this, arguments);
    };

    const origXhrOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function() {
        this.addEventListener('load', function() {
            try {
                if (this.responseText && this.responseText.includes('fileId') && this.responseText.includes('{')) {
                    TMDB_CORE.extractFiles(JSON.parse(this.responseText));
                }
            } catch(e) {}
        });
        origXhrOpen.apply(this, arguments);
    };

    function getAuthToken() {
        if (TMDB_CORE.auth) return TMDB_CORE.auth;
        try {
            for (let i = 0; i < localStorage.length; i++) {
                let key = localStorage.key(i);
                let val = localStorage.getItem(key);
                if (val && typeof val === 'string' && val.length > 30 && val.includes('Bearer')) {
                    let match = val.match(/(Bearer\s+[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*)/i);
                    if (match) return match[1];
                }
            }
        } catch(e) {}
        return '';
    }

    function getDid() {
        if (TMDB_CORE.did) return TMDB_CORE.did;
        try {
            let match = document.cookie.match(/did=([^;]+)/);
            if (match) return match[1];
            return localStorage.getItem('did') || localStorage.getItem('deviceId') || '';
        } catch(e) { return ''; }
    }

    const $ = s => document.querySelector(s);
    const $$ = s => document.querySelectorAll(s);
    const delay = ms => new Promise(r => setTimeout(r, ms));

    const addLog = (msg, type = 'normal') => {
        const logBox = $('#tmdb-log');
        if (!logBox) return;
        if (type === 'raw') logBox.insertAdjacentHTML('beforeend', msg);
        else logBox.insertAdjacentHTML('beforeend', `<p class="${type !== 'normal' ? 'log-' + type : ''}">${msg}</p>`);
        logBox.scrollTop = logBox.scrollHeight;
    };
    const sanitize = n => n?.replace(/[:?*|"<>\/\\]/g, m => ({':':'：','?':'？','*':'＊','|':'｜','"':'”','<':'《','>':'》','/':'／','\\':'＼'})[m]).trim() || '';
    const cnToNumMap = {'零':0,'一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9,'十':10,'百':100};
    const cnToNum = s => {
        if (!s) return null; if (!isNaN(s)) return parseInt(s, 10);
        let total = 0; let tmp = 0;
        for(let i=0; i<s.length; i++){
            let val = cnToNumMap[s[i]];
            if(val === undefined) continue;
            if(val === 10 || val === 100) { if(tmp === 0) tmp = 1; total += tmp * val; tmp = 0; } else tmp = val;
        }
        total += tmp; return total;
    };
    function parseSeasonEpisode(str, defaultSeason = 1) {
        let s = defaultSeason; let e = null;
        let m1 = str.match(/[Ss](\d{1,2})[.\-_ ]?[Ee](\d{1,4})/i); if (m1) return { s: parseInt(m1[1]), e: parseInt(m1[2]) };
        let m2 = str.match(/第([一二三四五六七八九十百零\d]+)季[.\-_ ]*第([一二三四五六七八九十百零\d]+)[集话期]/); if (m2) return { s: cnToNum(m2[1]), e: cnToNum(m2[2]) };
        let m3 = str.match(/[Ee][Pp]?\s*(\d{1,4})(?!\d)/i); if (m3) return { s: s, e: parseInt(m3[1]) };
        let m4 = str.match(/第([一二三四五六七八九十百零\d]+)[集话期]/); if (m4) return { s: s, e: cnToNum(m4[1]) };
        let m5 = str.match(/[Ss](\d{1,2})\b/i); if (m5) s = parseInt(m5[1]);
        return { s, e };
    }

    function showPanelConfirm(title, htmlMsg) {
        return new Promise(resolve => {
            const container = $('#tmdb-ui-container'); if (!container) return resolve(false);
            const overlayId = 'tmdb-panel-overlay'; let oldOverlay = $('#' + overlayId); if (oldOverlay) oldOverlay.remove();
            container.insertAdjacentHTML('beforeend', `<div id="${overlayId}"><div class="tmdb-confirm-box"><div class="tmdb-confirm-icon">⚠️</div><div class="tmdb-confirm-title">${title}</div><div class="tmdb-confirm-msg">${htmlMsg}</div><div class="tmdb-confirm-actions"><button class="tmdb-confirm-btn tmdb-confirm-cancel" id="tmdb-c-cancel">取 消</button><button class="tmdb-confirm-btn tmdb-confirm-ok" id="tmdb-c-ok">继 续</button></div></div></div>`);
            const overlayEl = $('#' + overlayId); void overlayEl.offsetWidth; overlayEl.classList.add('show');
            const closeAndResolve = (val) => { overlayEl.classList.remove('show'); setTimeout(() => { if (overlayEl.parentNode) overlayEl.remove(); resolve(val); }, 300); };
            $('#tmdb-c-cancel').onclick = () => closeAndResolve(false); $('#tmdb-c-ok').onclick = () => closeAndResolve(true);
        });
    }

    function createUI() {
        if ($('#tmdb-ui-container')) return;
        const getVal = (k, def) => GM_getValue(k, def);
        const sel = (k, val) => getVal(k, 'multi') === val ? 'active' : '';
        const bSel = (k, val) => { let v = getVal(k, 'title_year'); if (v === 'title_only') v = 'title_year'; return v === val; };
        const selSep = (val) => getVal('tmdb_separator', '.') === val ? 'active' : '';

        const isCollapsed = getVal('tmdb_ui_collapsed', false); const isTurbo = getVal('tmdb_turbo_mode', false);
        const savedMode = getVal('tmdb_search_mode', 'multi'); const modeIdxMap = { 'multi': 0, 'movie': 1, 'tv': 2, 'collection': 3 };
        const initModeIdx = modeIdxMap[savedMode] !== undefined ? modeIdxMap[savedMode] : 0;

        let savedBMode = getVal('tmdb_brackets_mode', 'title_year'); if (savedBMode === 'title_only') savedBMode = 'title_year';
        const bModeIdxMap = { 'title_year': 0, 'none': 1 }; const initBModeIdx = bModeIdxMap[savedBMode] !== undefined ? bModeIdxMap[savedBMode] : 0;

        const isTooltipEnabled = String(getVal('tmdb_tooltip_enabled', 'true')) === 'true'; const initTooltipIdx = isTooltipEnabled ? 0 : 1;
        const tooltipDelay = parseInt(getVal('tmdb_tooltip_delay', 1000), 10); const delayIdxMap = { 0: 0, 500: 1, 1000: 2, 2000: 3 };
        const initDelayIdx = delayIdxMap[tooltipDelay] !== undefined ? delayIdxMap[tooltipDelay] : 2;

        const initSep = getVal('tmdb_separator', '.'); const sepIdxMap = { '.': 0, ' - ': 1, ' ': 2 }; const initSepIdx = sepIdxMap[initSep] !== undefined ? sepIdxMap[initSep] : 0;

        const savedPoster = getVal('tmdb_poster_size', 'sm'); const posterIdxMap = { 'sm': 0, 'md': 1, 'lg': 2 }; const initPosterIdx = posterIdxMap[savedPoster] !== undefined ? posterIdxMap[savedPoster] : 0; const selPoster = (val) => savedPoster === val ? 'active' : '';
        const savedHeight = getVal('tmdb_panel_height', 'standard'); const heightIdxMap = { 'standard': 0, 'tall': 1, 'max': 2 }; const initHeightIdx = heightIdxMap[savedHeight] !== undefined ? heightIdxMap[savedHeight] : 0; const selHeight = (val) => savedHeight === val ? 'active' : '';

        const savedWidth = getVal('tmdb_panel_width', 'standard'); const widthIdxMap = { 'standard': 0, 'borderless': 1 }; const initWidthIdx = widthIdxMap[savedWidth] !== undefined ? widthIdxMap[savedWidth] : 0; const selWidth = (val) => savedWidth === val ? 'active' : '';

        let pOverrideVal = getVal('tmdb_parent_override', ''); let isParentCollapsed = getVal('tmdb_parent_ui_collapsed', true);
        if (pOverrideVal !== '') isParentCollapsed = false;

        GM_addStyle(`
            :root{--v-bg:rgba(20,20,22,0.45);--v-border:rgba(255,255,255,0.18);--v-border-hl:rgba(255,255,255,0.4);--v-text:#fff;--v-text-m:rgba(255,255,255,0.55);--v-blue:#0A84FF;--v-red:#FF453A;--v-rm:28px;--v-ri:14px;--v-font:"SF Pro Display",-apple-system,BlinkMacSystemFont,sans-serif;}
            #tmdb-ui-container{ position:fixed; bottom:35px; right:35px; width:420px; background:var(--v-bg); color:var(--v-text); border:1px solid var(--v-border); border-radius:var(--v-rm); box-shadow:0 30px 60px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.2); backdrop-filter:blur(50px) saturate(200%); -webkit-backdrop-filter:blur(50px) saturate(200%); z-index:99998; font-family:var(--v-font); display:flex; flex-direction:column; overflow:hidden; transition: width 0.4s cubic-bezier(0.34, 1.2, 0.64, 1), border-radius 0.4s cubic-bezier(0.34, 1.2, 0.64, 1), background 0.5s ease, padding 0.4s ease; }
            #tmdb-ui-container.collapsed { width: 140px !important; cursor: pointer; border-radius: 30px; background: rgba(20,20,22,0.85); }

            #tmdb-ui-container.width-borderless { width: 340px; border-radius: 16px; }
            #tmdb-ui-container.width-borderless #tmdb-ui-header { padding: 14px 10px 10px; }
            #tmdb-ui-container.width-borderless .tmdb-ui-body { padding: 0 8px 12px; }
            #tmdb-ui-container.width-borderless #tmdb-settings-panel { padding: 12px 8px; }
            #tmdb-ui-container.width-borderless #tmdb-parent-section { padding: 10px 6px; border-radius: 10px; }
            #tmdb-ui-container.width-borderless .tmdb-input-row { gap: 6px; margin-bottom: 8px; }
            #tmdb-ui-container.width-borderless .tmdb-meta-display { padding: 6px 4px; gap: 2px; }
            #tmdb-ui-container.width-borderless .tmdb-drag-container { padding: 4px; gap: 2px; }
            #tmdb-ui-container.width-borderless .tmdb-drag-tag { font-size: 10px; padding: 0 2px; height: 24px; }

            #tmdb-ui-header { padding:20px 24px 20px; font-weight:700; font-size:18px; display:flex; justify-content:space-between; align-items:center; transition: padding 0.4s ease, font-size 0.5s ease; white-space: nowrap; position: relative; z-index: 10; }
            #tmdb-title-text { -webkit-user-select: none; user-select: none; pointer-events: none; }
            #tmdb-ui-container.collapsed #tmdb-ui-header { padding: 16px 20px; font-size: 15px; }
            .tmdb-header-actions { display: flex; align-items: center; gap: 6px; }
            .tmdb-icon-btn { cursor:pointer; opacity:0.6; transition:all 0.4s cubic-bezier(0.34, 1.2, 0.64, 1); font-size:20px; width:28px; height:28px; display:flex; align-items:center; justify-content:center; border-radius:50%; }
            .tmdb-icon-btn:hover { opacity:1; background:rgba(255,255,255,0.15); }
            .tmdb-collapse-btn { font-size:24px; line-height:0.8; }
            #tmdb-ui-container.collapsed .tmdb-collapse-btn { transform: rotate(180deg); }
            #tmdb-ui-container.collapsed #tmdb-settings-btn { display: none; }
            #tmdb-settings-btn.active { opacity: 1; color: #0A84FF; transform: rotate(90deg); background: rgba(255,255,255,0.1); }
            #tmdb-settings-panel { max-height: 0; overflow: hidden; opacity: 0; background: rgba(0,0,0,0.25); box-shadow: inset 0 2px 10px rgba(0,0,0,0.3); transition: all 0.4s cubic-bezier(0.34, 1.2, 0.64, 1); }
            #tmdb-ui-container.show-settings #tmdb-settings-panel { max-height: 560px; opacity: 1; padding: 16px 24px; border-bottom: 1px solid rgba(255,255,255,0.05); }
            #tmdb-ui-container.collapsed #tmdb-settings-panel { max-height: 0!important; opacity: 0!important; padding: 0 24px!important; }
            .tmdb-ui-body { padding: 0 24px 24px; max-height: 1500px; opacity: 1; transform: translateY(0) scale(1); transition: max-height 0.6s cubic-bezier(0.34, 1.2, 0.64, 1), opacity 0.4s ease 0.1s, transform 0.5s cubic-bezier(0.34, 1.2, 0.64, 1), padding 0.4s cubic-bezier(0.34, 1.2, 0.64, 1); }
            #tmdb-ui-container.collapsed .tmdb-ui-body { max-height: 0; opacity: 0; transform: translateY(-10px) scale(0.98); padding-bottom: 0; pointer-events: none; transition: max-height 0.5s cubic-bezier(0.34, 1, 0.64, 1), opacity 0.2s ease, transform 0.4s ease, padding 0.5s cubic-bezier(0.34, 1, 0.64, 1); }
            .tmdb-input-row{display:flex;gap:14px;margin-bottom:12px;} .tmdb-input-group{flex:1; display:flex; flex-direction:column;}
            .tmdb-input-group label{display:block;font-size:12px;font-weight:600;margin-bottom:6px;color:var(--v-text-m); white-space: nowrap;}
            .tmdb-input-group input {width:100%;padding:10px 14px;border-radius:10px;border:1px solid rgba(255,255,255,0.08);background:rgba(0,0,0,0.3);color:#fff;outline:none;transition:all 0.3s;font-size:14px;font-family:var(--v-font);appearance:none;box-shadow:inset 0 2px 4px rgba(0,0,0,0.2); box-sizing: border-box;}
            .tmdb-input-group input:focus {border-color:var(--v-border-hl);background:rgba(255,255,255,0.05);box-shadow:0 0 0 4px rgba(255,255,255,0.1),inset 0 2px 4px rgba(0,0,0,0.2);}

            .tmdb-input-wrapper { position: relative; width: 100%; display: flex; align-items: center; }
            .tmdb-input-wrapper input { padding-right: 90px !important; }
            .tmdb-input-actions { position: absolute; right: 12px; display: flex; align-items: center; gap: 8px; }
            .tmdb-action-icon { color: var(--v-text-m); font-size: 16px; cursor: pointer; user-select: none; transition: transform 0.2s cubic-bezier(0.34, 1.2, 0.64, 1), color 0.2s; }
            .tmdb-action-icon:hover { transform: scale(1.15); }
            #tmdb-manual-search-btn:hover { color: #0A84FF; transform: scale(1.15) rotate(-10deg); }
            #tmdb-sniff-btn:hover { color: #30d158; transform: scale(1.15) rotate(10deg); }
            .tmdb-clear-btn { color: var(--v-text-m); font-size: 20px; cursor: pointer; user-select: none; font-weight: bold; line-height: 1; overflow: hidden; width: 0; opacity: 0; transform: scale(0.5) rotate(-90deg); transition: all 0.4s cubic-bezier(0.34, 1.2, 0.64, 1); margin-left: -4px; }
            .tmdb-clear-btn.show { width: 16px; opacity: 1; pointer-events: auto; transform: scale(1) rotate(0deg); margin-left: 0; }
            .tmdb-clear-btn:hover { color: #FF453A; transform: scale(1.2); }

            .tmdb-turbo-btn { display:flex; flex-direction:row; justify-content:center; align-items:center; gap:8px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: var(--v-ri); cursor: pointer; transition: all 0.3s cubic-bezier(0.34, 1.2, 0.64, 1); outline: none; position: relative; overflow: hidden; box-sizing: border-box; }
            .tmdb-turbo-btn.active { background: linear-gradient(135deg, rgba(48,209,88,0.15), rgba(10,132,255,0.15)); border: 1px solid rgba(48,209,88,0.6); box-shadow: inset 0 0 15px rgba(48,209,88,0.2), 0 0 15px rgba(48,209,88,0.4); transform: scale(1.02); }
            .tmdb-turbo-btn .turbo-text { color: var(--v-text-m); font-weight: 700; font-size: 13px; transition: all 0.3s; }
            .tmdb-turbo-btn.active .turbo-text { color: #30d158; text-shadow: 0 0 8px rgba(48,209,88,0.8); letter-spacing: 0.5px; }
            .tmdb-turbo-btn:active { transform: scale(0.95); }
            .tmdb-segment-control { display: flex; position: relative; z-index: 1; background: rgba(0,0,0,0.25); border-radius: 10px; padding: 3px; border: 1px solid rgba(255,255,255,0.06); gap: 4px; flex: 1; --idx: 0; box-sizing: border-box;}
            .tmdb-segment-indicator { position: absolute; top: 3px; bottom: 3px; left: 3px; background: rgba(255,255,255,0.15); border-radius: 8px; box-shadow: 0 2px 6px rgba(0,0,0,0.2); transform: translateX(calc(var(--idx) * 100% + var(--idx) * 4px)); transition: transform 0.4s cubic-bezier(0.34, 1.2, 0.64, 1); z-index: -1; pointer-events: none; }
            #tmdb-mode-group .tmdb-segment-indicator, #tmdb-tooltip-delay-group .tmdb-segment-indicator { width: calc((100% - 18px) / 4); }
            #tmdb-typography-group .tmdb-segment-indicator, #tmdb-tooltip-toggle-group .tmdb-segment-indicator, #tmdb-panel-width-group .tmdb-segment-indicator { width: calc((100% - 10px) / 2); }
            #tmdb-separator-group .tmdb-segment-indicator, #tmdb-poster-size-group .tmdb-segment-indicator, #tmdb-panel-height-group .tmdb-segment-indicator { width: calc((100% - 14px) / 3); }
            .tmdb-segment-btn { flex: 1; background: transparent !important; border: none; color: var(--v-text-m); padding: 7px 0; font-size: 12px; font-weight: 600; cursor: pointer; border-radius: 8px; transition: color 0.3s ease; box-shadow: none !important; transform: none !important; white-space: nowrap; overflow: hidden; }
            .tmdb-segment-btn.active { color: #fff; }
            .tmdb-segment-btn:hover:not(.active) { color: #ddd; background: rgba(255,255,255,0.05) !important; }
            .tmdb-btn-group{display:flex;gap:12px; box-sizing: border-box; margin-bottom: 12px;}
            .tmdb-btn{width:100%;border:1px solid rgba(255,255,255,0.1);padding:10px;border-radius:12px;cursor:pointer;font-weight:700;font-size:13px;font-family:var(--v-font);transition:all 0.3s cubic-bezier(0.34, 1.2, 0.64, 1);backdrop-filter:blur(20px); box-sizing: border-box;}
            .tmdb-btn:disabled{opacity:0.3;cursor:not-allowed;transform:none!important;box-shadow:none!important;background:rgba(255,255,255,0.05)!important;color:var(--v-text-m)!important;}
            #tmdb-start-btn { background: linear-gradient(135deg, rgba(10,132,255,0.15), rgba(0,201,255,0.15)); border: 1px solid rgba(10,132,255,0.6); box-shadow: inset 0 0 15px rgba(10,132,255,0.2), 0 0 15px rgba(10,132,255,0.4); color: #fff; text-shadow: 0 0 8px rgba(10,132,255,0.8); letter-spacing: 0.5px; padding:12px; font-size: 14px;}
            #tmdb-fix-btn { background: linear-gradient(135deg, rgba(255,159,10,0.15), rgba(255,69,58,0.15)); border: 1px solid rgba(255,159,10,0.6); box-shadow: inset 0 0 15px rgba(255,159,10,0.2), 0 0 15px rgba(255,159,10,0.4); color: #fff; text-shadow: 0 0 8px rgba(255,159,10,0.8); letter-spacing: 0.5px; padding:12px; font-size: 14px;}
            #tmdb-parent-btn { background: linear-gradient(135deg, rgba(48,209,88,0.15), rgba(10,132,255,0.15)); border: 1px solid rgba(48,209,88,0.6); box-shadow: inset 0 0 15px rgba(48,209,88,0.2), 0 0 15px rgba(48,209,88,0.4); color: #fff; text-shadow: 0 0 8px rgba(48,209,88,0.8); letter-spacing: 0.5px; }
            #tmdb-prepend-btn { background: linear-gradient(135deg, rgba(191,90,242,0.15), rgba(10,132,255,0.15)); border: 1px solid rgba(191,90,242,0.6); box-shadow: inset 0 0 15px rgba(191,90,242,0.2), 0 0 15px rgba(191,90,242,0.4); color: #fff; text-shadow: 0 0 8px rgba(191,90,242,0.8); letter-spacing: 0.5px; }
            #tmdb-remove-prefix-btn { background: linear-gradient(135deg, rgba(255,69,58,0.15), rgba(255,159,10,0.15)); border: 1px solid rgba(255,69,58,0.6); box-shadow: inset 0 0 15px rgba(255,69,58,0.2), 0 0 15px rgba(255,69,58,0.4); color: #fff; text-shadow: 0 0 8px rgba(255,69,58,0.8); letter-spacing: 0.5px; }
            #tmdb-local-format-btn { background: linear-gradient(135deg, rgba(255,214,10,0.15), rgba(255,159,10,0.15)); border: 1px solid rgba(255,214,10,0.6); box-shadow: inset 0 0 15px rgba(255,214,10,0.2), 0 0 15px rgba(255,214,10,0.4); color: #fff; text-shadow: 0 0 8px rgba(255,214,10,0.8); letter-spacing: 0.5px; width: 100%; padding:14px; font-size:14px; }

            
            #tmdb-select-all-btn { background: linear-gradient(135deg, rgba(48,209,88,0.15), rgba(10,132,255,0.15)); border: 1px solid rgba(48,209,88,0.6); box-shadow: inset 0 0 15px rgba(48,209,88,0.2), 0 0 15px rgba(48,209,88,0.4); color: #fff; text-shadow: 0 0 8px rgba(48,209,88,0.8); letter-spacing: 0.5px; }
            #tmdb-series-btn { background: linear-gradient(135deg, rgba(191,90,242,0.15), rgba(10,132,255,0.15)); border: 1px solid rgba(191,90,242,0.6); box-shadow: inset 0 0 15px rgba(191,90,242,0.2), 0 0 15px rgba(191,90,242,0.4); color: #fff; text-shadow: 0 0 8px rgba(191,90,242,0.8); letter-spacing: 0.5px; }

            
            #tmdb-start-btn:active:not(:disabled), #tmdb-fix-btn:active:not(:disabled), #tmdb-parent-btn:active:not(:disabled), #tmdb-prepend-btn:active:not(:disabled), #tmdb-remove-prefix-btn:active:not(:disabled), #tmdb-local-format-btn:active:not(:disabled), #tmdb-select-all-btn:active:not(:disabled), #tmdb-series-btn:active:not(:disabled) { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); box-shadow: none; text-shadow: none; color: var(--v-text-m); transform: scale(0.95); }
            #tmdb-parent-section { background: rgba(0,0,0,0.15); padding: 14px; border-radius: 16px; box-sizing: border-box; border: 1px solid rgba(255,255,255,0.05); margin-bottom: 20px; width: 100%; transition: all 0.4s cubic-bezier(0.34, 1.2, 0.64, 1); overflow: hidden; }
            .tmdb-parent-header { display: flex; justify-content: space-between; align-items: center; cursor: pointer; user-select: none; margin-bottom: 10px; transition: margin 0.4s; }
            .tmdb-parent-header label { color: #30d158; margin: 0 !important; cursor: pointer; }
            .tmdb-parent-toggle-icon { color: var(--v-text-m); font-size: 12px; transition: transform 0.4s cubic-bezier(0.34, 1.2, 0.64, 1); }
            .tmdb-parent-body { max-height: 450px; opacity: 1; transform: translateY(0); transition: all 0.4s cubic-bezier(0.34, 1.2, 0.64, 1); }
            #tmdb-parent-section.collapsed { padding: 10px 14px; background: rgba(0,0,0,0.25); }
            #tmdb-parent-section.collapsed .tmdb-parent-header { margin-bottom: 0; }
            #tmdb-parent-section.collapsed .tmdb-parent-toggle-icon { transform: rotate(-90deg); }
            #tmdb-parent-section.collapsed .tmdb-parent-body { max-height: 0; opacity: 0; transform: translateY(-10px) scale(0.98); pointer-events: none; }

            .tmdb-drag-container { display: flex; gap: 4px; flex-wrap: nowrap; justify-content: space-between; background: rgba(0,0,0,0.15); padding: 6px 8px; border-radius: 12px; box-shadow: inset 0 2px 8px rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.05); box-sizing: border-box; width: 100%; height: 42px; align-items: center; transition: opacity 0.25s ease, transform 0.25s cubic-bezier(0.34, 1.2, 0.64, 1); overflow: hidden; }
            .tmdb-drag-tag { background: rgba(255,255,255,0.12); color: rgba(255,255,255,0.95); border-radius: 6px; font-size: 11px; font-weight: 500; cursor: grab; display: flex; align-items: center; justify-content: center; user-select: none; flex: 1 1 0; min-width: 0; height: 28px; padding: 0 4px; white-space: nowrap; overflow: hidden; text-overflow: clip; backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 4px 10px rgba(0,0,0,0.1); transition: all 0.3s ease; }
            .tmdb-drag-tag:hover { background: rgba(255,255,255,0.2); transform: translateY(-1px); box-shadow: 0 6px 14px rgba(0,0,0,0.15); }
            .tmdb-drag-tag:active { cursor: grabbing; transform: scale(0.92); background: rgba(255,255,255,0.25); box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
            .tmdb-drag-tag.long-pressing { transform: scale(0.88); background: rgba(255,69,58,0.7); color: #fff; filter: brightness(1.1); box-shadow: 0 0 15px rgba(255,69,58,0.4); border-color: rgba(255,69,58,0.5); }
            .tmdb-drag-tag.deleting { flex: 0 0 0 !important; opacity: 0; filter: blur(4px); pointer-events: none; padding: 0 !important; margin: 0 !important; border: none !important; transform: scale(0); min-width: 0 !important; }
            .tmdb-drag-tag.dragging { opacity: 0.3; transform: scale(0.95); }

            .custom-preset-tag { padding: 4px 8px; background: rgba(255,255,255,0.1); border-radius: 6px; font-size: 11px; color: rgba(255,255,255,0.8); cursor: pointer; transition: all 0.2s; user-select: none; border: 1px solid rgba(255,255,255,0.1); }
            .custom-preset-tag:hover { background: rgba(191,90,242,0.3); border-color: rgba(191,90,242,0.6); color: #fff; transform: translateY(-1px); }
            .custom-preset-tag:active { transform: scale(0.92); }

            .tmdb-meta-display { background: linear-gradient(135deg, rgba(10,132,255,0.1), rgba(48,209,88,0.1)); border: 1px solid rgba(10,132,255,0.3); border-radius: 10px; padding: 8px 10px; margin-bottom: 10px; box-shadow: inset 0 2px 8px rgba(0,0,0,0.2); display: flex; justify-content: space-between; align-items: center; gap: 8px; box-sizing: border-box; width: 100%; }
            .tmdb-meta-item { display: flex; align-items: center; gap: 4px; overflow: hidden; }
            .tmdb-meta-item:nth-child(1), .tmdb-meta-item:nth-child(2) { flex: 1 1 0; min-width: 0; }
            .tmdb-meta-item:nth-child(3) { flex: 0 0 auto; overflow: visible; }
            .tmdb-meta-item i { font-style: normal; font-size: 10px; background: rgba(255,255,255,0.15); padding: 2px 4px; border-radius: 4px; color: var(--v-text-m); flex-shrink: 0; }
            .tmdb-meta-item b { font-size: 12px; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 600; }
            .tmdb-meta-yr b { color: #30d158; overflow: visible; text-overflow: clip; }
            .tmdb-meta-item b.editable-meta { cursor: text; border-bottom: 1px dashed rgba(255,255,255,0.4); outline: none; transition: all 0.2s; padding: 0 2px; display: inline-block; min-width: 15px;}
            .tmdb-meta-item b.editable-meta:focus { border-bottom: 1px solid #30d158; background: rgba(255,255,255,0.1); border-radius: 4px; overflow: visible; text-overflow: clip; min-width: 40px; position: relative; z-index: 10; }

            #tmdb-log{height:180px;overflow-y:auto;background:rgba(0,0,0,0.15);padding:14px;border-radius:12px;font-size:13px;color:#d1d1d6;line-height:1.6;box-shadow:inset 0 2px 10px rgba(0,0,0,0.2); transition: height 0.4s cubic-bezier(0.34, 1.2, 0.64, 1);}
            #tmdb-ui-container.height-tall #tmdb-log { height: 320px; }
            #tmdb-ui-container.height-max #tmdb-log { height: 500px; }
            #tmdb-log p{margin:0 0 8px;border-bottom:1px solid rgba(255,255,255,0.03);padding-bottom:6px;} #tmdb-log p:last-child{border:none;margin:0;padding:0;}
            .log-error{color:var(--v-red);font-weight:700;} .log-warn{color:#ffd60a;} .log-info{color:#fff;font-weight:500;} .log-season{color:#30d158;font-weight:700;}
            .log-item-visual { display:flex; align-items:center; gap:12px; background:rgba(48,209,88,0.1); border:1px solid rgba(48,209,88,0.2); padding:8px; border-radius:10px; margin-bottom:8px; }

            .log-item-visual .log-poster { border-radius:4px; object-fit:cover; background:rgba(0,0,0,0.3); box-shadow:0 2px 6px rgba(0,0,0,0.3); flex-shrink:0; transition: width 0.3s cubic-bezier(0.34, 1.2, 0.64, 1), height 0.3s cubic-bezier(0.34, 1.2, 0.64, 1), border-radius 0.3s;}
            #tmdb-log.poster-sm .log-poster { width:28px; height:42px; }
            #tmdb-log.poster-md .log-poster { width:46px; height:69px; border-radius:6px; }
            #tmdb-log.poster-lg .log-poster { width:70px; height:105px; border-radius:8px; }

            .log-item-visual .log-details { display:flex; flex-direction:column; gap:2px; overflow:hidden; }
            .log-item-visual .log-old { font-size:11px; color:var(--v-text-m); text-decoration:line-through; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
            .log-item-visual .log-new { font-size:13px; font-weight:700; color:#30d158; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
            #tmdb-panel-overlay { position: absolute; inset: 0; z-index: 100000; background: rgba(10,10,12,0.4); backdrop-filter: blur(25px) saturate(200%); -webkit-backdrop-filter: blur(25px) saturate(200%); display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 24px; opacity: 0; transition: opacity 0.3s cubic-bezier(0.34, 1.2, 0.64, 1); pointer-events: none; border-radius: var(--v-rm); }
            #tmdb-panel-overlay.show { opacity: 1; pointer-events: auto; }
            .tmdb-confirm-box { background: rgba(30,30,34,0.85); border: 1px solid rgba(255,255,255,0.15); border-radius: 20px; padding: 24px; width: 100%; box-shadow: 0 20px 40px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.1); transform: scale(0.9) translateY(20px); transition: all 0.4s cubic-bezier(0.34, 1.2, 0.64, 1); text-align: center; }
            #tmdb-panel-overlay.show .tmdb-confirm-box { transform: scale(1) translateY(0); }
            .tmdb-confirm-icon { font-size: 36px; margin-bottom: 12px; }
            .tmdb-confirm-title { font-size: 18px; font-weight: 700; color: #fff; margin-bottom: 16px; letter-spacing: 0.5px; }
            .tmdb-confirm-msg { font-size: 14px; color: rgba(255,255,255,0.8); line-height: 1.6; margin-bottom: 24px; background: rgba(0,0,0,0.2); padding: 12px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.05); text-align: left; word-break: break-all;}
            .tmdb-confirm-actions { display: flex; gap: 12px; }
            .tmdb-confirm-btn { flex: 1; padding: 12px; border-radius: 14px; font-weight: 600; cursor: pointer; transition: all 0.2s cubic-bezier(0.34, 1.2, 0.64, 1); border: none; font-size: 14px; outline: none; }
            .tmdb-confirm-cancel { background: rgba(255,255,255,0.1); color: #fff; border: 1px solid rgba(255,255,255,0.05); }
            .tmdb-confirm-cancel:hover { background: rgba(255,255,255,0.2); transform: scale(0.96); }
            .tmdb-confirm-ok { background: linear-gradient(135deg, rgba(191,90,242,0.8), rgba(10,132,255,0.8)); color: #fff; box-shadow: 0 4px 15px rgba(191,90,242,0.3); }
            .tmdb-confirm-ok:hover { transform: scale(1.04); filter: brightness(1.1); box-shadow: 0 6px 20px rgba(191,90,242,0.5); }
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
            #tmdb-custom-tooltip { position: fixed; background: rgba(20, 20, 22, 0.85); color: rgba(255, 255, 255, 0.95); padding: 8px 14px; border-radius: 10px; font-size: 13px; font-weight: 500; max-width: 260px; word-break: break-word; white-space: pre-wrap; line-height: 1.5; box-shadow: 0 10px 30px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.1); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); pointer-events: none; z-index: 999999; opacity: 0; transform: translateY(8px) scale(0.95); transition: opacity 0.2s ease, transform 0.2s cubic-bezier(0.34, 1.2, 0.64, 1); letter-spacing: 0.5px; }
            #tmdb-custom-tooltip.show { opacity: 1; transform: translateY(0) scale(1); }
        `);

        document.body.insertAdjacentHTML('beforeend', `
            <div id="tmdb-ui-container" class="${isCollapsed ? 'collapsed' : ''} height-${savedHeight} width-${savedWidth}">
                <div id="tmdb-ui-header">
                    <span id="tmdb-title-text">${isCollapsed ? 'TMDB助手' : 'TMDB助手 By宝宝 Q479874394'}</span>
                    <div class="tmdb-header-actions"><span id="tmdb-settings-btn" class="tmdb-icon-btn" title="设置">⚙</span><span class="tmdb-collapse-btn" title="收起/展开面板">${isCollapsed ? '+' : '−'}</span></div>
                </div>
                <div id="tmdb-settings-panel">
                    <div class="tmdb-input-group" style="margin-bottom:12px;"><label>TMDB API 密钥 (API Key)</label><input type="password" id="tmdb-api" placeholder="••••••••••••" value="${getVal('tmdb_api_key', '')}"></div>
                    <div class="tmdb-input-row" style="margin-bottom:0;">
                        <div class="tmdb-input-group"><label>悬浮提示 (Tooltip)</label><div class="tmdb-segment-control" id="tmdb-tooltip-toggle-group" style="--idx: ${initTooltipIdx};"><div class="tmdb-segment-indicator"></div><button class="tmdb-segment-btn ${isTooltipEnabled ? 'active' : ''}" data-val="1" data-idx="0">开启</button><button class="tmdb-segment-btn ${!isTooltipEnabled ? 'active' : ''}" data-val="0" data-idx="1">关闭</button></div></div>
                        <div class="tmdb-input-group"><label>显示延迟 (Delay)</label><div class="tmdb-segment-control" id="tmdb-tooltip-delay-group" style="--idx: ${initDelayIdx};"><div class="tmdb-segment-indicator"></div><button class="tmdb-segment-btn ${tooltipDelay === 0 ? 'active' : ''}" data-val="0" data-idx="0">0s</button><button class="tmdb-segment-btn ${tooltipDelay === 500 ? 'active' : ''}" data-val="500" data-idx="1">0.5s</button><button class="tmdb-segment-btn ${tooltipDelay === 1000 ? 'active' : ''}" data-val="1000" data-idx="2">1s</button><button class="tmdb-segment-btn ${tooltipDelay === 2000 ? 'active' : ''}" data-val="2000" data-idx="3">2s</button></div></div>
                    </div>
                    <div class="tmdb-input-group" style="margin-top:12px;"><label>自定义刮削过滤词库 (用逗号分隔)</label><input type="text" id="tmdb-custom-filters" placeholder="例如: v2, v3, 修正版" value="${getVal('tmdb_custom_filters', '')}"></div>
                    <div class="tmdb-input-group" style="margin-top:12px;"><label>本地批量命名 分隔符 (智能清理多余符号)</label><div class="tmdb-segment-control" id="tmdb-separator-group" style="--idx: ${initSepIdx};"><div class="tmdb-segment-indicator"></div><button class="tmdb-segment-btn ${selSep('.')}" data-val="." data-idx="0">点 (.)</button><button class="tmdb-segment-btn ${selSep(' - ')}" data-val=" - " data-idx="1">横杠 (-)</button><button class="tmdb-segment-btn ${selSep(' ')}" data-val=" " data-idx="2">空格</button></div></div>
                    <div class="tmdb-input-row" style="margin-top:12px; margin-bottom: 0;">
                        <div class="tmdb-input-group" style="flex: 1.2;"><label>日志海报 (Poster)</label><div class="tmdb-segment-control" id="tmdb-poster-size-group" style="--idx: ${initPosterIdx};"><div class="tmdb-segment-indicator"></div><button class="tmdb-segment-btn ${selPoster('sm')}" data-val="sm" data-idx="0">小</button><button class="tmdb-segment-btn ${selPoster('md')}" data-val="md" data-idx="1">中</button><button class="tmdb-segment-btn ${selPoster('lg')}" data-val="lg" data-idx="2">大</button></div></div>
                        <div class="tmdb-input-group" style="flex: 0.8;"><label>边距 (Padding)</label><div class="tmdb-segment-control" id="tmdb-panel-width-group" style="--idx: ${initWidthIdx};"><div class="tmdb-segment-indicator"></div><button class="tmdb-segment-btn ${selWidth('standard')}" data-val="standard" data-idx="0">标准</button><button class="tmdb-segment-btn ${selWidth('borderless')}" data-val="borderless" data-idx="1">无边距</button></div></div>
                    </div>
                    <div class="tmdb-input-row" style="margin-top:12px; margin-bottom: 0; align-items: flex-end;">
                        <div class="tmdb-input-group" style="flex: 2.8;"><label>面板可视高度 (Panel Height)</label><div class="tmdb-segment-control" id="tmdb-panel-height-group" style="--idx: ${initHeightIdx};"><div class="tmdb-segment-indicator"></div><button class="tmdb-segment-btn ${selHeight('standard')}" data-val="standard" data-idx="0">标准</button><button class="tmdb-segment-btn ${selHeight('tall')}" data-val="tall" data-idx="1">加长</button><button class="tmdb-segment-btn ${selHeight('max')}" data-val="max" data-idx="2">超长</button></div></div>
                        <button id="tmdb-close-settings-btn" class="tmdb-btn" style="flex: 1.2; height: 34px; padding: 0; margin-bottom: 1px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.15); color: #fff; font-size: 12px; border-radius: 10px;">收起设置</button>
                    </div>
                </div>
                <div class="tmdb-ui-body">
                    <div class="tmdb-input-row" style="margin-top: 10px;"><button id="tmdb-turbo-btn" class="tmdb-turbo-btn ${isTurbo ? 'active' : ''}" style="width:100%; padding: 12px; border-radius: 14px;" title="点击切换：开启极速模式 (直接API网络通信)"><span class="turbo-text">⚡ 极速API网络连发模式 </span></button></div>
                    <div class="tmdb-input-row" style="margin-bottom: 24px;">
                        <div class="tmdb-input-group"><label>Target Class / 目标模式</label><div class="tmdb-segment-control" id="tmdb-mode-group" style="--idx: ${initModeIdx};"><div class="tmdb-segment-indicator"></div><button class="tmdb-segment-btn ${sel('tmdb_search_mode','multi')}" data-val="multi" data-idx="0">智能</button><button class="tmdb-segment-btn ${sel('tmdb_search_mode','movie')}" data-val="movie" data-idx="1">电影</button><button class="tmdb-segment-btn ${sel('tmdb_search_mode','tv')}" data-val="tv" data-idx="2">剧集</button><button class="tmdb-segment-btn ${sel('tmdb_search_mode','collection')}" data-val="collection" data-idx="3">合集</button></div></div>
                        <div class="tmdb-input-group"><label>Typography / 命名排版</label><div class="tmdb-segment-control" id="tmdb-typography-group" style="--idx: ${initBModeIdx};"><div class="tmdb-segment-indicator"></div><button class="tmdb-segment-btn ${bSel('tmdb_brackets_mode','title_year') ? 'active' : ''}" data-val="title_year" data-idx="0">《名(年)》</button><button class="tmdb-segment-btn ${bSel('tmdb_brackets_mode','none') ? 'active' : ''}" data-val="none" data-idx="1">纯文字</button></div></div>
                    </div>
                    <div class="tmdb-btn-group" style="margin-bottom: 20px;"><button id="tmdb-start-btn" class="tmdb-btn" title="按照上方配置，对所有选中的文件进行自动搜刮并重命名">开始刮削 (Auto)</button><button id="tmdb-fix-btn" class="tmdb-btn" title="选中识别有误的项目，强制调出搜索框进行手动搜索">手动修正 (Fix)</button></div>

                    <div id="tmdb-parent-section" class="${isParentCollapsed ? 'collapsed' : ''}">
                        <div class="tmdb-parent-header" id="tmdb-parent-header-toggle" title="点击展开/收起父级关联选项"><label>Parent Series Override / 季数强制关联</label><span class="tmdb-parent-toggle-icon">▼</span></div>
                        <div class="tmdb-parent-body">

                            <div class="tmdb-input-row" style="margin-bottom: 8px;">
                                <div class="tmdb-input-group">
                                    <div class="tmdb-input-wrapper">
                                        <input type="text" id="tmdb-parent-override" placeholder="留空后台自动抓取，也可手动填写" value="${pOverrideVal}">
                                        <div class="tmdb-input-actions">
                                            <span id="tmdb-manual-search-btn" class="tmdb-action-icon" title="API识别错了？点击手动搜索并锁定结果">🔍</span>
                                            <span id="tmdb-sniff-btn" class="tmdb-action-icon" title="点击立即强制读取当前页面文件夹名">🎯</span>
                                            <span id="tmdb-clear-override" class="tmdb-clear-btn" title="一键清空">×</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div class="tmdb-btn-group" style="margin-bottom: 8px;"><button id="tmdb-parent-btn" class="tmdb-btn" style="flex: 2; padding: 10px 4px;" title="无视单独的文件名，强制所有勾选项使用上方框内的剧名进行统一刮削">⬇ 强制按父级刮削</button><button id="tmdb-prepend-btn" class="tmdb-btn" style="flex: 1; padding: 10px 4px;" title="不联网刮削，直接将上方框内的内容(加个点)作为前缀拼接到勾选项前面">➕ 加前缀</button><button id="tmdb-remove-prefix-btn" class="tmdb-btn" style="flex: 1; padding: 10px 4px;" title="移除勾选项开头的指定文字(读取上方输入框)">➖ 删前缀</button></div>

                            <div id="tmdb-meta-display" class="tmdb-meta-display">
                                <div class="tmdb-meta-item" title="中文名 (点击可编辑)"><i>CN</i> <b id="meta-cn" contenteditable="true" spellcheck="false" class="editable-meta">读取中</b></div>
                                <div class="tmdb-meta-item" title="英文名 (点击可编辑)"><i>EN</i> <b id="meta-en" contenteditable="true" spellcheck="false" class="editable-meta">读取中</b></div>
                                <div class="tmdb-meta-item tmdb-meta-yr" title="年份 (点击可编辑)"><i>YR</i> <b id="meta-year" contenteditable="true" spellcheck="false" class="editable-meta">读取中</b></div>
                            </div>

                            <div class="tmdb-input-row" style="margin-bottom: 8px; background: rgba(0,0,0,0.15); border: 1px solid rgba(255,255,255,0.05); border-radius: 12px; padding: 6px; display: flex; align-items: center; gap: 6px;">
                                <span style="font-size: 11px; color: #bf5af2; font-weight: bold; padding: 0 4px; white-space: nowrap;">DIY:</span>
                                <div style="display: flex; gap: 4px;">
                                    <span class="custom-preset-tag" data-val="HDR">HDR</span>
                                    <span class="custom-preset-tag" data-val="DV">DV</span>
                                    <span class="custom-preset-tag" data-val="60FPS">60FPS</span>
                                </div>
                                <div style="flex: 1; position: relative; display: flex; align-items: center; margin-left: 4px;">
                                    <input type="text" id="tmdb-custom-tag-input" placeholder="手动填..." value="${getVal('tmdb_custom_tag_value', '')}" style="width: 100%; min-width: 0; padding: 6px 26px 6px 10px; border-radius: 8px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.08); color: #fff; font-size: 12px; outline: none; transition: all 0.3s; box-sizing: border-box;">
                                    <span id="tmdb-clear-custom-tag" class="tmdb-clear-btn" title="清空" style="position: absolute; right: 8px; font-size: 18px;">×</span>
                                </div>
                            </div>

                            <div class="tmdb-input-row" style="margin-bottom: 8px;"><div class="tmdb-input-group"><div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;"><label style="margin:0;">DIY 排序模板 (左右拖拽排版 / 长按隐藏)</label><span id="tmdb-drag-restore" style="font-size:11px; color:var(--v-blue); cursor:pointer; transition: all 0.3s cubic-bezier(0.34, 1.2, 0.64, 1); display: inline-block;">重置</span></div><div id="tmdb-drag-container" class="tmdb-drag-container" style="margin-bottom: 6px;"></div><div style="font-size: 11px; color: var(--v-text-m); padding: 6px 10px; background: rgba(0,0,0,0.2); border-radius: 8px; border: 1px dashed rgba(255,255,255,0.1); display:flex; align-items:flex-start; gap:6px;"><span style="color: #bf5af2; font-weight: bold; white-space: nowrap;">预览: </span><span id="tmdb-drag-preview" style="color: #30d158; font-weight: 600; word-break: break-all; line-height: 1.4;"></span></div></div></div>
                            <div style="display: flex; gap: 8px; margin-bottom: 0;">
                                <button id="tmdb-select-all-btn" class="tmdb-btn" style="flex: 1; padding: 14px 4px; font-size: 12px; width: auto;" title="一键勾选当前列表的所有文件">☑ 全选</button>
                                <button id="tmdb-series-btn" class="tmdb-btn" style="flex: 1.2; padding: 14px 4px; font-size: 12px; width: auto;" title="提取剧名并自动创建一个系列文件夹，将勾选项移入其中">📁 归档系列</button>
                                <button id="tmdb-local-format-btn" class="tmdb-btn" style="flex: 1.4; padding: 14px 4px; font-size: 12px; width: auto;" title="彻底断网！提取状态栏中已就绪的中英年份信息，本地光速重命名！">📺 批量规范化</button>
                            </div>
                        </div>
                    </div>
                    <div id="tmdb-log" class="poster-${savedPoster}"><p class="log-info">System Online. <br>※ 开启⚡极速连发后，API请求间隔已从 100ms 压缩至 10ms极限速度！</p></div>
                </div>
            </div>
        `);

        
        const dragTagMap = { 'cn': '[中文]', 'en': '[英文]', 'year': '[年份]', 'se': '[SxEx]', 'ep': '[单集]', 'custom': '[DIY]', 'quality': '[画质]' };

        
        const updateDragPreview = () => {
            const previewEl = $('#tmdb-drag-preview');
            if (!previewEl) return;

            
            const dummyData = {
                'cn': '宝宝',
                'en': 'Baby',
                'year': '2026',
                'se': 'S01E01',
                'ep': '第一集',
                'custom': $('#tmdb-custom-tag-input') ? $('#tmdb-custom-tag-input').value.trim() : GM_getValue('tmdb_custom_tag_value', ''),
                'quality': '2160P'
            };

            
            const sepBtn = document.querySelector('#tmdb-separator-group .tmdb-segment-btn.active');
            const sep = sepBtn ? sepBtn.getAttribute('data-val') : GM_getValue('tmdb_separator', '.');

            
            const currentTags = Array.from($$('#tmdb-drag-container .tmdb-drag-tag:not(.deleting)')).map(el => el.dataset.id);

            let parts = [];
            currentTags.forEach(id => {
                let val = dummyData[id];
                if (val) parts.push(val);
            });

            let previewText = parts.join(sep);

            
            if (sep === '.') previewText = previewText.replace(/\.{2,}/g, '.');

            if (!previewText) previewText = '<span style="color:var(--v-text-m);font-weight:normal;">[空]</span>';
            previewEl.innerHTML = previewText;
        };

        const renderDragTags = () => {
            const container = $('#tmdb-drag-container'); if (!container) return; container.innerHTML = '';

            let currentOrder = GM_getValue('tmdb_drag_order', ['cn', 'en', 'year', 'se', 'ep', 'custom', 'quality']);
            if (!currentOrder.includes('ep')) currentOrder.push('ep');
            if (!currentOrder.includes('custom')) currentOrder.push('custom');
            GM_setValue('tmdb_drag_order', currentOrder);

            currentOrder.forEach(id => {
                if (!dragTagMap[id]) return;
                const el = document.createElement('div'); el.className = 'tmdb-drag-tag'; el.draggable = true; el.dataset.id = id; el.innerHTML = `<span>${dragTagMap[id]}</span>`;
                if (id === 'quality') el.style.color = '#5ac8fa';
                if (id === 'ep') el.style.color = '#ff9f0a';
                if (id === 'custom') el.style.color = '#bf5af2';

                let pressTimer = null; let isDragging = false;
                const startPress = (e) => {
                    if (e.button !== undefined && e.button !== 0) return;
                    isDragging = false; el.classList.add('long-pressing');
                    pressTimer = setTimeout(() => {
                        if(isDragging) return;
                        el.classList.remove('long-pressing'); el.classList.add('deleting');
                        setTimeout(() => { el.remove(); saveDragOrder(); updateDragPreview(); }, 400);
                    }, 550);
                };
                const cancelPress = () => { clearTimeout(pressTimer); el.classList.remove('long-pressing'); };
                el.addEventListener('mousedown', startPress); el.addEventListener('touchstart', startPress, {passive: true});
                el.addEventListener('mouseup', cancelPress); el.addEventListener('mouseleave', cancelPress); el.addEventListener('touchend', cancelPress);
                el.addEventListener('dragstart', (e) => { isDragging = true; cancelPress(); setTimeout(() => el.classList.add('dragging'), 0); });
                el.addEventListener('dragend', (e) => { el.classList.remove('dragging'); saveDragOrder(); updateDragPreview(); });
                container.appendChild(el);
            });
        };

        const saveDragOrder = () => {
            const currentIds = Array.from($$('#tmdb-drag-container .tmdb-drag-tag:not(.deleting)')).map(el => el.dataset.id);
            GM_setValue('tmdb_drag_order', currentIds);
        };

        const getDragAfterElement = (container, x) => {
            const draggableElements = [...container.querySelectorAll('.tmdb-drag-tag:not(.dragging):not(.deleting)')];
            return draggableElements.reduce((closest, child) => {
                const box = child.getBoundingClientRect(); const offset = x - box.left - box.width / 2;
                if (offset < 0 && offset > closest.offset) return { offset: offset, element: child }; else return closest;
            }, { offset: Number.NEGATIVE_INFINITY }).element;
        };

        renderDragTags();
        updateDragPreview(); 

        const dragContainer = $('#tmdb-drag-container');
        if (dragContainer) {
            dragContainer.addEventListener('dragover', e => {
                e.preventDefault(); const afterElement = getDragAfterElement(dragContainer, e.clientX);
                const draggedEl = document.querySelector('.tmdb-drag-tag.dragging');
                if (draggedEl) {
                    if (afterElement == null) dragContainer.appendChild(draggedEl);
                    else dragContainer.insertBefore(draggedEl, afterElement);
                    updateDragPreview(); 
                }
            });
        }
        $('#tmdb-drag-restore').onclick = (e) => {
            const btn = e.target;
            btn.style.transform = 'scale(0.8) rotate(-15deg)'; btn.style.opacity = '0.5';
            setTimeout(() => { btn.style.transform = 'scale(1) rotate(0deg)'; btn.style.opacity = '1'; }, 250);

            const container = $('#tmdb-drag-container');
            container.style.opacity = '0'; container.style.transform = 'scale(0.96)';
            setTimeout(() => {
                GM_setValue('tmdb_drag_order', ['cn', 'en', 'year', 'se', 'ep', 'custom', 'quality']);
                renderDragTags();
                updateDragPreview(); 
                container.style.opacity = '1'; container.style.transform = 'scale(1)';
            }, 250);
        };

        const tooltip = document.createElement('div'); tooltip.id = 'tmdb-custom-tooltip'; document.body.appendChild(tooltip);
        let tooltipTimeout; let globalMouseX = 0; let globalMouseY = 0;

        document.addEventListener('mousemove', e => {
            globalMouseX = e.clientX; globalMouseY = e.clientY;
            if (tooltip.classList.contains('show')) {
                let x = globalMouseX + 14; let y = globalMouseY + 14;
                if (x + tooltip.offsetWidth + 10 > window.innerWidth) x = globalMouseX - tooltip.offsetWidth - 14;
                if (y + tooltip.offsetHeight + 10 > window.innerHeight) y = globalMouseY - tooltip.offsetHeight - 14;
                tooltip.style.left = x + 'px'; tooltip.style.top = y + 'px';
            }
        });

        const attachTooltip = (el) => {
            if(el.hasAttribute('title') && el.getAttribute('title')) {
                el.setAttribute('data-tmdb-title', el.getAttribute('title')); el.removeAttribute('title');
                el.addEventListener('mouseenter', () => {
                    if (String(GM_getValue('tmdb_tooltip_enabled', 'true')) !== 'true') return;
                    clearTimeout(tooltipTimeout);
                    tooltipTimeout = setTimeout(() => {
                        tooltip.textContent = el.getAttribute('data-tmdb-title'); tooltip.classList.add('show');
                        requestAnimationFrame(() => {
                            let x = globalMouseX + 14; let y = globalMouseY + 14;
                            if (x + tooltip.offsetWidth + 10 > window.innerWidth) x = globalMouseX - tooltip.offsetWidth - 14;
                            if (y + tooltip.offsetHeight + 10 > window.innerHeight) y = globalMouseY - tooltip.offsetHeight - 14;
                            tooltip.style.left = x + 'px'; tooltip.style.top = y + 'px';
                        });
                    }, parseInt(GM_getValue('tmdb_tooltip_delay', 1000), 10));
                });
                el.addEventListener('mouseleave', () => { clearTimeout(tooltipTimeout); tooltip.classList.remove('show'); });
                el.addEventListener('click', () => { clearTimeout(tooltipTimeout); tooltip.classList.remove('show'); });
            }
        };

        $$('#tmdb-ui-container [title]').forEach(attachTooltip);

        const toggleClearBtn = () => {
            const input1 = $('#tmdb-parent-override'); const clearBtn1 = $('#tmdb-clear-override');
            if (input1 && clearBtn1) {
                if (input1.value.trim() !== '') { clearBtn1.classList.add('show'); }
                else { clearBtn1.classList.remove('show'); }
            }

            const input2 = $('#tmdb-custom-tag-input'); const clearBtn2 = $('#tmdb-clear-custom-tag');
            if (input2 && clearBtn2) {
                if (input2.value.trim() !== '') { clearBtn2.classList.add('show'); }
                else { clearBtn2.classList.remove('show'); }
            }
        };

        const titleEl = $('#tmdb-title-text');
        if (titleEl) {
            const antiTamper = new MutationObserver(() => {
                const containerEl = $('#tmdb-ui-container');
                const targetTitle = (containerEl && containerEl.classList.contains('collapsed')) ? "TMDB助手" : "TMDB助手 By宝宝 Q479874394";
                if (titleEl.textContent !== targetTitle) {
                    antiTamper.disconnect(); titleEl.textContent = targetTitle; antiTamper.observe(titleEl, { childList: true, characterData: true, subtree: true });
                }
            });
            antiTamper.observe(titleEl, { childList: true, characterData: true, subtree: true });
        }

        $('#tmdb-settings-btn').onclick = (e) => {
            e.stopPropagation(); const container = $('#tmdb-ui-container'); const btn = e.currentTarget;
            if (container.classList.contains('collapsed')) $('#tmdb-ui-header').click();
            container.classList.toggle('show-settings'); btn.classList.toggle('active');
        };

        $('#tmdb-close-settings-btn').onclick = (e) => {
            e.stopPropagation();
            $('#tmdb-ui-container').classList.remove('show-settings');
            $('#tmdb-settings-btn').classList.remove('active');
        };

        $('#tmdb-ui-header').onclick = (e) => {
            const container = $('#tmdb-ui-container'); container.classList.toggle('collapsed');
            const collapsedNow = container.classList.contains('collapsed'); GM_setValue('tmdb_ui_collapsed', collapsedNow);
            $('.tmdb-collapse-btn').textContent = collapsedNow ? '+' : '−';
            if ($('#tmdb-title-text').textContent !== (collapsedNow ? 'TMDB助手' : 'TMDB助手 By宝宝 Q479874394')) $('#tmdb-title-text').textContent = collapsedNow ? 'TMDB助手' : 'TMDB助手 By宝宝 Q479874394';
        };

        $('#tmdb-parent-header-toggle').onclick = () => {
            const sec = $('#tmdb-parent-section'); sec.classList.toggle('collapsed'); GM_setValue('tmdb_parent_ui_collapsed', sec.classList.contains('collapsed'));
        };

        $('#tmdb-turbo-btn').onclick = (e) => {
            const btn = e.currentTarget; btn.classList.toggle('active'); const turboNow = btn.classList.contains('active');
            GM_setValue('tmdb_turbo_mode', turboNow);
            addLog(turboNow ? "> ⚡ 极速连发已激活！冷却限制解除！" : "> 🐌 稳定模式开启。");
        };

        $('#tmdb-api').oninput = e => GM_setValue('tmdb_api_key', e.target.value.trim());
        $('#tmdb-custom-filters').oninput = e => { GM_setValue('tmdb_custom_filters', e.target.value.trim()); };

        
        $$('.custom-preset-tag').forEach(tag => {
            tag.onclick = () => {
                const input = $('#tmdb-custom-tag-input');
                input.value = tag.getAttribute('data-val');
                GM_setValue('tmdb_custom_tag_value', input.value);
                input.style.borderColor = '#bf5af2';
                input.style.boxShadow = '0 0 0 3px rgba(191,90,242,0.2)';
                setTimeout(() => {
                    input.style.borderColor = 'rgba(255,255,255,0.08)';
                    input.style.boxShadow = 'none';
                }, 300);
                toggleClearBtn();
                updateDragPreview(); 
            };
        });

        $('#tmdb-custom-tag-input').oninput = e => {
            GM_setValue('tmdb_custom_tag_value', e.target.value.trim());
            toggleClearBtn();
            updateDragPreview(); 
        };

        $('#tmdb-clear-custom-tag').onclick = () => {
            $('#tmdb-custom-tag-input').value = '';
            GM_setValue('tmdb_custom_tag_value', '');
            toggleClearBtn();
            updateDragPreview(); 
        };

        
        $('#tmdb-manual-search-btn').onclick = async () => {
            const key = $('#tmdb-api') ? $('#tmdb-api').value.trim() : GM_getValue('tmdb_api_key', '');
            const host = 'api.tmdb.org';
            const modeBtn = $('#tmdb-mode-group .tmdb-segment-btn.active');
            const mode = modeBtn ? modeBtn.getAttribute('data-val') : GM_getValue('tmdb_search_mode', 'multi');

            if (!key) return addLog("[WARN] 请先在设置中填写 TMDB API 密钥", "warn");

            let query = $('#tmdb-parent-override').value.trim() || autoSniffParentName() || "";
            if (!query) return addLog("[WARN] 请先在输入框内填入需要搜索的剧名或关键词！", "warn");

            addLog(`> 🔍 正在调出手动校正面板: <span style="color:var(--v-text-m)">${query}</span>`, "info");
            try {
                let tmdb = await showInteractiveModal(query, mode, key, host);
                if (tmdb && tmdb !== 'USER_STOP') {

                    let mediaType = tmdb.media_type === 'movie' ? 'movie' : 'tv';
                    let enData = await fetchAPI(`https://${host}/3/${mediaType}/${tmdb.id}?api_key=${key}&language=en-US`);
                    let engTitle = enData?.name || enData?.title || tmdb.original_name || '';
                    if (engTitle) engTitle = engTitle.replace(/[\u4e00-\u9fa5]/g, '').trim();

                    let safeCn = sanitize(tmdb.title || tmdb.name);
                    let safeEn = sanitize(engTitle);
                    let safeYr = tmdb.year && tmdb.year !== 'N/A' ? tmdb.year : '';

                    if($('#meta-cn')) $('#meta-cn').innerText = safeCn || '无';
                    if($('#meta-en')) $('#meta-en').innerText = safeEn || '无';
                    if($('#meta-year')) $('#meta-year').innerText = safeYr || '无';

                    $('#tmdb-parent-override').value = safeCn;
                    GM_setValue('tmdb_parent_override', safeCn);

                    // 核心：将手动选择的数据彻底锁定
                    TMDB_CORE.manualOverrideData = Object.assign({}, tmdb);
                    TMDB_CORE.manualOverrideData.title = safeCn;
                    TMDB_CORE.manualOverrideData.year = safeYr;

                    addLog(`> ✅ 手动校正成功，API已强行锁死为: <span style="color:#0A84FF; font-weight:bold;">${safeCn}</span>`, "info");
                    toggleClearBtn();
                }
            } catch (err) {}
        };

        let typingTimer;
        $('#tmdb-parent-override').oninput = e => {
            let val = e.target.value.trim();
            TMDB_CORE.manualOverrideData = null; // 输入框变动时，解除手动锁定
            GM_setValue('tmdb_parent_override', val);
            toggleClearBtn();
            clearTimeout(typingTimer);
            typingTimer = setTimeout(() => { updateMetaFromTMDB(val); }, 1200);
        };

        $('#tmdb-sniff-btn').onclick = async () => {
            const name = autoSniffParentName();
            if (name) {
                addLog(`> 🎯 正在通过 TMDB API 权威解析截获的目录名: <span style="color:#30d158">${name}</span>`, 'info');
                let meta = await updateMetaFromTMDB(name);
                let finalInputValue = name;

                if (meta && meta.cn) {
                    let pMatch = parseSeasonEpisode(name);
                    let sStr = '';
                    if (name.match(/[Ss]\d{1,2}/i) || name.match(/第[一二三四五六七八九十百零\d]+季/)) {
                         sStr = ` S${String(pMatch.s).padStart(2,'0')}`;
                    }
                    finalInputValue = meta.cn + sStr;
                    addLog(`> ✅ API匹配成功！已净化提取框为: <span style="color:#0A84FF">${finalInputValue}</span>`, 'info');
                } else {
                    addLog(`> ⚠️ API 匹配未找到结果，已降级回退至本地提取。`, 'warn');
                }

                $('#tmdb-parent-override').value = finalInputValue;
                GM_setValue('tmdb_parent_override', finalInputValue);
                TMDB_CORE.manualOverrideData = null; // 解除手动锁定
                toggleClearBtn();
            }
            else { addLog(`> ⚠️ 雷达嗅探失败，未检测到有效文件夹名，请手动填写。`, 'warn'); }
        };

        $('#tmdb-clear-override').onclick = () => {
            $('#tmdb-parent-override').value = '';
            GM_setValue('tmdb_parent_override', '');
            TMDB_CORE.manualOverrideData = null; // 解除手动锁定
            toggleClearBtn();
            updateStatusBarLocalFallback('');
        };

        $$('.tmdb-segment-btn').forEach(btn => {
            btn.onclick = (e) => {
                const targetBtn = e.target; const parentGroup = targetBtn.closest('.tmdb-segment-control');
                parentGroup.querySelectorAll('.tmdb-segment-btn').forEach(b => b.classList.remove('active'));
                targetBtn.classList.add('active'); parentGroup.style.setProperty('--idx', targetBtn.getAttribute('data-idx'));
                if (parentGroup.id === 'tmdb-mode-group') GM_setValue('tmdb_search_mode', targetBtn.getAttribute('data-val'));
                else if (parentGroup.id === 'tmdb-typography-group') GM_setValue('tmdb_brackets_mode', targetBtn.getAttribute('data-val'));
                else if (parentGroup.id === 'tmdb-tooltip-toggle-group') GM_setValue('tmdb_tooltip_enabled', targetBtn.getAttribute('data-val') === '1');
                else if (parentGroup.id === 'tmdb-tooltip-delay-group') GM_setValue('tmdb_tooltip_delay', parseInt(targetBtn.getAttribute('data-val'), 10));
                else if (parentGroup.id === 'tmdb-separator-group') {
                    GM_setValue('tmdb_separator', targetBtn.getAttribute('data-val'));
                    if (typeof updateDragPreview === 'function') updateDragPreview(); // 切换分隔符时更新预览
                }
                else if (parentGroup.id === 'tmdb-poster-size-group') { GM_setValue('tmdb_poster_size', targetBtn.getAttribute('data-val')); document.getElementById('tmdb-log').className = `poster-${targetBtn.getAttribute('data-val')}`; }
                else if (parentGroup.id === 'tmdb-panel-height-group') { GM_setValue('tmdb_panel_height', targetBtn.getAttribute('data-val')); const container = document.getElementById('tmdb-ui-container'); container.classList.remove('height-standard', 'height-tall', 'height-max'); container.classList.add(`height-${targetBtn.getAttribute('data-val')}`); }
                else if (parentGroup.id === 'tmdb-panel-width-group') { GM_setValue('tmdb_panel_width', targetBtn.getAttribute('data-val')); const container = document.getElementById('tmdb-ui-container'); container.classList.remove('width-standard', 'width-borderless'); container.classList.add(`width-${targetBtn.getAttribute('data-val')}`); }
            };
        });

        $$('#tmdb-ui-container input').forEach(el => { ['keydown', 'keyup', 'keypress'].forEach(evt => el.addEventListener(evt, e => e.stopPropagation())); });
        $$('.editable-meta').forEach(el => {
            ['keydown', 'keyup', 'keypress'].forEach(evt => el.addEventListener(evt, e => e.stopPropagation()));
            el.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); el.blur(); } });
            el.addEventListener('focus', e => { if (el.innerText === '无' || el.innerText === '未提取') el.innerText = ''; });
            el.addEventListener('blur', e => { if (el.innerText.trim() === '') el.innerText = '无'; });
        });

        $('#tmdb-start-btn').onclick = () => startBatchRename(false, false);
        $('#tmdb-fix-btn').onclick = () => startBatchRename(true, false);
        $('#tmdb-parent-btn').onclick = () => startBatchRename(false, true);
        $('#tmdb-prepend-btn').onclick = () => startBatchPrepend();
        $('#tmdb-remove-prefix-btn').onclick = () => startBatchRemovePrefix();
        $('#tmdb-local-format-btn').onclick = () => startLocalFormat();

        // 🌟 一键全选按钮逻辑
        $('#tmdb-select-all-btn').onclick = () => {
            const btn = $('#tmdb-select-all-btn');
            const origText = btn.innerText;
            btn.innerText = "☑ 勾选中...";

            // 核心修复：直接精确定位到选择器单元格内的 checkbox
            let targetInput = document.querySelector('div[data-slot="selectionCell"] input[type="checkbox"]');
            let targetLabel = document.querySelector('div[data-slot="selectionCell"] label');

            // 万一页面结构有变动的备用兜底方案
            if (!targetInput && !targetLabel) {
                targetInput = document.querySelector('.swangpan-file-list_header input[type="checkbox"], thead input[type="checkbox"]');
            }

            // 优先点击 Input，其次点击 Label
            if (targetInput) {
                targetInput.click();
                addLog("> ☑ 已触发：一键全选当前列表文件", "info");
            } else if (targetLabel) {
                targetLabel.click();
                addLog("> ☑ 已触发：一键全选当前列表文件", "info");
            } else {
                addLog("> ⚠️ 失败：未能识别到网页中的全选按钮，请尝试刷新网页。", "warn");
            }

            
            setTimeout(() => { btn.innerText = origText; }, 400);
        };
        
        const checkPendingTask = async () => {
            let taskStr = localStorage.getItem('tmdb_pending_series_task');
            if (!taskStr) return;
            try {
                let task = JSON.parse(taskStr);
                addLog(`> 🔄 正在执行跨页面续传任务：寻找新文件夹【${task.seriesName}】...`, "info");

                let newFolderId = null;
                for (let i = 0; i < 15; i++) {
                    await new Promise(r => setTimeout(r, 600));
                    let match = TMDB_CORE.getId(task.seriesName);
                    if (match && match.id) { newFolderId = match.id; break; }
                }

                if (newFolderId) {
                    localStorage.removeItem('tmdb_pending_series_task');
                    addLog(`> 🚀 续传捕获成功！目标ID: ${newFolderId}，执行装箱...`, "info");
                    let auth = getAuthToken();
                    const netReq = (path, payload) => new Promise((resolve, reject) => {
                        GM_xmlhttpRequest({ method: "POST", url: `https://api.guangyapan.com/userres/v1/file/${path}`, headers: { "accept": "application/json", "authorization": auth, "content-type": "application/json", "did": getDid(), "dt": TMDB_CORE.dt || "4" }, data: JSON.stringify(payload), onload: r => resolve(r.responseText), onerror: () => resolve("NetErr") });
                    });
                    try { await netReq('move', { fileIds: task.targetIds, toParentId: newFolderId }); } catch(e) { await netReq('move', { fileIds: task.targetIds, targetParentId: newFolderId }); }
                    addLog(`>> SERIES COMPLETE. 🎉 跨页面归档完美收官！清理战场...`, "info");
                    setTimeout(() => location.reload(), 1500);
                } else {
                    addLog(`[ERR] 续传超时：依然未能在字典中找到目录ID，任务终止。`, "error");
                    localStorage.removeItem('tmdb_pending_series_task');
                }
            } catch(e) { localStorage.removeItem('tmdb_pending_series_task'); }
        };
        
        setTimeout(checkPendingTask, 2000);

        
        $('#tmdb-series-btn').onclick = async () => {
            let targets = getSelectedItems();
            if (!(await checkTargetsAndThrow(targets))) return;

            let targetIds = targets.map(t => t.id); // 提前提取你要移动的文件 ID
            let parentId = "0";
            let urlMatch = location.href.match(/(?:folder|dir|path|id)[\/=](\d{15,22})/i) || location.hash.match(/(?:folder|dir|path|id)[\/=](\d{15,22})/i);
            if (urlMatch) parentId = urlMatch[1];

            let firstItemName = targets[0].domName;
            let info = extractMovieInfo(firstItemName);
            let baseTitle = info.title || firstItemName.replace(/\.[a-zA-Z0-9]+$/, '');
            baseTitle = baseTitle.replace(/[Ss]\d{1,2}.*/i, '').replace(/第[一二三四五六七八九十百零\d]+季.*/, '').trim();

            let defaultSeriesName = baseTitle ? `${baseTitle} (系列)` : "新建系列";

            // --- 🌟 核心 1：内嵌UI获取输入 ---
            const getSeriesNameFromBeautifulUI = (defaultName) => {
                return new Promise(resolve => {
                    const container = $('#tmdb-ui-container');
                    if (!container) return resolve(prompt("【归档系列】请输入系列名称：", defaultName));
                    const overlayId = 'tmdb-series-overlay';
                    let oldOverlay = $('#' + overlayId); if (oldOverlay) oldOverlay.remove();
                    const inputHtml = `<input type="text" id="tmdb-series-input" value="${defaultName}" style="width:100%; padding:14px; border-radius:12px; border:1px solid rgba(191,90,242,0.4); background:rgba(0,0,0,0.5); color:#fff; font-size:14px; outline:none; box-sizing:border-box; margin-top:16px; font-family:var(--v-font); text-align:center; box-shadow: inset 0 2px 8px rgba(0,0,0,0.4); transition: all 0.3s ease;">`;
                    container.insertAdjacentHTML('beforeend', `<div id="${overlayId}" style="position: absolute; inset: 0; z-index: 100000; background: rgba(10,10,12,0.75); backdrop-filter: blur(20px) saturate(180%); -webkit-backdrop-filter: blur(20px) saturate(180%); display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 24px; opacity: 0; transition: opacity 0.3s ease; border-radius: var(--v-rm);"><div class="tmdb-confirm-box" style="transform: scale(0.85) translateY(15px); transition: all 0.4s cubic-bezier(0.34, 1.2, 0.64, 1); width: 100%; background: rgba(30,30,34,0.9); border: 1px solid rgba(255,255,255,0.12); border-radius: 20px; padding: 24px; box-shadow: 0 24px 48px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.1);"><div style="color:#bf5af2; font-size: 36px; margin-bottom: 12px; text-align:center; filter: drop-shadow(0 4px 10px rgba(191,90,242,0.3));">📁</div><div style="color:#fff; font-size: 18px; font-weight: 700; text-align:center; letter-spacing: 0.5px;">创建归档系列</div><div>${inputHtml}</div><div style="margin-top: 24px; display: flex; gap: 12px;"><button id="tmdb-s-cancel" style="flex:1; padding:12px; border-radius:14px; border:1px solid rgba(255,255,255,0.1); background:rgba(255,255,255,0.08); color:var(--v-text-m); font-weight:600; cursor:pointer; transition: all 0.2s;">取 消</button><button id="tmdb-s-ok" style="flex:1; padding:12px; border-radius:14px; border:none; background: linear-gradient(135deg, rgba(191,90,242,0.9), rgba(10,132,255,0.9)); color:#fff; font-weight:700; cursor:pointer; box-shadow: 0 6px 20px rgba(191,90,242,0.35); transition: all 0.2s;">确 定</button></div></div></div>`);
                    const overlayEl = $('#' + overlayId); const boxEl = overlayEl.querySelector('.tmdb-confirm-box'); const inputEl = $('#tmdb-series-input');
                    void overlayEl.offsetWidth; overlayEl.style.opacity = '1'; boxEl.style.transform = 'scale(1) translateY(0)';
                    inputEl.focus(); inputEl.select();
                    inputEl.onfocus = () => { inputEl.style.borderColor = 'rgba(191,90,242,0.8)'; inputEl.style.boxShadow = '0 0 0 4px rgba(191,90,242,0.2), inset 0 2px 8px rgba(0,0,0,0.4)'; };
                    inputEl.onblur = () => { inputEl.style.borderColor = 'rgba(191,90,242,0.4)'; inputEl.style.boxShadow = 'inset 0 2px 8px rgba(0,0,0,0.4)'; };
                    $('#tmdb-s-cancel').onmouseover = function() { this.style.background = 'rgba(255,255,255,0.15)'; this.style.color = '#fff'; };
                    $('#tmdb-s-cancel').onmouseout = function() { this.style.background = 'rgba(255,255,255,0.08)'; this.style.color = 'var(--v-text-m)'; };
                    $('#tmdb-s-ok').onmouseover = function() { this.style.transform = 'scale(1.03)'; this.style.filter = 'brightness(1.1)'; };
                    $('#tmdb-s-ok').onmouseout = function() { this.style.transform = 'scale(1)'; this.style.filter = 'brightness(1)'; };
                    const closeAndResolve = (val) => { overlayEl.style.opacity = '0'; boxEl.style.transform = 'scale(0.9) translateY(10px)'; setTimeout(() => { if (overlayEl.parentNode) overlayEl.remove(); resolve(val); }, 350); };
                    $('#tmdb-s-cancel').onclick = () => closeAndResolve(null);
                    $('#tmdb-s-ok').onclick = () => { const val = inputEl.value.trim(); closeAndResolve(val ? val : null); };
                    inputEl.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); $('#tmdb-s-ok').click(); } if (e.key === 'Escape') { e.preventDefault(); $('#tmdb-s-cancel').click(); } };
                });
            };

            let seriesName = await getSeriesNameFromBeautifulUI(defaultSeriesName);
            if (!seriesName) return addLog("> 🛑 操作已取消：未输入系列名称。", "warn");

            const btn = $('#tmdb-series-btn'); let origBtnText = btn.innerText;
            btn.disabled = true; btn.innerText = "📁 底层劫持中...";

            try {
                // --- 🌟 核心 2：动态挂载底层网络劫持嗅探器 ---
                if (!window._tmdb_sniff_installed) {
                    window._tmdb_sniff_installed = true;

                    
                    window._tmdb_sniff_payload = (txt) => {
                        if (!txt || typeof txt !== 'string') return;
                        let ids = [...txt.matchAll(/["']?(?:fileId|id)["']?\s*:\s*["']?(\d{15,22})["']?/gi)].map(m => m[1]);
                        let newId = ids.find(id => id !== parentId && !targetIds.includes(id));
                        if (newId) window._tmdb_target_id = newId;
                    };

                    const _f = window.fetch;
                    if (_f) {
                        window.fetch = async function(...args) {
                            const r = await _f.apply(this, args);
                            if (window._tmdb_is_sniffing) {
                                try { r.clone().text().then(t => { window._tmdb_sniff_payload(t); }).catch(()=>{}); } catch(e){}
                            }
                            return r;
                        };
                    }
                    const _o = XMLHttpRequest.prototype.open;
                    XMLHttpRequest.prototype.open = function() {
                        this.addEventListener('load', function() {
                            if (window._tmdb_is_sniffing) {
                                try { window._tmdb_sniff_payload(this.responseText); } catch(e){}
                            }
                        });
                        _o.apply(this, arguments);
                    };
                }

                // 启动截胡雷达
                window._tmdb_target_id = null;
                window._tmdb_is_sniffing = true;

                addLog(`>> SERIES INITIATED | 启动物理注入并监听底层网络...`, "info");

                
                let newFolderBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.trim().includes('新建文件夹') || b.textContent.includes('新建文件夹'));
                if (!newFolderBtn) { let span = Array.from(document.querySelectorAll('span')).find(s => s.innerText.trim() === '新建文件夹'); if (span) newFolderBtn = span.closest('button'); }
                if (!newFolderBtn) throw new Error("物理模拟失败：页面上找不到【新建文件夹】按钮。");

                newFolderBtn.click();
                await new Promise(r => setTimeout(r, 600));

                let inputs = Array.from(document.querySelectorAll('input[type="text"]'));
                let targetInput = document.activeElement;
                if (!targetInput || targetInput.tagName !== 'INPUT') { targetInput = inputs.find(i => i.closest('.ant-table, .list, tr, .el-table') && !i.disabled) || inputs[inputs.length - 1]; }
                if (!targetInput) throw new Error("未能捕获网页输入框。");

                
                let nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
                if (nativeInputValueSetter) { nativeInputValueSetter.call(targetInput, seriesName); } else { targetInput.value = seriesName; }

                targetInput.dispatchEvent(new Event('input', { bubbles: true })); targetInput.dispatchEvent(new Event('change', { bubbles: true }));
                await new Promise(r => setTimeout(r, 200));

                
                targetInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
                let confirmBtn = targetInput.closest('td, div, .row, .list-item')?.querySelector('.anticon-check, .el-icon-check')?.closest('button') || targetInput.parentElement.nextElementSibling?.querySelector('button');
                if (confirmBtn) confirmBtn.click();

                addLog(`> ⌨️ 名称注入完成，正在半路截胡服务器发回的 ID...`, "info");

                
                let newFolderId = null;
                for (let i = 0; i < 20; i++) {
                    await new Promise(r => setTimeout(r, 250)); // 0.25秒嗅探一次，最多等 5 秒
                    if (window._tmdb_target_id) {
                        newFolderId = window._tmdb_target_id;
                        break;
                    }
                }

                
                window._tmdb_is_sniffing = false;

                if (!newFolderId) throw new Error("网盘服务器响应超时，未能截获新目录 ID，请重试。");

                addLog(`> 🚀 截胡成功！从底层提取到新目录 ID: <span style="color:#30d158">${newFolderId}</span>，开始暴力装箱！`, "info");

                // --- 🌟 核心 5：拿着截获的 ID 直接发送底层移动数据包 ---
                let auth = getAuthToken();
                if (!auth) throw new Error("缺少网络通行令牌 (Token)。");

                const netReq = (path, payload) => new Promise((resolve, reject) => { GM_xmlhttpRequest({ method: "POST", url: `https://api.guangyapan.com/userres/v1/file/${path}`, headers: { "accept": "application/json", "authorization": auth, "content-type": "application/json", "did": getDid(), "dt": TMDB_CORE.dt || "4" }, data: JSON.stringify(payload), onload: r => resolve(r.responseText), onerror: () => reject("Network Error") }); });

                // 穷举移动接口包
                let moveSuccess = false;
                try {
                    let res = await netReq('move', { fileIds: targetIds, toParentId: newFolderId });
                    if (res.includes('"code":0') || res.includes('"success":true')) moveSuccess = true;
                } catch(e) {}

                if (!moveSuccess) {
                    try { await netReq('move', { fileIds: targetIds, targetParentId: newFolderId }); } catch(e) {}
                }

                addLog(`>> SERIES COMPLETE. 🎉 暴力归档大满贯！正在刷新界面...`, "info");
                await refreshWebpageUI();

            } catch (err) {
                window._tmdb_is_sniffing = false; // 报错时也要确保关闭雷达
                addLog(`[ERR] 系列归档失败: ${err.message || err}`, "error");
            } finally {
                btn.disabled = false; btn.innerText = origBtnText;
            }
        };

        toggleClearBtn();
        updateMetaFromTMDB($('#tmdb-parent-override').value.trim() || autoSniffParentName());

        let lastDetectedFolder = autoSniffParentName();
        setInterval(async () => {
            let currentFolder = autoSniffParentName();
            if (currentFolder && currentFolder !== lastDetectedFolder) {
                lastDetectedFolder = currentFolder;
                let meta = await updateMetaFromTMDB(currentFolder);
                let finalInputValue = currentFolder;

                if (meta && meta.cn) {
                    let pMatch = parseSeasonEpisode(currentFolder);
                    let sStr = '';
                    if (currentFolder.match(/[Ss]\d{1,2}/i) || currentFolder.match(/第[一二三四五六七八九十百零\d]+季/)) {
                         sStr = ` S${String(pMatch.s).padStart(2,'0')}`;
                    }
                    finalInputValue = meta.cn + sStr;
                }

                $('#tmdb-parent-override').value = finalInputValue;
                GM_setValue('tmdb_parent_override', finalInputValue);
                TMDB_CORE.manualOverrideData = null; // 目录变动，解除手动锁定
                toggleClearBtn();
            }
        }, 500);
    }

    
    function getSelectedItems() {
        let isSelectAll = false;
        let declaredCount = 0;

        
        let countTextNodes = Array.from(document.querySelectorAll('span, div, p, label')).filter(el => el.children.length === 0 && /已选[中择]?\s*\d+\s*[项个文件]/.test(el.innerText));
        if (countTextNodes.length > 0) {
            let m = countTextNodes[0].innerText.match(/已选[中择]?\s*(\d+)\s*[项个文件]/);
            if (m) declaredCount = parseInt(m[1], 10);
        }

        
        let topCb = document.querySelector('thead input[type="checkbox"], th input[type="checkbox"], .check-all, .ant-table-selection-column input[type="checkbox"], .el-table__header-wrapper .el-checkbox__original');
        if (topCb && (topCb.checked || topCb.closest('.is-checked') || topCb.closest('.ant-checkbox-checked') || topCb.closest('.checked'))) {
            isSelectAll = true;
        }
        if (document.querySelector('thead .is-checked, th .is-checked, thead .ant-checkbox-checked, th .ant-checkbox-checked')) {
            isSelectAll = true;
        }

        
        let allCheckboxes = Array.from(document.querySelectorAll('input[type="checkbox"], [class*="checkbox"], [role="checkbox"]'));
        let checkedBoxes = allCheckboxes.filter(cb => {
            if (cb === topCb || cb.closest('thead') || cb.closest('th') || (cb.className && typeof cb.className === 'string' && cb.className.includes('check-all'))) return false;
            return cb.checked ||
                   (cb.parentElement && /checked|is-checked|active/i.test(cb.parentElement.className)) ||
                   (cb.closest('[class*="checkbox"]') && /checked|is-checked|active/i.test(cb.closest('[class*="checkbox"]').className)) ||
                   cb.getAttribute('aria-checked') === 'true';
        });

        let results = [];

        
        if (isSelectAll || (declaredCount > 0 && declaredCount > checkedBoxes.length)) {
            addLog(`> 🚨 检测到【前端虚拟滚动拦截】！可视选中: ${checkedBoxes.length}，实际选中: ${declaredCount || '全部'}。已强行绕过前端，直接从上帝字典提取当前目录的 ${TMDB_CORE.fileMap.size} 个文件！`, "info");
            for (let [name, id] of TMDB_CORE.fileMap.entries()) {
                if (/\.[a-z0-9]{2,8}$/i.test(name)) {
                    results.push({ id: id, name: name, domName: name });
                }
            }
            return results.filter((item, index, self) => item && item.id && index === self.findIndex((t) => t.domName === item.domName));
        }

        
        for (let cb of checkedBoxes) {
            let row = cb.closest('tr, [class*="row"], [class*="item"], .list-item');
            if (!row) continue;

            let nameRaw = "";
            let titleNode = row.querySelector('[title]');
            if (titleNode && titleNode.getAttribute('title').trim() !== '') {
                nameRaw = titleNode.getAttribute('title');
            } else {
                let nameEl = Array.from(row.querySelectorAll('*')).find(el => el.children.length === 0 && /\.[a-z0-9]{2,8}$/i.test(el.textContent.trim()));
                if (nameEl) nameRaw = nameEl.textContent.trim();
            }

            if (!nameRaw) {
                let m = row.textContent.match(/([^\s\n\r]+?\.(?:mkv|mp4|avi|ts|rmvb|flv|wmv|iso|ass|srt|sup|rm|mov))/i);
                if (m) nameRaw = m[1].trim();
            }

            if (!nameRaw) {
                let rowText = row.textContent;
                for (let [dictName] of TMDB_CORE.fileMap.entries()) {
                    if (rowText.includes(dictName)) { nameRaw = dictName; break; }
                }
            }

            if (!nameRaw) continue;

            let fileId = "";
            let match = TMDB_CORE.getId(nameRaw);
            if (match) {
                fileId = match.id;
                nameRaw = match.fullName;
            }

            if (!fileId) {
                let htmlStr = row.outerHTML;
                let idMatch = htmlStr.match(/["']?(?:fileId|file_id|rowKey|id)["']?\s*[:=]\s*["']?(\d{15,22})["']?/i) || htmlStr.match(/data-row-key=["']?(\d{15,22})["']?/i);
                if (idMatch) fileId = idMatch[1];
            }

            results.push({ id: fileId || '', domName: nameRaw.trim() });
        }

        return results.filter((item, index, self) => item && item.id && index === self.findIndex((t) => t.domName === item.domName));
    }

    async function checkTargetsAndThrow(targets) {
        if (!targets.length) {
            addLog("[WARN] 没有找到选中的文件。", "warn");
            return false;
        }
        let missingIds = targets.filter(t => !t.id);
        if (missingIds.length > 0) {
            addLog(`[ERR] 🚨 致命错误：获取不到 ${missingIds.length} 个文件的核心 ID！<br><b>👉 终极解决办法：请按键盘 F5 刷新本网页一次！</b><br>刷新后脚本将瞬间拦截官方数据字典，即可完美全选！`, "error");
            return false;
        }
        return true;
    }

    async function refreshWebpageUI() {
        let refreshBtns = Array.from(document.querySelectorAll('span, button, a, i, div')).filter(el => {
            let cls = el.className || ''; let txt = el.innerText || '';
            return cls.includes('refresh') || cls.includes('reload') || txt.includes('刷新') || txt.includes('↻');
        });
        if (refreshBtns.length > 0) {
            try { refreshBtns[0].click(); } catch(e){}
        } else {
            setTimeout(() => { location.reload(); }, 2000);
        }
    }

    async function executeRenameRouter(targetItem, newName, isTurbo) {
        if (targetItem.domName === newName) return;

        let auth = getAuthToken();
        if (!auth) {
            addLog(`> ❌ 致命错误：未获取到当前账号 Token，请按 F5 刷新网页。`, "error");
            throw "Token 丢失";
        }

        let win = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
        let officialRename = typeof win.fs_rename === 'function' ? win.fs_rename : (win.api && typeof win.api.fs_rename === 'function' ? win.api.fs_rename : null);
        let apiSuccess = false;

        if (officialRename) {
            try { await officialRename(targetItem.id, newName); apiSuccess = true; } catch(e) {}
        }

        if (!apiSuccess) {
            try {
                const res = await new Promise((resolve, reject) => {
                    GM_xmlhttpRequest({
                        method: "POST", url: "https://api.guangyapan.com/userres/v1/file/rename",
                        headers: { "accept": "application/json", "authorization": auth, "content-type": "application/json", "did": getDid(), "dt": TMDB_CORE.dt || "4" },
                        data: JSON.stringify({ fileId: String(targetItem.id), newName: newName }),
                        onload: function(r) {
                            if (r.status === 200) {
                                try {
                                    let j = JSON.parse(r.responseText);
                                    if (j.code == 0 || j.code == 200 || j.msg === 'success' || j.message === 'success' || j.success) {
                                        resolve(true);
                                    } else {
                                        reject(j.msg || j.message || "接口拒绝");
                                    }
                                } catch(e) { reject("解析失败"); }
                            } else reject("HTTP " + r.status);
                        },
                        onerror: function() { reject("网络断开"); }
                    });
                });
                apiSuccess = res;
            } catch(e) {
                addLog(`> ⚠️ 发包被拒: ${e} (${targetItem.domName})`, "warn");
                throw "API 被阻断";
            }
        }

        
        await delay(isTurbo ? 10 : 200);
    }

    const fetchAPI = (url) => new Promise((res, rej) => GM_xmlhttpRequest({ method: "GET", url, onload: r => res(r.status===200 ? JSON.parse(r.responseText) : null), onerror: () => rej("Net Error") }));

    function convertToSimplified(text) {
        if (!text) return Promise.resolve(text);
        return new Promise(resolve => {
            GM_xmlhttpRequest({ method: "POST", url: "https://api.zhconvert.org/convert", headers: { "Content-Type": "application/json" }, data: JSON.stringify({ text: text, converter: "Simplified" }), onload: r => { try { let res = JSON.parse(r.responseText); resolve((res.code === 0 && res.data && res.data.text) ? res.data.text : text); } catch(e) { resolve(text); } }, onerror: () => resolve(text) });
        });
    }

    async function fetchTmdbData(query, year, expected, mode, key, host) {
        let ep = mode === 'multi' ? 'multi' : mode;
        const doSearch = lang => fetchAPI(`https://${host}/3/search/${ep}?api_key=${key}&language=${lang}&query=${encodeURIComponent(query)}&page=1`);
        let data = await doSearch('zh-CN'); let results = data?.results || [];

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
            id: r.id, title: r.title || r.name || 'Unknown', original_name: r.original_title || r.original_name || '',
            year: (r.release_date || r.first_air_date || '').substring(0, 4) || 'N/A', media_type: r.media_type || (mode !== 'multi' ? mode : 'unknown'), poster: r.poster_path ? `https://image.tmdb.org/t/p/w154${r.poster_path}` : ''
        })).sort((a, b) => { let sA = (expected !== 'unknown' && a.media_type === expected ? 100 : 0) + (year && a.year === year ? 50 : 0); let sB = (expected !== 'unknown' && b.media_type === expected ? 100 : 0) + (year && b.year === year ? 50 : 0); return sB - sA; });
    }

    function extractMovieInfo(rawName) {
        let ext = ''; let nameWithoutExt = rawName;
        let extMatch = rawName.match(/(\.(?!\d+[KMG]B)[a-z0-9]{2,6})$/i);
        if (extMatch && !/^\.\d+$/.test(extMatch[1])) { ext = extMatch[1]; nameWithoutExt = rawName.slice(0, -ext.length); }

        let rawType = 'unknown';
        if (/(剧集|第[一二三四五六七八九十\d]+季|S\d{1,2}|E\d{1,3}|EP\d+|全\d+集)/i.test(nameWithoutExt)) { rawType = 'tv'; } else if (/(电影|Movie)/i.test(nameWithoutExt)) { rawType = 'movie'; }
        let clean = nameWithoutExt.replace(/\s*[-_]?\s*文件夹.*$/i, '').replace(/\s+\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}.*$/i, '');
        let parsedSE = parseSeasonEpisode(clean); let type = rawType !== 'unknown' ? rawType : (parsedSE.e !== null ? 'tv' : 'unknown');
        let yMatches = [...clean.matchAll(/(?:(?<=[\(\[\{\.\s_-])|^)(19[0-9]{2}|20[0-2][0-9])(?:(?=[\)\]\}\.\s_-])|$)/g)]; let year = yMatches.length > 0 ? yMatches[yMatches.length - 1][1] : '';

        let work = clean.replace(/\{tmdbid-\d+\}/i, '');
        work = work.replace(/\b\d{4}-\d{2}-\d{2}\b/g, ' ');
        work = work.replace(/^\d{1,3}(?:\.|、|-|\s)+(?=[\u4e00-\u9fa5a-zA-Z])/i, '');
        let noBracket = work.replace(/[【\[［].*?[\]】］]/g, ' ');
        if (noBracket.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '').trim().length > 0) { work = noBracket; } work = work.replace(/[\._]/g, ' ');

        let customFiltersStr = GM_getValue('tmdb_custom_filters', '');
        if (customFiltersStr) { let customTags = customFiltersStr.split(/[,，|]+/).map(s => s.trim()).filter(Boolean).map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')); if (customTags.length > 0) { let customRegex = new RegExp('(' + customTags.join('|') + ')', 'ig'); work = work.replace(customRegex, ' '); } }

        let engTags = /(?:^|[\.\-\s_\[\(【])(1080p|1080i|2160p|720p|480p|4k|8k|UHD|BluRay|WEB-DL|WEB|WEBRip|HDTV|Remux|x264|x265|H264|H265|HEVC|AVC|DTS-HD|DTS|TrueHD|Atmos|Dolby|AAC|AC3|DDP\d*\.?\d*|FLAC|APE|\d+fps|HDR\d*|10bit|DoVi|DV|HKG|CHS|CHT|ENG|DreamHD|ColorWEB|BlackTV|SSDSSE|BBQDDQ|BBEDDE|PTHDTV|QQHDTV|DDHDTV|S-ParkL|S-CTRLHD|QuickIO|Repack|AMZN|Amazon|NF|Netflix|Disney\+|AppleTV|Hulu)(?:[\.\-\s_\]\)】]|$)/i;
        let cnTags = /(国配|粤配|台配|国语|粤语|中配|双配|双语|多音轨|中字|简繁|特效字幕|无删减|未删减|原盘|\d+帧|高码|杜比|完整版|收藏版|加长版|导演剪辑版|版本|双版本|全\d+集)/i;

        let minIndex = work.length; let matchEng = work.match(engTags); if (matchEng) minIndex = Math.min(minIndex, matchEng.index); let matchCn = work.match(cnTags); if (matchCn) minIndex = Math.min(minIndex, matchCn.index); work = work.substring(0, minIndex);

        let title = work; title = title.replace(/\bS\d{1,2}\b.*|第.*?[季集].*|全.*?集.*|系列/ig, ''); title = title.replace(/[《》\(\)\{\}（）]/g, ' ').replace(/[-+]+$/, '').trim(); if (year) title = title.replace(new RegExp(`(^|\\s)${year}(?=\\s|$)`, 'g'), ' '); title = title.replace(/\s{2,}/g, ' ').trim();

        return { title, year, type, season: parsedSE.s ? `S${String(parsedSE.s).padStart(2,'0')}` : '', seasonNum: parsedSE.s, extension: ext };
    }

    async function updateMetaFromTMDB(query) {
        if (!query) { updateStatusBarLocalFallback(''); return null; }
        const key = $('#tmdb-api') ? $('#tmdb-api').value.trim() : GM_getValue('tmdb_api_key', '');
        const host = 'api.tmdb.org';
        const modeBtn = $('#tmdb-mode-group .tmdb-segment-btn.active');
        const mode = modeBtn ? modeBtn.getAttribute('data-val') : GM_getValue('tmdb_search_mode', 'multi');

        if (!key) { updateStatusBarLocalFallback(query); return null; }

        if($('#meta-cn')) $('#meta-cn').innerText = '检索API...';
        if($('#meta-en')) $('#meta-en').innerText = '...';
        if($('#meta-year')) $('#meta-year').innerText = '...';

        try {
            let searchTitle = query; let searchYear = "";
            let yearMatch = query.match(/(?:[\s\-_]*\(?(\d{4})\)?\s*)$/);
            if (yearMatch && yearMatch.index > 0) { searchYear = yearMatch[1]; searchTitle = query.substring(0, yearMatch.index).trim(); }
            searchTitle = searchTitle.replace(/[Ss]\d{1,2}.*/i, '').replace(/第[一二三四五六七八九十百零\d]+季.*/, '').trim();

            let results = await fetchTmdbData(searchTitle, searchYear, "unknown", mode, key, host);
            if (!results.length && searchYear) { results = await fetchTmdbData(searchTitle, "", "unknown", mode, key, host); }
            if (!results.length) { results = await fetchTmdbData(query.replace(/[Ss]\d{1,2}.*/i, '').trim(), "", "unknown", mode, key, host); }

            if (results && results.length > 0) {
                let best = results[0]; let mediaType = best.media_type === 'movie' ? 'movie' : 'tv';
                let enData = await fetchAPI(`https://${host}/3/${mediaType}/${best.id}?api_key=${key}&language=en-US`);
                let engTitle = enData?.name || enData?.title || best.original_name || '';

                if (engTitle) engTitle = engTitle.replace(/[\u4e00-\u9fa5]/g, '').trim();

                let safeCn = sanitize(best.title); let safeEn = sanitize(engTitle); let safeYr = best.year && best.year !== 'N/A' ? best.year : '';

                if($('#meta-cn')) $('#meta-cn').innerText = safeCn || '无';
                if($('#meta-en')) $('#meta-en').innerText = safeEn || '无';
                if($('#meta-year')) $('#meta-year').innerText = safeYr || '无';
                return { cn: safeCn, en: safeEn, year: safeYr };
            } else { updateStatusBarLocalFallback(query); return null; }
        } catch(e) { updateStatusBarLocalFallback(query); return null; }
    }

    function updateStatusBarLocalFallback(text) {
        if (!text) {
            if($('#meta-cn')) $('#meta-cn').innerText = '未提取'; if($('#meta-en')) $('#meta-en').innerText = '未提取'; if($('#meta-year')) $('#meta-year').innerText = '未提取';
            return;
        }
        let info = extractMovieInfo(text); let cn = info.title || '无'; let yr = info.year || '无'; let en = '无';
        let noExtClean = text.replace(/\.[a-zA-Z0-9]+$/, '').replace(/[Ss]\d{1,2}[.\-_ ]?[Ee]\d{1,4}.*/i, '').replace(/[\u4e00-\u9fa5]/g, ' ').replace(/(?:19|20)\d{2}/g, ' ').replace(/(?:1080p|2160p|720p|480p|4k|8k|UHD|BluRay|WEB-DL|WEB|WEBRip|HDTV|Remux|x264|x265|H264|H265|HEVC|AVC|DTS-HD|DTS|TrueHD|Atmos|Dolby|AAC|AC3|DDP\d*\.?\d*|HDR10\+|HDR|DoVi|10bit|REPACK|PROPER|MARK|cKTV)/gi, ' ');
        let parsedEn = noExtClean.replace(/[\.\-_]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
        if (parsedEn) en = parsedEn;

        if($('#meta-cn')) $('#meta-cn').innerText = cn; if($('#meta-en')) $('#meta-en').innerText = en; if($('#meta-year')) $('#meta-year').innerText = yr;
    }

    function autoSniffParentName() {
        let candidateTexts = []; let uiContainer = document.querySelector('#tmdb-ui-container');
        const getDirectText = (el) => { let t = el.getAttribute('title') || ""; if (!t) t = el.innerText || el.textContent || ""; return t.trim(); };
        let breadcrumbs = document.querySelectorAll('[class*="breadcrumb"] span, [class*="breadcrumb"] a, [class*="nav-path"] span, [class*="mbx"] a, [class*="mbx"] span, [class*="path"] span, .ant-breadcrumb-link, .el-breadcrumb__inner');
        Array.from(breadcrumbs).forEach(el => { if (uiContainer && uiContainer.contains(el)) return; let t = getDirectText(el); if (t) candidateTexts.push(t); });
        let allNodes = document.querySelectorAll('span, a, div, h1, h2, h3, li, p');
        Array.from(allNodes).forEach(el => {
            if (uiContainer && uiContainer.contains(el)) return;
            if (el.children.length === 0 || el.tagName === 'A' || el.tagName === 'SPAN') { let t = getDirectText(el); if (t.includes('{tmdbid-')) candidateTexts.push(t); }
        });
        if (document.title) candidateTexts.push(document.title);

        const isGarbage = (str) => {
            if (!str || str.length > 80) return true;
            if (/^(文件|全部文件|全部|首页|资源|我的资源|测试|新建文件夹|TMDB助手|Target Class|Typography|System Online|返回上一级)$/i.test(str)) return true;
            if (/(云盘|网盘|广雅盘|光腾云盘|云添加|来自：|雷达嗅探|大小|修改时间|文件名称|类型|已选择|文件夹大小|序列号|TMDB API|⚠️|➔)/i.test(str)) return true;
            return false;
        };

        for (let i = candidateTexts.length - 1; i >= 0; i--) {
            let text = candidateTexts[i]; if (!text) continue;
            if (text.includes('>')) text = text.split('>').pop();
            if (text.includes('/')) { if (/(文件|云盘|资源)/.test(text)) text = text.split('/').pop(); }
            text = text.trim();
            if (isGarbage(text)) continue;
            let cleanInfo = extractMovieInfo(text); let finalTitle = cleanInfo.title.replace(/[（\(]\s*[）\)]/g, '').trim();
            if (finalTitle && finalTitle.length >= 1 && !/^(S\d{1,2}|第[一二三四五六七八九十\d]+[季集]|Season\s*\d+)$/i.test(finalTitle)) return finalTitle;
        }
        return null;
    }

    async function startBatchRename(forceManual = false, forceParent = false) {
        const key = $('#tmdb-api').value.trim(); const host = 'api.tmdb.org';
        const modeBtn = $('#tmdb-mode-group .tmdb-segment-btn.active'); const mode = modeBtn ? modeBtn.getAttribute('data-val') : 'multi';
        const bModeBtn = $('#tmdb-typography-group .tmdb-segment-btn.active'); const bMode = bModeBtn ? bModeBtn.getAttribute('data-val') : 'title_year';
        const isTurbo = GM_getValue('tmdb_turbo_mode', false);

        if (!key) return addLog("[ERR] Missing TMDB API Key.", "error");

        let targets = getSelectedItems();
        if (!(await checkTargetsAndThrow(targets))) return;

        const btnAuto = $('#tmdb-start-btn'); const btnFix = $('#tmdb-fix-btn'); const btnParent = $('#tmdb-parent-btn');
        btnAuto.disabled = true; btnFix.disabled = true; btnParent.disabled = true;
        const activeBtn = forceParent ? btnParent : (forceManual ? btnFix : btnAuto); let origBtnText = activeBtn.innerText;

        addLog(`>> SEQUENCE INITIATED | Targets: ${targets.length} ${isTurbo ? '⚡[极限连发开启]' : ''}`, "info");

        let overrideStr = $('#tmdb-parent-override').value.trim(); let cachedParentTmdbData = null;

        for (let i = 0; i < targets.length; i++) {
            let targetItem = targets[i]; activeBtn.innerText = `Executing (${i+1}/${targets.length})`;
            try {
                let info = extractMovieInfo(targetItem.domName);
                let tempTitle = info.title.replace(/[\s\(\)\[\]]/g, ''); let isIsolatedSeason = /^(season|s|第.*?季|季)$/i.test(tempTitle) || tempTitle === ''; let shouldUseParent = forceParent || isIsolatedSeason;

                if (shouldUseParent) {
                    if (!overrideStr) {
                        let sniffedName = autoSniffParentName();
                        if (sniffedName) {
                            overrideStr = sniffedName; $('#tmdb-parent-override').value = overrideStr; GM_setValue('tmdb_parent_override', overrideStr);
                            toggleClearBtn();
                            addLog(`> 🤖 自动嗅探到页面文件夹名: <span style="color:#30d158">${overrideStr}</span>`, 'info');
                        } else {
                            if (forceParent) { addLog(`[ERR] 强制刮削失败：无法自动嗅探到有效文件夹名，请手动填写！`, 'error'); break; }
                            else { addLog(`[WARN] 孤立季数未嗅探到父级剧名，跳过。`, 'warn'); continue; }
                        }
                    }
                    let overrideInfo = extractMovieInfo(overrideStr); info.title = overrideInfo.title; if (overrideInfo.year) info.year = overrideInfo.year; info.type = 'tv';
                }

                let searchMode = mode; if (mode === 'multi') { if (info.type === 'tv') searchMode = 'tv'; else if (info.type === 'movie') searchMode = 'movie'; }
                if (mode === 'movie') { info.season = ''; info.seasonNum = null; }
                let sStr = info.season; if (info.seasonNum !== null) sStr = `S${String(info.seasonNum).padStart(2, '0')}`;

                addLog(`> 提取: <span style="color:var(--v-text-m)">${info.title} ${info.year ? '['+info.year+']' : ''} <span style="color:#0A84FF;font-size:11px;">[路由:${searchMode}]</span></span>`);
                let tmdb = null;

                if (shouldUseParent) {
                    if (cachedParentTmdbData) { tmdb = Object.assign({}, cachedParentTmdbData); }
                    else if (TMDB_CORE.manualOverrideData) {
                        tmdb = Object.assign({}, TMDB_CORE.manualOverrideData);
                        cachedParentTmdbData = Object.assign({}, tmdb);
                    }
                    else {
                        let results = await fetchTmdbData(info.title, info.year, info.type, searchMode, key, host);
                        tmdb = results.length ? results[0] : await showInteractiveModal(info.title, searchMode, key, host);
                        if (tmdb) cachedParentTmdbData = Object.assign({}, tmdb);
                    }
                } else {
                    if (forceManual) { tmdb = await showInteractiveModal(info.title, searchMode, key, host); }
                    else { let results = await fetchTmdbData(info.title, info.year, info.type, searchMode, key, host); tmdb = results.length ? results[0] : await showInteractiveModal(info.title, searchMode, key, host); }
                }

                if (!tmdb) { addLog(`> Skipped.`); continue; }

                if (tmdb.media_type === 'tv' || searchMode === 'tv') {
                    if (info.seasonNum === null) info.seasonNum = 1;
                    if (!shouldUseParent) {
                        let tvData = await fetchAPI(`https://${host}/3/tv/${tmdb.id}/season/${info.seasonNum}?api_key=${key}&language=zh-CN`);
                        if (tvData?.air_date) tmdb.year = tvData.air_date.substring(0, 4);
                    }
                }

                sStr = ''; if (info.seasonNum !== null && tmdb.media_type !== 'collection' && tmdb.media_type !== 'movie') { sStr = `S${String(info.seasonNum).padStart(2, '0')}`; }

                let safeTitle = sanitize(tmdb.title); let yPart = tmdb.year && tmdb.year !== 'N/A' ? ` (${tmdb.year})` : '';
                let base = mode === 'collection' || tmdb.media_type === 'collection' ? (bMode === 'none' ? safeTitle : `《${safeTitle}》`) : (bMode === 'title_only' ? `《${safeTitle}》${yPart}` : (bMode === 'title_year' ? (yPart?`《${safeTitle}${yPart}》`:`《${safeTitle}》`) : `${safeTitle}${yPart}`));
                let newName = `${base} ${sStr ? sStr+' ' : ''}{tmdbid-${tmdb.id}}`.replace(/\s+/g, ' ').replace(' {tmdbid', '{tmdbid').trim(); newName += info.extension; let finalName = sanitize(newName);

                if (targetItem.domName !== finalName) {
                    await executeRenameRouter(targetItem, finalName, isTurbo);
                }

                let posterSrc = tmdb.poster || "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='60' height='90'><rect width='60' height='90' fill='%23222'/></svg>";
                addLog(`
                    <div class="log-item-visual">
                        <img class="log-poster" src="${posterSrc}" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'60\\' height=\\'90\\'><rect width=\\'60\\' height=\\'90\\' fill=\\'%23222\\'/></svg>'" />
                        <div class="log-details"><span class="log-old">${targetItem.domName}</span><span class="log-new">➔ ${finalName}</span></div>
                    </div>
                `, 'raw');
            } catch (err) { if (err === 'USER_STOP') { addLog(`[ABORT] Pipeline halted.`, "error"); break; } addLog(`[ERR] ${err.message || err}`, "error"); await new Promise(r => setTimeout(r, 1000)); }
        }
        addLog(`>> SEQUENCE COMPLETE. 🚀 正在为您刷新页面显示...`, "info");
        await refreshWebpageUI();
        btnAuto.disabled = false; btnFix.disabled = false; btnParent.disabled = false; activeBtn.innerText = origBtnText;
    }

    async function startBatchPrepend() {
        const isTurbo = GM_getValue('tmdb_turbo_mode', false); let prefix = $('#tmdb-parent-override').value.trim(); let sniffedName = autoSniffParentName();

        if (!prefix) {
            if (sniffedName) { prefix = sniffedName; $('#tmdb-parent-override').value = prefix; GM_setValue('tmdb_parent_override', prefix); toggleClearBtn(); addLog(`> 🤖 自动提取到了前缀: <span style="color:#30d158">${prefix}</span>`, 'info'); }
            else { return addLog("[WARN] 输入框为空，且未能自动识别到当前页面文件夹名，请手动填写你要加的前缀。", "warn"); }
        } else {
            if (sniffedName && prefix !== sniffedName) {
                let loosePrefix = prefix.replace(/\s+/g, '').toLowerCase(); let looseSniff = sniffedName.replace(/\s+/g, '').toLowerCase();
                if (!looseSniff.includes(loosePrefix) && !loosePrefix.includes(looseSniff)) {
                    let confirmProceed = await showPanelConfirm("拦截：检测到名称不匹配", `当前强制关联框：<span style="color:#bf5af2; font-weight:700;">【${prefix}】</span><br><br>页面文件夹名：<span style="color:#30d158; font-weight:700;">【${sniffedName}】</span><br><br>确认要无视页面名称，强制使用上方的前缀吗？`);
                    if (!confirmProceed) return addLog("> 🛑 操作已取消：用户终止了加前缀任务。", "warn");
                }
            }
        }

        let targets = getSelectedItems();
        if (!(await checkTargetsAndThrow(targets))) return;

        const btn = $('#tmdb-prepend-btn'); let origBtnText = btn.innerText; btn.disabled = true;

        addLog(`>> PREPEND SEQUENCE INITIATED | 准备给 ${targets.length} 个文件加前缀 ${isTurbo ? '⚡[极限连发]' : ''}`, "info");

        for (let i = 0; i < targets.length; i++) {
            let targetItem = targets[i]; btn.innerText = `加前缀 (${i+1}/${targets.length})`;
            try {
                let oldName = targetItem.domName;
                if (oldName.startsWith(prefix)) { addLog(`> 包含前缀，自动跳过: <span style="color:var(--v-text-m)">${oldName}</span>`); continue; }
                let newName = `${prefix}.${oldName}`; newName = newName.replace(/\.{2,}/g, '.');

                if (oldName !== newName) { await executeRenameRouter(targetItem, newName, isTurbo); }

                addLog(`
                    <div class="log-item-visual" style="background:rgba(191,90,242,0.1); border-color:rgba(191,90,242,0.3);">
                        <div class="log-details"><span class="log-old">${oldName}</span><span class="log-new" style="color:#bf5af2;">➔ ${newName}</span></div>
                    </div>
                `, 'raw');
            } catch (err) { addLog(`[ERR] ${err.message || err}`, "error"); await new Promise(r => setTimeout(r, 1000)); }
        }
        addLog(`>> PREPEND SEQUENCE COMPLETE. 加前缀任务完成。🚀 刷新页面...`, "info");
        await refreshWebpageUI();
        btn.disabled = false; btn.innerText = origBtnText;
    }

    async function startBatchRemovePrefix() {
        const isTurbo = GM_getValue('tmdb_turbo_mode', false); let prefix = $('#tmdb-parent-override').value.trim();
        if (!prefix) return addLog("[WARN] 输入框为空！请先在上方输入框内填写你想删掉的前缀文字。", "warn");

        let targets = getSelectedItems();
        if (!(await checkTargetsAndThrow(targets))) return;

        const btn = $('#tmdb-remove-prefix-btn'); let origBtnText = btn.innerText; btn.disabled = true;

        addLog(`>> REMOVE PREFIX SEQUENCE INITIATED | 准备清理 ${targets.length} 个文件 ${isTurbo ? '⚡[极限连发]' : ''}`, "info");

        let processedCount = 0;
        for (let i = 0; i < targets.length; i++) {
            let targetItem = targets[i]; btn.innerText = `删前缀 (${i+1}/${targets.length})`;
            try {
                let oldName = targetItem.domName; let newName = oldName;
                if (oldName.startsWith(prefix)) { newName = oldName.substring(prefix.length); if (newName.startsWith('.')) newName = newName.substring(1); }
                else { addLog(`> 不包含该前缀，跳过: <span style="color:var(--v-text-m)">${oldName}</span>`); continue; }

                if (oldName !== newName) { await executeRenameRouter(targetItem, newName, isTurbo); processedCount++; }

                addLog(`
                    <div class="log-item-visual" style="background:rgba(255,69,58,0.1); border-color:rgba(255,69,58,0.3);">
                        <div class="log-details"><span class="log-old">${oldName}</span><span class="log-new" style="color:#ff453a;">➔ ${newName}</span></div>
                    </div>
                `, 'raw');
            } catch (err) { addLog(`[ERR] ${err.message || err}`, "error"); await new Promise(r => setTimeout(r, 1000)); }
        }
        addLog(`>> REMOVE PREFIX SEQUENCE COMPLETE. 成功清理了 ${processedCount} 个文件的前缀。🚀 刷新页面...`, "info");
        await refreshWebpageUI();
        btn.disabled = false; btn.innerText = origBtnText;
    }

    async function startLocalFormat() {
        const isTurbo = GM_getValue('tmdb_turbo_mode', false);
        const key = $('#tmdb-api').value.trim(); const host = 'api.tmdb.org';
        const modeBtn = $('#tmdb-mode-group .tmdb-segment-btn.active'); const mode = modeBtn ? modeBtn.getAttribute('data-val') : 'multi';
        let order = GM_getValue('tmdb_drag_order', ['cn', 'en', 'year', 'se', 'ep', 'custom', 'quality']); let sep = GM_getValue('tmdb_separator', '.');
        if (order.length === 0) return addLog("[WARN] 你的排版模板是空的！请点击“重置”找回变量积木。", "error");

        let targets = getSelectedItems();
        if (!(await checkTargetsAndThrow(targets))) return;

        const btn = $('#tmdb-local-format-btn'); let origBtnText = btn.innerText; btn.disabled = true;

        let baseTitle = $('#meta-cn') ? $('#meta-cn').textContent.replace(/[\r\n]+/g, '').trim() : '';
        let globalEngName = $('#meta-en') ? $('#meta-en').textContent.replace(/[\r\n]+/g, '').trim() : '';
        let globalYear = $('#meta-year') ? $('#meta-year').textContent.replace(/[\r\n\s]+/g, '').trim() : '';
        if (baseTitle === '未提取' || baseTitle === '读取中' || baseTitle === '检索API...' || baseTitle === '无') baseTitle = '';
        if (globalEngName === '未提取' || globalEngName === '读取中' || globalEngName === '...' || globalEngName === '无') globalEngName = '';
        if (globalYear === '未提取' || globalYear === '读取中' || globalYear === '...' || globalYear === '无') globalYear = '';

        let customTagVal = $('#tmdb-custom-tag-input') ? $('#tmdb-custom-tag-input').value.trim() : '';

        let targetS = 1;
        let overrideVal = $('#tmdb-parent-override').value.trim() || autoSniffParentName() || "";
        let pMatchSE = parseSeasonEpisode(overrideVal);
        if (pMatchSE && pMatchSE.s !== null) targetS = pMatchSE.s;

        if (!baseTitle && overrideVal) {
            baseTitle = extractMovieInfo(overrideVal).title || '';
        }

        addLog(`>> LOCAL FORMAT SEQUENCE INITIATED | 彻底断网的纯本地规范化排版 ${targets.length} 个文件 ${isTurbo ? '⚡[极限连发]' : ''}`, "info");

        let processedCount = 0;

        
        globalEngName = globalEngName.replace(/\s+/g, ' ').trim();

        if (order.includes('en') && !globalEngName && key && baseTitle) {
            addLog(`> 🌐 正在通过 TMDB API 检索官方英文名...`, "info");
            try {
                let r = await fetchTmdbData(baseTitle, globalYear, "tv", mode, key, host);
                if (r && r.length > 0) {
                    let tmdbId = r[0].id;
                    let mediaType = r[0].media_type === 'movie' ? 'movie' : 'tv';
                    let enData = await fetchAPI(`https://${host}/3/${mediaType}/${tmdbId}?api_key=${key}&language=en-US`);
                    let engTitle = enData?.name || enData?.title || r[0].original_name;
                    if (engTitle) engTitle = engTitle.replace(/[\u4e00-\u9fa5]/g, '').replace(/\s+/g, ' ').trim();
                    if (engTitle) {
                        globalEngName = engTitle;
                        addLog(`> ✅ 成功获取官方英文名: <span style="color:#0A84FF">${globalEngName}</span>`, "info");
                    } else { addLog(`> ⚠️ 官方数据中无有效英文名，该变量将留空。`, "warn"); }
                } else { addLog(`> ⚠️ TMDB未能查找到该剧集，无法获取英文名。`, "warn"); }
            } catch(e) { addLog(`> ❌ 获取英文原名失败。`, "error"); }
        }

        for (let i = 0; i < targets.length; i++) {
            let targetItem = targets[i]; btn.innerText = `规范化 (${i+1}/${targets.length})`;
            try {
                let oldName = targetItem.domName;
                let extMatch = oldName.match(/(\.[a-zA-Z0-9]+)$/); let ext = extMatch ? extMatch[1] : ''; let nameWithoutExt = ext ? oldName.slice(0, -ext.length) : oldName;

                let targetE = null;
                let parsedSE = parseSeasonEpisode(nameWithoutExt, targetS);

                if(nameWithoutExt.match(/[Ss]\d{1,2}/i) || nameWithoutExt.match(/第[一二三四五六七八九十百零\d]+季/)) {
                     targetS = parsedSE.s;
                }
                targetE = parsedSE.e;

                if (targetE === null) {
                    let cleanForNum = nameWithoutExt.replace(baseTitle, ''); let numMatch = cleanForNum.match(/(?:^|[ \-\.\[【])(\d{1,4})(?:[ \-\.\]】]|$)/);
                    if (numMatch && !/^(1080|2160|720|480|264|265)$/.test(numMatch[1])) targetE = parseInt(numMatch[1], 10);
                }

                if (targetE === null) { addLog(`> ⚠️ 无法识别集数，跳过: <span style="color:var(--v-text-m)">${oldName}</span>`, "warn"); continue; }

                let sStr = String(targetS).padStart(2, '0'); let eStr = String(targetE).padStart(2, '0');

                let qualityMatch = nameWithoutExt.match(/(2160p|1080p|1080i|720p|480p|4k|8k|UHD)/i);
                let qualityStr = qualityMatch ? qualityMatch[1].toUpperCase() : '';

                let finalEnName = globalEngName;
                if (!finalEnName) {
                    let fileNoExtClean = nameWithoutExt.replace(/[Ss]\d{1,2}[.\-_ ]?[Ee]\d{1,4}.*/i, '').replace(/[\u4e00-\u9fa5]/g, ' ').replace(/(?:19|20)\d{2}/g, ' ').replace(/(?:1080p|2160p|1080i|720p|480p|4k|8k|UHD|BluRay|WEB-DL|WEB|WEBRip|HDTV|Remux|x264|x265|H264|H265|HEVC|AVC|DTS-HD|DTS|TrueHD|Atmos|Dolby|AAC|AC3|DDP\d*\.?\d*|HDR10\+|HDR|DoVi|10bit|REPACK|PROPER|MARK|cKTV)/gi, ' ').replace(/[\(\)\[\]\{\}【】\-]/g, ' ');
                    finalEnName = fileNoExtClean.replace(/[\.\-_]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
                }

                let vars = { 'cn': baseTitle, 'en': finalEnName, 'year': globalYear ? (sep === '.' ? globalYear : `(${globalYear})`) : '', 'se': `S${sStr}E${eStr}`, 'ep': `第${eStr}集`, 'quality': qualityStr, 'custom': customTagVal };

                
                if (sep === '.') {
                    if (vars['en']) vars['en'] = vars['en'].replace(/\s+/g, '.').replace(/[:：]\./g, '：').replace(/\.{2,}/g, '.');
                    if (vars['cn']) vars['cn'] = vars['cn'].replace(/\s+/g, '.').replace(/[:：]\./g, '：').replace(/\.{2,}/g, '.');
                    if (vars['custom']) vars['custom'] = vars['custom'].replace(/\s+/g, '.');
                }

                let finalParts = []; order.forEach(id => { if (vars[id]) finalParts.push(vars[id]); });
                let newName = finalParts.join(sep);
                if (sep === '.') newName = newName.replace(/\.{2,}/g, '.'); else if (sep === ' - ') newName = newName.replace(/\s+-\s+-\s+/g, ' - '); else if (sep === ' ') newName = newName.replace(/\s{2,}/g, ' ');
                newName += ext;

                
                newName = sanitize(newName);

                if (oldName !== newName) { await executeRenameRouter(targetItem, newName, isTurbo); processedCount++; }

                addLog(`
                    <div class="log-item-visual" style="background:rgba(255,214,10,0.1); border-color:rgba(255,214,10,0.3);">
                        <div class="log-details"><span class="log-old">${oldName}</span><span class="log-new" style="color:#ffd60a;">➔ ${newName}</span></div>
                    </div>
                `, 'raw');
            } catch (err) { addLog(`[ERR] ${err.message || err}`, "error"); await new Promise(r => setTimeout(r, 1000)); }
        }
        addLog(`>> LOCAL FORMAT SEQUENCE COMPLETE. 成功规范化 ${processedCount} 个文件。🚀 刷新页面...`, "info");
        await refreshWebpageUI();
        btn.disabled = false; btn.innerText = origBtnText;
    }

    function showInteractiveModal(query, mode, key, host) {
        return new Promise((res, rej) => {
            document.body.insertAdjacentHTML('beforeend', `<div id="tmdb-modal-overlay"><div id="tmdb-modal"><div id="tmdb-modal-header">手动刮削匹配</div><div id="tmdb-modal-body"><div class="tmdb-search-bar"><input type="text" id="tmdb-mi" value="${query}"><button id="tmdb-ms">搜 索</button></div><div id="tmdb-mr"></div></div><div class="tmdb-modal-footer"><button class="tmdb-btn-skip" id="tmdb-mk">跳 过</button><button class="tmdb-btn-stop" id="tmdb-mt">终止全部</button></div></div></div>`);
            const close = (v, isErr) => { $('#tmdb-modal-overlay').remove(); isErr ? rej(v) : res(v); };
            $('#tmdb-mk').onclick = () => close(null); $('#tmdb-mt').onclick = () => close('USER_STOP', true);
            ['keydown', 'keyup', 'keypress'].forEach(evt => $('#tmdb-mi').addEventListener(evt, e => { e.stopPropagation(); if (evt === 'keydown' && e.key === 'Enter') search(); }));

            const search = async () => {
                let kw = $('#tmdb-mi').value.trim(); if(!kw) return;
                $('#tmdb-mr').innerHTML = '<div style="padding:30px;text-align:center;color:var(--v-text-m);font-weight:600;">正在检索 TMDB 数据库...</div>';
                try {
                    let searchTitle = kw; let searchYear = ""; let yearMatch = kw.match(/(?:[\s\-_]*\(?(\d{4})\)?\s*)$/);
                    if (yearMatch && yearMatch.index > 0) { searchYear = yearMatch[1]; searchTitle = kw.substring(0, yearMatch.index).trim(); }
                    let r = await fetchTmdbData(searchTitle, searchYear, "unknown", mode, key, host);
                    if (!r.length && searchYear) r = await fetchTmdbData(kw, "", "unknown", mode, key, host);
                    if (!r.length) return $('#tmdb-mr').innerHTML = '<div style="padding:30px;text-align:center;color:var(--v-red);font-weight:600;">未找到相关结果，请精简或更换关键词。</div>';
                    const placeholder = `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='60' height='90'><rect width='60' height='90' fill='%23222'/></svg>`;
                    $('#tmdb-mr').innerHTML = r.map(i => `<div class="tmdb-result-item" data-id="${i.id}"><img class="tmdb-result-poster" src="${i.poster || placeholder}" onerror="this.src='${placeholder}'"/><div class="tmdb-result-info"><span class="tmdb-result-title">${i.title}</span><div>${i.year && i.year!=='N/A' ? `<span class="tmdb-result-year">${i.year}</span>` : ''}<span class="tmdb-result-type" style="background:${i.media_type==='tv'?'var(--v-blue)':i.media_type==='movie'?'#5e5ce6':'#ff9f0a'}">${i.media_type.toUpperCase().substring(0,3)}</span></div></div></div>`).join('');
                    $$('.tmdb-result-item').forEach((el, idx) => el.onclick = () => close(r[idx]));
                } catch(e) { $('#tmdb-mr').innerHTML = `<div style="padding:30px;color:var(--v-red);text-align:center;">发生错误：${e}</div>`; }
            };
            $('#tmdb-ms').onclick = search; search();
        });
    }

    window.addEventListener('DOMContentLoaded', () => setTimeout(createUI, 1000));
})();