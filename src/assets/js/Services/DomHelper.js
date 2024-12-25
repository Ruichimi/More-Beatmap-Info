import log from "/logger.js"
import OsuApi from "./IntermediateOsuApiService";

class DomHelper {
    constructor() {
        this.attemptsToCatchMaps = 5;
        this.createdElementId = null;
    }

    addUniqueElementToDOM(id) {
        if (!document.getElementById(id)) {
            const element = document.createElement('div');
            element.id = id;
            document.body.appendChild(element);
            this.createdElementId = id;
            log(`Элемент с ID "${id}" добавлен`, 'debug');
        } else {
            log(`Элемент с ID "${id}" уже существует`, 'dev', 'warn');
        }
    }

    removeUniqueElementFromDOM() {
        if (this.createdElementId && document.getElementById(this.createdElementId)) {
            const element = document.getElementById(this.createdElementId);
            element.remove();
            log(`Элемент с ID "${this.createdElementId}" удалён`, 'debug');
            this.createdElementId = null;
        } else {
            log('Элемент не найден для удаления', 'dev', 'warn');
        }
    }

    clearDOM() {
        const elementsToRemove = [
            ...document.querySelectorAll('.last-diff-info'),
            ...document.querySelectorAll('.more-diff-info-btn')
        ];

        elementsToRemove.forEach(element => element.remove());
        this.removeUniqueElementFromDOM();
    }

    catchMapsFromDom() {
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

    addDeepInfoButtonToMap(element, mapId, gameMode, callback) {
        log(`Add deep info button to map: ${mapId}`, 'debug');
        if (gameMode === 'osu') {
            log('game mode is osu, adding a button...', 'full');
            const mapBlockLeftMenu = element.querySelector('.beatmapset-panel__menu');
            const moreDiffInfoBtn = document.createElement('button');
            moreDiffInfoBtn.classList.add('more-diff-info-btn');
            moreDiffInfoBtn.innerText = '...';
            element.mapId = mapId;
            moreDiffInfoBtn.addEventListener('click', async () => {
                await this.showDeepMapData(element, callback);
            });
            mapBlockLeftMenu.insertAdjacentElement('afterbegin', moreDiffInfoBtn);
        }
    }

    updateButtonMapId(newMapId, mapId) {
        const beatmapBlock = document.getElementById(`mapset-id:${mapId}`);
        beatmapBlock.mapId = newMapId;
        log(beatmapBlock.mapId, 'debug');
    }

    async showDeepMapData(element, callback) {
        const existingTooltip = document.querySelector('.deep-map-params-tooltip');
        const mapId = element.mapId;
        log(mapId, 'debug');
        log('Show deep beatmap data button has pressed', 'debug');
        log(`Is tooltip already exists: ${existingTooltip ? 'yes' : 'no'}`, 'debug');
        if (existingTooltip && existingTooltip.mapId === mapId) {
            log('Tooltip was removed', 'dev');
            existingTooltip.remove();
            return;
        }

        try {
            const deepLastDiffData = await OsuApi.getBeatmapData(mapId);
            const mapDiffDeepParams = callback(deepLastDiffData);
            this.displayTooltip(mapDiffDeepParams, mapId, element);
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
    displayTooltip(mapDiffDeepParams, mapId, element) {
        const tooltip = document.createElement('div');
        tooltip.classList.add('deep-map-params-tooltip');
        tooltip.innerText = mapDiffDeepParams;
        tooltip.mapId = mapId;
        const hideTooltip = () => {
            tooltip.remove();
            document.removeEventListener('click', hideTooltip);
            log('Tooltip was removed because of click on the page', 'dev');
        };

        element.before(tooltip);

        setTimeout(() => {
            document.addEventListener('click', hideTooltip);
        }, 0);
    }

    addChangeDiffInfoButtonsToDiffsList(beatmapDiffsGroup, callback) {
        const links = beatmapDiffsGroup.querySelectorAll('.beatmaps-popup-item');
        this.convertLinksToDivs(links);
        const updatedLinks = beatmapDiffsGroup.querySelectorAll('.beatmaps-popup-item');
        updatedLinks.forEach(link => {
            const beatmapId = link.getAttribute('href') ? link.getAttribute('href').split('/').pop() : 'Unknown';
            const beatmapListItem = link.querySelector('.beatmap-list-item');

            if (beatmapListItem) {
                const changeDiffInfoButton = document.createElement('button');
                changeDiffInfoButton.classList.add('change-diff-info-button');
                changeDiffInfoButton.textContent = `(ID: ${beatmapId})`;
                beatmapListItem.appendChild(changeDiffInfoButton);
                const versionBlock = beatmapListItem.querySelector('.beatmap-list-item__version');

                if (versionBlock) {
                    const versionLink = document.createElement('a');
                    versionLink.className = 'u-ellipsis-overflow';
                    versionLink.href = link.getAttribute('href');
                    versionLink.innerHTML = versionBlock.innerHTML;
                    versionBlock.parentNode.replaceChild(versionLink, versionBlock);
                }
                changeDiffInfoButton.addEventListener('click', () => {
                    callback(beatmapId);
                });
            } else {
                log('Не верный элемент', 'dev', 'error');
            }
        });
    }

    convertLinksToDivs(links) {
        links.forEach(link => {
            const href = link.getAttribute('href');
            const div = document.createElement('div');
            div.className = link.className;
            div.innerHTML = link.innerHTML;
            for (const attr of link.attributes) {
                if (attr.name !== 'href') {
                    div.setAttribute(attr.name, attr.value);
                }
            }
            if (href) {
                div.setAttribute('href', href);
            }
            link.parentNode.replaceChild(div, link);
        });
    }
}

export default new DomHelper();
