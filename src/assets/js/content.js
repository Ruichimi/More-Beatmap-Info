import LastDiffInfo from "./Services/LastDiffInfo";
import log from "/logger";

function initLastDiffInfo() {
    try {
        if (!document.getElementById('last-diff-info')) {
            log('Инициализируем Last Diff Info', 'dev');
            LastDiffInfo.initialize();
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
    initLastDiffInfo();
});
