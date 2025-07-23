import log from "@/js/logger.js";
import devTools from "@/js/devTools";
import DOMObserver from "./Services/DOMObserver";
import MoreBeatmapInfo from "./Services/MoreBeatmapInfo";
import DomHelper from "./Services/DomHelper";
import config from '/config';

const observer = new DOMObserver();
const MBI = new MoreBeatmapInfo(observer);

if (config.enable_devToolPanel) devTools();

observeBeatmapsetsPageAndLoadExtension();

window.addEventListener('popstate', () => {
    if (isBeatmapSetsPage()) {
        loadExtension();
    }
});

function observeBeatmapsetsPageAndLoadExtension() {
    let needToReload = true;

    const UrlObserve = new MutationObserver(() => {
        if (isBeatmapSetsPage()) {
            if (needToReload) {
                loadExtension();
                needToReload = false;
            }
        } else {
            needToReload = true;
        }
    });

    UrlObserve.observe(document.querySelector('head'), {childList: true, subtree: false});
}

function isBeatmapSetsPage() {
    return window.location.pathname.startsWith('/beatmapsets');
}

function initMoreBeatmapInfo() {
    try {
        if (!document.getElementById('last-diff-info')) {
            DomHelper.addUniqueElementToDOM('last-diff-info');
            log('Initialization Last Diff Info', 'dev');
            MBI.initialize();
        } else {
            log('Last diff info is already initialized', 'dev', 'warning');
        }
    } catch (error) {
        log(`Error initializing LastDiffInfo: ${error.message}`, 'prod', 'error');
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

function loadExtension(cleanDOM = false) {
    log('Load extension', 'dev');
    observer.stopAllObserving();

    if (cleanDOM) {
        DomHelper.clearDOM();
    }

    waitForBeatmapsContainer(() => {
        initMoreBeatmapInfo();
    });
}

window.addEventListener('reloadExtensionRequested', () => loadExtension(true));
