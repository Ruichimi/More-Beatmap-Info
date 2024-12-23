import log from "/logger";
import DOMObserver from "./Services/DOMObserver";
import LastDiffInfo from "./Services/LastDiffInfo";
import DomHelper from "./Services/DomHelper";

const observer = new DOMObserver();
const LDI = new LastDiffInfo(observer);

function initLastDiffInfo() {
    try {
        if (!document.getElementById('last-diff-info')) {
            DomHelper.addUniqueElementToDOM('last-diff-info');
            log('Инициализируем Last Diff Info', 'dev');
            LDI.initialize();
        } else {
            log('Last diff info уже инициализирован', 'dev', 'warning');
        }
    } catch (error) {
        log(`Ошибка при инициализации LastDiffInfo: ${error.message}`, 'prod', 'error');
        LDI.handleError();
    }
}

function reloadExtension(withDom = false) {
    log('Перезагружаем расширение', 'prod');
    observer.stopAllObserving();
    if (withDom) {
        DomHelper.clearDOM();
    }
    initLastDiffInfo();
}

window.onload = function() {
    initLastDiffInfo();
};

window.addEventListener('popstate', () => {
    reloadExtension();
});

window.addEventListener('reloadExtensionRequested', () => reloadExtension(true));

