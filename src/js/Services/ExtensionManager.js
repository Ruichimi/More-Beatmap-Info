import log from "@/js/logger.js";
import DOMObserver from "@services/DOMObserver";
import MoreBeatmapInfo from "@services/MoreBeatmapInfo";
import DomHelper from "@services/DomHelper";

const observer = new DOMObserver();
const MBI = new MoreBeatmapInfo(observer);

class ExtensionManager {
    constructor() {
        this.needToLoadExtension = true;
    }

    start() {
        const UrlObserve = new MutationObserver(() => {
            if (this.isBeatmapSetsPage()) {
                if (this.needToLoadExtension) {
                    DomHelper.reloadBeatmapsContainer();
                    this.needToLoadExtension = false;

                    this.loadExtension(true);
                }
            } else {
                this.needToLoadExtension = true;
            }
        });

        UrlObserve.observe(document.querySelector('head'), {childList: true, subtree: false});
    }

    isBeatmapSetsPage() {
        return window.location.pathname.startsWith('/beatmapsets');
    }

    initMoreBeatmapInfo() {
        try {
            if (!document.getElementById('last-diff-info')) {
                DomHelper.addUniqueElementToDOM('last-diff-info');
                log('Initialization Last Diff Info', 'dev');
                MBI.initialize();
            } else {
                console.log(document.getElementById('last-diff-info'));
                log('Last diff info is already initialized', 'dev', 'warning');
            }
        } catch (error) {
            log(`Error initializing LastDiffInfo: ${error.message}`, 'prod', 'error');
            MBI.reloadExtensionEvent();
        }
    }

    waitForBeatmapsContainer(callback) {
        const targetNode = document.body;
        const config = {childList: true, subtree: true};

        const observer = new MutationObserver((mutationsList, observerInstance) => {
            const items = document.querySelector('.beatmapsets__items');
            if (items) {
                observerInstance.disconnect();
                callback();
            }
        });

        observer.observe(targetNode, config);
    }

    loadExtension(cleanDOM = false) {
        log('Load extension', 'dev');
        observer.stopAllObserving();

        this.waitForBeatmapsContainer(() => {
            if (cleanDOM) {
                DomHelper.clearDOM();
            }

            this.initMoreBeatmapInfo();
        });
    }
}

export default ExtensionManager;
