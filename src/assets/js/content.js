import log from "/logger";
import DOMObserver from "./Services/DOMObserver";
import MoreBeatmapInfo from "./Services/MoreBeatmapInfo";
import DomHelper from "./Services/DomHelper";

const observer = new DOMObserver();
const MBI = new MoreBeatmapInfo(observer);

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

window.onload = function() {
    initMoreBeatmapInfo();
};

window.addEventListener('popstate', () => {
    reloadExtension();
});

window.addEventListener('reloadExtensionRequested', () => reloadExtension(true));

