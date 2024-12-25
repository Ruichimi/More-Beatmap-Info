import log from "/logger.js"
import OsuApi from "./IntermediateOsuApiService";

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
            ...document.querySelectorAll('.last-diff-info'),
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

    addDeepInfoButtonToBeatmap(beatmapBlock, mapId, gameMode, callback) {
        log(`Add deep info button to map: ${mapId}`, 'debug');
        if (gameMode === 'osu') {
            const beatmapBlockRightMenu = beatmapBlock.querySelector('.beatmapset-panel__menu');
            const moreDiffInfoBtn = document.createElement('button');
            moreDiffInfoBtn.classList.add('more-diff-info-btn');
            moreDiffInfoBtn.innerText = '...';
            beatmapBlock.beatmapDeepInfoId = mapId;
            moreDiffInfoBtn.addEventListener('click', async () => {
                await this.showDeepBeatmapData(beatmapBlock, callback);
            });
            beatmapBlockRightMenu.insertAdjacentElement('afterbegin', moreDiffInfoBtn);
        }
    }

    updateMapIdBtn(newBeatmapId, beatmapId) {
        const beatmapBlock = document.getElementById(`mapset-id:${beatmapId}`);
        beatmapBlock.beatmapDeepInfoId = newBeatmapId;
        log(beatmapBlock.beatmapDeepInfoId, 'debug');
    }

    async showDeepBeatmapData(beatmapBlock, callback) {
        const existingTooltip = document.querySelector('.deep-beatmap-params-tooltip');
        const beatmapId = beatmapBlock.beatmapDeepInfoId;
        log('Show deep beatmap data button has pressed', 'debug');
        log(`Is tooltip already exists: ${existingTooltip ? 'yes' : 'no'}`, 'debug');
        if (existingTooltip && existingTooltip.beatmapId === beatmapId) {
            log('Tooltip was removed', 'dev');
            existingTooltip.remove();
            return;
        }

        try {
            const deepLastDiffData = await OsuApi.getBeatmapData(beatmapId);
            const beatmapDeepParams = callback(deepLastDiffData);
            this.displayTooltip(beatmapDeepParams, beatmapId, beatmapBlock);
        } catch (error) {
            log(`Error fetching beatmap data: ${error.message}`, 'dev', 'error');
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

    convertDiffNameDivToLink(beatmapListItem, diffItemDiv) {
        const diffNameBlock = beatmapListItem.querySelector('.beatmap-list-item__version');
        log(diffNameBlock, 'debug');

        if (diffNameBlock) {
            const biffNameAsLink = document.createElement('a');
            biffNameAsLink.href = diffItemDiv.getAttribute('href');
            biffNameAsLink.innerHTML = diffNameBlock.innerHTML;
            diffNameBlock.parentNode.replaceChild(biffNameAsLink, diffNameBlock);
        }
    }
}

export default new DomHelper();
