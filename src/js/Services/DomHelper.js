import log from "@/js/logger.js";

class DomHelper {
    constructor() {
        this.createdUniqueElementId = null;
        this.beatmapsContainer = document.body;
        this.isBeatmapsContainerInitialized = false;
    }

    setBeatmapsContainerIfNeeded() {
        if (!this.isBeatmapsContainerInitialized) {
            const beatmapsContainer = document.querySelector('.beatmapsets__items');

            if (beatmapsContainer) {
                this.beatmapsContainer = beatmapsContainer;
                this.isBeatmapsContainerInitialized = true;
            }
        }
    }

    addUniqueElementToDOM(id) {
        const existingElement = document.getElementById(id);
        if (!existingElement) {
            const element = document.createElement('div');
            element.id = id;
            document.body.appendChild(element);
            this.createdUniqueElementId = id;
            log(`Элемент с ID "${id}" добавлен`, 'debug');
        } else {
            log(`Элемент с ID "${id}" уже существует`, 'dev', 'warn');
        }
    }

    removeUniqueElementFromDOM() {
        const element = this.createdUniqueElementId && document.getElementById(this.createdUniqueElementId);
        if (element) {
            element.remove();
            log(`Элемент с ID "${this.createdUniqueElementId}" удалён`, 'debug');
            this.createdUniqueElementId = null;
        } else {
            log('Элемент не найден для удаления', 'dev', 'warn');
        }
    }

    clearDOM() {
        const elementsToRemove = [
            ...this.beatmapsContainer.querySelectorAll('.more-beatmap-info'),
            ...this.beatmapsContainer.querySelectorAll('.more-diff-info-btn'),
            ...this.beatmapsContainer.querySelectorAll('.change-diff-info-button')
        ];

        elementsToRemove.forEach(element => {
            if (element) {
                element.remove();
            }
        });

        this.removeUniqueElementFromDOM();
        log('The DOM was cleared', 'dev');
    }

    mountBeatmapInfoToBlock(beatmapBlock, beatmapInfo) {
        let infoBlock = beatmapBlock.querySelector('.more-beatmap-info-block');
        if (!infoBlock) {
            infoBlock = document.createElement('div');
            infoBlock.classList.add('more-beatmap-info-block');

            const statsRowBlock = beatmapBlock.querySelector('.beatmapset-panel__info-row--stats');
            statsRowBlock.parentNode.insertBefore(infoBlock, statsRowBlock.nextSibling);
        }

        infoBlock.innerHTML = '';

        if (typeof beatmapInfo === 'string') {
            infoBlock.innerHTML = beatmapInfo;
        } else if (beatmapInfo instanceof HTMLElement) {
            infoBlock.appendChild(beatmapInfo);
        }

        return infoBlock;
    }

    getMapsetIdFromBlock(beatmapBlock) {
        const href = beatmapBlock.querySelector('a').getAttribute('href');
        const match = href.match(/\/(\d+)$/);
        return match ? match[1] : null;
    }

    addDeepInfoButtonToBeatmap(beatmapBlock, callbackClick) {
        const beatmapBlockRightMenu = beatmapBlock.querySelector('.beatmapset-panel__menu');
        const moreDiffInfoBtn = this.createDeepInfoBtn();
        beatmapBlockRightMenu.insertAdjacentElement('afterbegin', moreDiffInfoBtn);
        moreDiffInfoBtn.addEventListener('click', async () => {
            callbackClick(beatmapBlock);
        });
    }

    createDeepInfoBtn() {
        const btnContent = `i`;

        const moreDiffInfoBtn = document.createElement('button');
        moreDiffInfoBtn.classList.add('more-diff-info-btn');
        moreDiffInfoBtn.innerHTML = btnContent;
        return moreDiffInfoBtn;
    }

    getExistingDeepInfoTooltip(beatmapId) {
        const existingTooltip = this.beatmapsContainer.querySelector('.deep-beatmap-params-tooltip');
        log(`Is tooltip already exists: ${existingTooltip ? 'yes' : 'no'}`, 'debug');
        if (existingTooltip && existingTooltip.beatmapId === beatmapId) {
            return existingTooltip;
        }
        return null;
    }

    updateBeatmapIdBtn(newBeatmapId, mapsetId) {
        const beatmapBlock = this.getMapsetBlockById(mapsetId);
        beatmapBlock.setAttribute('beatmapId', newBeatmapId);
    }

    mountPPButton(beatmapBlock, callbackClick) {
        log('Mounting PP button', 'full');
        const ppBlock = beatmapBlock.querySelector('.pp-block');
        const getPPBtn = this.createPPBtn();
        ppBlock.innerHTML = '';
        ppBlock.appendChild(getPPBtn);
        getPPBtn.addEventListener('click', async () => {
            callbackClick(beatmapBlock);
        });
    }

    createPPBtn() {
        const getPPBtn = document.createElement('button');
        getPPBtn.classList.add('beatmap-pp-btn');
        getPPBtn.innerHTML = 'Get PP';
        return getPPBtn;
    }

    mountPPForBeatmapBlock(beatmapBlock, beatmapPP) {
        console.log(beatmapPP);
        const ppBlock = beatmapBlock.querySelector('.pp-block');
        const roundedPP = Math.round(beatmapPP);
        ppBlock.innerHTML = '';
        ppBlock.innerHTML += `${roundedPP}pp
                              <span class="beatmap-pp-data">(100%fc)</span>`;
    }

    /**
     * Creates an HTML element for the tooltip with detailed beatmap data and appends it to the DOM.
     *
     * When creating the tooltip, an event listener is registered that, upon clicking anywhere on the site,
     * will hide the tooltip and remove this event listener. This could confuse the developer if the button
     * that triggers the tooltip is clicked again, as the script will remove the tooltip due to the click
     * event registered on the DOM (I --fu***d-- debugged because of this for an hour >_<)
     */
    displayTooltip(beatmapDeepParams, beatmapId, element) {
        const tooltip = document.createElement('div');
        tooltip.classList.add('deep-beatmap-params-tooltip');
        tooltip.innerText = beatmapDeepParams;
        tooltip.beatmapId = beatmapId;
        element.before(tooltip);
        const hideTooltipOnClickDOM = (event) => {
            if (tooltip.contains(event.target)) {
                return;
            }

            tooltip.remove();
            document.removeEventListener('click', hideTooltipOnClickDOM);
            log('Tooltip was removed because of click on the page', 'dev');
        };

        setTimeout(() => {
            document.addEventListener('click', hideTooltipOnClickDOM);
        }, 0);
    }

    addChangeInfoButtonsToMapsetDiffsList(beatmapsetDiffsListBlock, callbackClick) {
        const beatmapsetDiffsList = beatmapsetDiffsListBlock.querySelectorAll('.beatmaps-popup-item');
        const DiffsListDivs = this.convertLinksToDivsDOM(beatmapsetDiffsList);
        DiffsListDivs.forEach(diffItemDiv => {
            const beatmapId = diffItemDiv.getAttribute('href') ? diffItemDiv.getAttribute('href').split('/').pop() : 'Unknown';
            const beatmapListItem = diffItemDiv.querySelector('.beatmap-list-item');
            if (beatmapListItem) {
                beatmapListItem.querySelector('.change-diff-info-button')?.remove();
                const changeDiffInfoBtn = this.createChangeDiffInfoBtn(beatmapId);
                beatmapListItem.appendChild(changeDiffInfoBtn);
                this.convertDiffNameDivToLink(beatmapListItem, diffItemDiv);

                changeDiffInfoBtn.addEventListener('click', () => {
                    callbackClick(beatmapId);
                });
            } else {
                log('Не верный элемент', 'dev', 'error');
            }
        });
    }

    createChangeDiffInfoBtn() {
        const changeDiffInfoBtn = document.createElement('button');
        changeDiffInfoBtn.classList.add('change-diff-info-button');
        changeDiffInfoBtn.textContent = `Show Info`;
        return changeDiffInfoBtn;
    }

    convertLinksToDivsDOM(links) {
        const updatedDivs = [];
        links.forEach(link => {
            const div = document.createElement('div');
            div.innerHTML = link.innerHTML;
            for (const attr of link.attributes) {
                div.setAttribute(attr.name, attr.value);
            }
            link.parentNode.replaceChild(div, link);
            updatedDivs.push(div);
        });

        return updatedDivs;
    }

    /**
     * Converts and replaces <div> HTML blocks with <a> elements. Transfers the block's content (name)
     * and the 'href' attribute, which must be present in the <div> block for the conversion.
     *
     * This method is used in combination with `convertLinksToDivsDOM` to enable navigation
     * through a link in a popup list of diffs for the mapset. It allows clicking on the difficulty
     * name rather than the entire row.
     *
     * @param {HTMLElement} beatmapListItem - The item from list of popup diffs elements of the beatmap.
     * @param {HTMLElement} diffItemDiv - The block containing the difficulty name and 'href' attribute.
     */
    convertDiffNameDivToLink(beatmapListItem, diffItemDiv) {
        const diffNameBlock = beatmapListItem.querySelector('.beatmap-list-item__version');
        log(diffNameBlock, 'debug');

        if (diffNameBlock) {
            const diffNameAsLink = document.createElement('a');
            diffNameAsLink.href = diffItemDiv.getAttribute('href');
            diffNameAsLink.innerHTML = diffNameBlock.innerHTML;
            diffNameBlock.parentNode.replaceChild(diffNameAsLink, diffNameBlock);
        }
    }

    getMapsetBlockById(mapsetId) {
        return this.beatmapsContainer.querySelector(`.beatmapsets__item[mapsetId="${mapsetId}"]`);
    }

    getMapsetBlockByCurrentDiffDisplayed(beatmapId) {
        const mapsetBlock = this.beatmapsContainer.querySelector(`[beatmapId="${beatmapId}`);
        if (!mapsetBlock) {
            log(`Mapset block not found by beatmap id: ${beatmapId}`, 'debug');
            return null;
        }
        return mapsetBlock;
    }

    createRetryGetInfoBtn() {
        const retryGetInfoBtn = document.createElement('button');
        retryGetInfoBtn.classList.add('retry-get-info-btn');
        retryGetInfoBtn.textContent = 'retry';
        return retryGetInfoBtn;
    }
}

export default new DomHelper();
