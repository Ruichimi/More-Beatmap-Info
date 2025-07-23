import log from "@/js/logger.js";
import devTools from "@/js/devTools";
import DOMObserver from "./Services/DOMObserver";
import MoreBeatmapInfo from "./Services/MoreBeatmapInfo";
import DomHelper from "./Services/DomHelper";
import config from '/config';

const observer = new DOMObserver();
const MBI = new MoreBeatmapInfo(observer);

if (config.enable_devToolPanel) devTools();

window.onload = function () {
    if (isBeatmapSetsPage()) {
        initMoreBeatmapInfo();
    }
};

observeBeatmapsetsPageAndLoadExtension();

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

function waitForBeatmapsContainer(callback) {
    const targetNode = document.body;
    const config = { childList: true, subtree: true };

    const observer = new MutationObserver((mutationsList, observerInstance) => {
        const items = document.querySelector('.beatmapsets__items');
        if (items) {
            observerInstance.disconnect();
            callback();
        }
    });

    observer.observe(targetNode, config);
}

function reloadExtension(withDom = false) {
    log('Перезагружаем расширение', 'dev');
    observer.stopAllObserving();

    if (withDom) {
        DomHelper.clearDOM();
    }

    waitForBeatmapsContainer(() => {
        initMoreBeatmapInfo();
    });
}


function observeBeatmapsetsPageAndLoadExtension() {
    let initCalled = true;

    const UrlObserve = new MutationObserver(() => {
        if (isBeatmapSetsPage()) {
            if (!initCalled) {
                reloadExtension();
                initCalled = true;
            }
        } else {
            initCalled = false;
        }
    });

    UrlObserve.observe(document.querySelector('head'), {childList: true, subtree: false});
}

window.addEventListener('reloadExtensionRequested', () => reloadExtension(true));
