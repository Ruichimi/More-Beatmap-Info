import log from "/logger";
import DOMObserver from "./Services/DOMObserver";
import LastDiffInfo from "./Services/LastDiffInfo";

const observer = new DOMObserver();
const LDI = new LastDiffInfo(observer);

function initLastDiffInfo() {
    try {
        if (!document.getElementById('last-diff-info')) {
            log('Инициализируем Last Diff Info', 'dev');
            LDI.initialize();
        } else {
            log('Last diff info уже инициализирован', 'dev', 'warning');
        }
    } catch (error) {
        log(`Ошибка при инициализации LastDiffInfo: ${error.message}`, 'prod', 'error');
    }
}

window.onload = function() {
    initLastDiffInfo();
};

window.addEventListener('popstate', () => {
    log('Перезагружаем расширение', 'dev');
    observer.stopAllObserving();
    initLastDiffInfo();
});
