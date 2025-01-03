import log from "/logger";
import DOMObserver from "./Services/DOMObserver";
import MoreBeatmapInfo from "./Services/MoreBeatmapInfo";
import DomHelper from "./Services/DomHelper";

const observer = new DOMObserver();
const MBI = new MoreBeatmapInfo(observer);

let initCalled = false;

const UrlObserve = new MutationObserver(() => {
    console.log(isBeatmapSetsPage());
    if (isBeatmapSetsPage()) {
        if (!initCalled) {
            console.log(window.location.href);
            reloadExtension();
            initCalled = true;
        }
    } else {
        initCalled = false;
    }
});

UrlObserve.observe(document.querySelector('head'), { childList: true, subtree: false });

window.onload = function() {
    if (isBeatmapSetsPage()) {
        initMoreBeatmapInfo();
    }
};

window.addEventListener('popstate', () => {
    if (isBeatmapSetsPage()) {
        reloadExtension();
    }
});

function isBeatmapSetsPage() {
    return window.location.pathname.startsWith('/beatmapsets');
}

function initMoreBeatmapInfo() {
    try {
        if (!document.getElementById('last-diff-info')) {
            DomHelper.addUniqueElementToDOM('last-diff-info');
            log('Инициализируем Last Diff Info', 'dev');
            MBI.initialize();
        } else {
            log('Last diff info уже инициализирован', 'dev', 'warning');
        }
    } catch (error) {
        log(`Ошибка при инициализации LastDiffInfo: ${error.message}`, 'prod', 'error');
        MBI.reloadExtensionEvent();
    }
}

function reloadExtension(withDom = false) {
    log('Перезагружаем расширение', 'prod');
    observer.stopAllObserving();
    if (withDom) {
        DomHelper.clearDOM();
    }
    initMoreBeatmapInfo();
}

window.addEventListener('reloadExtensionRequested', () => reloadExtension(true));
