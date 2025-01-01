import log from "/logger.js"

//TODO: Пофиксить ошибку при попытке получить полную информацию о грейвярд карте

class DomHelper {
    constructor() {
        this.attemptsToCatchMaps = 5;
        this.createdUniqueElementId = null;
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
            ...document.querySelectorAll('.more-beatmap-info'),
            ...document.querySelectorAll('.more-diff-info-btn'),
            //...document.querySelectorAll('.change-diff-info-button') The operation can be resource-intensive, and currently there is no need to remove these buttons
        ];

        elementsToRemove.forEach(element => element.remove());
        this.removeUniqueElementFromDOM();
        log('The DOM was cleared', 'dev');
    }

    catchBeatmapsFromDOM() {
        let attemptsToCatchMaps = this.attemptsToCatchMaps;
        log('Вызвана функция catchMapsFromDom', 'debug');
        return new Promise((resolve, reject) => {
            const attemptToCatchMaps = () => {
                const beatmapsRows = document.getElementsByClassName('beatmapsets__items-row');
                if (beatmapsRows.length > 0) {
                    log('Получили карты', 'dev');
                    resolve(beatmapsRows);
                } else if (attemptsToCatchMaps > 1) {
                    log('Не удалось получить карты с DOM, повторяем попытку', 'dev', 'warn');
                    attemptsToCatchMaps--;
                    setTimeout(() => {
                        attemptToCatchMaps();
                    }, 200);
                } else {
                    reject('Не удалось получить карты после нескольких попыток');
                }
            };

            attemptToCatchMaps();
        });
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
        const btnContent = '<svg class="w-6 h-6 text-gray-800 dark:text-white" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">\n  <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 11h2v5m-2 0h4m-2.592-8.5h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/>\n </svg>'
        const moreDiffInfoBtn = document.createElement('button');
        moreDiffInfoBtn.classList.add('more-diff-info-btn');
        moreDiffInfoBtn.innerHTML = btnContent;
        return moreDiffInfoBtn;
    }

    getExistingDeepInfoTooltip(beatmapId) {
        const existingTooltip = document.querySelector('.deep-beatmap-params-tooltip');
        log(`Is tooltip already exists: ${existingTooltip ? 'yes' : 'no'}`, 'debug');
        if (existingTooltip && existingTooltip.beatmapId === beatmapId) {
            return existingTooltip;
        }
        return null;
    }

    updateBeatmapIdBtn(newBeatmapId, mapsetId) {
        const beatmapBlock = document.querySelector(`[mapsetId="${mapsetId}"]`);
        beatmapBlock.setAttribute('beatmapId', newBeatmapId);
    }

    mountPPButton(beatmapBlock, beatmapId, callbackClick) {
        const beatmapNameBlock = beatmapBlock.querySelector('.beatmapset-panel__info').firstElementChild;
        const ppBlock = beatmapNameBlock.querySelector('.beatmap-pp-block');
        const getPPBtn = beatmapNameBlock.querySelector('.beatmap-get-pp-btn');
        if (!getPPBtn && !ppBlock) {
            const getPPBtn = document.createElement('button');
            getPPBtn.classList.add('beatmap-pp-btn');
            getPPBtn.innerHTML = 'Get PP';
            getPPBtn.setAttribute('beatmapId', beatmapId);
            beatmapNameBlock.appendChild(getPPBtn);
            getPPBtn.addEventListener('click', async () => {
                callbackClick(beatmapBlock);
            });
        }
    }

    mountPPForBeatmapBlock(beatmapBlock, beatmapId, beatmapPP) {
        const roundedPP = Math.round(beatmapPP);
        const beatmapNameBlock = beatmapBlock.querySelector('.beatmapset-panel__info').firstElementChild;
        const getPPBtn = beatmapNameBlock.querySelector('.beatmap-pp-btn');
        const ppBlock = beatmapNameBlock.querySelector('.beatmap-pp-block');

        if (ppBlock) {
            ppBlock.innerHTML = `${roundedPP}pp <span class="beatmap-pp">(100%fc)</span>`;
        } else {
            if (getPPBtn) getPPBtn.remove();
            beatmapNameBlock.innerHTML += `<div class="beatmap-pp-block" beatmapId="${beatmapId}">${roundedPP}pp <span class="beatmap-pp">(100%fc)</span></div>`;
        }
    }


    /**
     * Creates an HTML element for the tooltip with detailed beatmap data and appends it to the DOM.
     *
     * When creating the tooltip, an event listener is registered that, upon clicking anywhere on the site,
     * will hide the tooltip and remove this event listener. This could confuse the developer if the button
     * that triggers the tooltip is clicked again, as the script will remove the tooltip due to the click
     * event registered on the DOM(I --fu***d-- debugged because of this for an hour >_<)
     */
    displayTooltip(beatmapDeepParams, beatmapId, element) {
        const tooltip = document.createElement('div');
        tooltip.classList.add('deep-beatmap-params-tooltip');
        tooltip.innerText = beatmapDeepParams;
        tooltip.beatmapId = beatmapId;
        element.before(tooltip);
        const hideTooltipOnClickDOM = () => {
            tooltip.remove();
            document.removeEventListener('click', hideTooltipOnClickDOM);
            log('Tooltip was removed because of click on the page', 'dev');
        };

        setTimeout(() => {
            document.addEventListener('click', hideTooltipOnClickDOM);
        }, 0);
    }

    addChangeDiffInfoButtonsToDiffsList(beatmapDiffsGroupBlock, callback) {
        const beatmapsetDiffsList = beatmapDiffsGroupBlock.querySelectorAll('.beatmaps-popup-item');
        const DiffsListDivs = this.convertLinksToDivsDOM(beatmapsetDiffsList);
        DiffsListDivs.forEach(diffItemDiv => {
            const beatmapId = diffItemDiv.getAttribute('href') ? diffItemDiv.getAttribute('href').split('/').pop() : 'Unknown';
            const beatmapListItem = diffItemDiv.querySelector('.beatmap-list-item');
            if (beatmapListItem) {
                const changeDiffInfoBtn = this.createChangeDiffInfoButton(beatmapId);
                beatmapListItem.appendChild(changeDiffInfoBtn);
                this.convertDiffNameDivToLink(beatmapListItem, diffItemDiv);

                changeDiffInfoBtn.addEventListener('click', () => {
                    callback(beatmapId);
                });
            } else {
                log('Не верный элемент', 'dev', 'error');
            }
        });
    }

    createChangeDiffInfoButton(beatmapId) {
        const changeDiffInfoBtn = document.createElement('button');
        changeDiffInfoBtn.classList.add('change-diff-info-button');
        changeDiffInfoBtn.textContent = `(ID: ${beatmapId})`;
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
        return document.querySelector(`.beatmapsets__item[mapsetId="${mapsetId}"]`);
    }

    getMapsetBlockByCurrentDiffDisplayed(beatmapId) {
        const mapsetBlock = document.querySelector(`.beatmapsets__item[beatmapId="${beatmapId}"]`);
        if (!mapsetBlock) {
            log(`Mapset block not found by beatmap id: ${beatmapId}`, 'dev', 'warning');
            return null;
        }
        return mapsetBlock;
    }
}

export default new DomHelper();
