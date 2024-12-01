import log from "/logger.js";

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
        if (this.observers.has(targetSelector)) {
            log(`DOMObserver: Already observing "${targetSelector}".`, 'dev', 'error');
            return;
        }

        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.addedNodes.length > 0) {
                    callback(mutation.addedNodes, targetSelector);
                }
            });
        });

        observer.observe(targetNode, options);
        this.observers.set(targetSelector, observer);

        console.log(`DOMObserver: Started observing "${targetSelector}".`);
    }

    observeDynamicElement(classToCheck, callback, options = { childList: true, subtree: true }) {
        this.startObserving(this.defaultParentSelector, (addedNodes) => {
            addedNodes.forEach((node) => {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    const dynamicElement = node.querySelector(classToCheck);
                    if (dynamicElement) {
                        callback(dynamicElement);
                    }
                }
            });
        }, options);
    }

    stopObserving(targetSelector) {
        const observer = this.observers.get(targetSelector);

        if (observer) {
            observer.disconnect();
            this.observers.delete(targetSelector);
            console.log(`DOMObserver: Stopped observing "${targetSelector}".`);
        } else {
            console.warn(`DOMObserver: No observer found for "${targetSelector}".`);
        }
    }

    stopAllObserving() {
        this.observers.forEach((observer, targetSelector) => {
            observer.disconnect();
            console.log(`DOMObserver: Stopped observing "${targetSelector}".`);
        });
        this.observers.clear();
    }
}

export default DOMObserver;
