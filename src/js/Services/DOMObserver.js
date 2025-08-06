import log from "@/js/logger.js";

class DOMObserver {
    constructor() {
        this.observers = new Map();
        this.defaultParentSelector = 'body';
    }

    startObserving(targetSelector, callback, options = { childList: true }) {
        const targetNode = document.querySelector(targetSelector);

        if (!targetNode) {
            log(`DOMObserver: Target node not found for selector "${targetSelector}".`, 'dev', 'error');
            return;
        }
        if (this.observers.has(targetSelector) && targetSelector !== this.defaultParentSelector) {
            log(`DOMObserver: Already observing "${targetSelector}".`, 'dev', 'error');
            return;
        }

        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.addedNodes.length > 0) {
                    callback(mutation.addedNodes);
                }
            });
        });

        observer.observe(targetNode, options);
        this.observers.set(targetSelector, observer);

        log(`DOMObserver: Started observing "${targetSelector}".`, 'dev');

        //Processing of data that already has been loaded in the DOM.
        if (options.childList && targetNode.children.length > 0) {
            const existingNodes = Array.from(targetNode.children);
            callback(existingNodes, targetSelector);
        }
    }

    watchElementPresence(selector, onAppear, onDisappear, parentSelector, config = { childList: true, subtree: true }) {
        let currentElement = document.querySelector(selector);
        let isPresent = !!currentElement;

        if (isPresent) {
            onAppear?.(currentElement);
        }

        const observer = new MutationObserver(() => {
            const foundElement = document.querySelector(selector);
            const existsNow = !!foundElement;

            if (!isPresent && existsNow) {
                isPresent = true;
                currentElement = foundElement;
                onAppear?.(foundElement);
            } else if (isPresent && !existsNow) {
                isPresent = false;
                currentElement = null;
                onDisappear?.();
            }
        });

        observer.observe(document.body, config);
        this.observers.set(`presence:${selector}`, observer);

        log(`DOMObserver: Watching presence of "${selector}".`, 'dev');
        return observer;
    }

    stopObservingPresence(...selectors) {
        const keys = selectors.map(selector => `presence:${selector}`);
        this.stopObserving(...keys);
    }

    isObserving(targetSelector) {
        return this.observers.has(targetSelector);
    }

    stopObserving(...targetSelectors) {
        targetSelectors.forEach(targetSelector => {
            const observer = this.observers.get(targetSelector);

            if (observer) {
                observer.disconnect();
                this.observers.delete(targetSelector);
                log(`DOMObserver: Stopped observing "${targetSelector}".`, 'dev');
            } else {
                log(`DOMObserver: No observer found for "${targetSelector}".`, 'dev', 'warn');
            }
        });
    }

    stopAllObserving() {
        log(this.observers, 'debug');
        this.observers.forEach((observer, targetSelector) => {
            observer.disconnect();
            log(`DOMObserver: Stopped observing "${targetSelector}".`, 'dev');
        });
        this.observers.clear();
    }
}

export default DOMObserver;
