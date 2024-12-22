import log from "/logger.js"
import OsuApi from "./IntermediateOsuApiService";

//TODO: Исправить ошибку с отслеживанием карт при возврате на страницу и перезагрузки скрипта

class DomHelper {
    constructor() {
        this.attemptsToCatchMaps = 5;
    }

    addUniqueElementToDOM(id) {
        if (!document.getElementById(id)) {
            const element = document.createElement('div');
            element.id = id;
            document.body.appendChild(element);
            log(`Элемент с ID "${id}" добавлен`, 'debug');
        } else {
            log(`Элемент с ID "${id}" уже существует`, 'dev', 'warn');
        }
    }

    catchMapsFromDom() {
        log('Вызвана функция catchMapsFromDom', 'debug');
        return new Promise((resolve, reject) => {
            const attemptToCatchMaps = () => {
                const beatmapsRows = document.getElementsByClassName('beatmapsets__items-row');
                if (beatmapsRows.length > 0) {
                    log('Получили карты', 'dev');
                    resolve(beatmapsRows);
                } else if (this.attemptsToCatchMaps > 1) {
                    log('Не удалось получить карты с DOM, повторяем попытку', 'dev', 'warn');
                    this.attemptsToCatchMaps--;
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
            moreDiffInfoBtn.addEventListener('click', async () => {
                await this.showDeepMapData(mapId, element, callback);
            });
            mapBlockLeftMenu.insertAdjacentElement('afterbegin', moreDiffInfoBtn);
        }
    }

    async showDeepMapData(mapId, element, callback) {
        log(mapId, 'debug');
        const existingTooltip = document.querySelector('.deep-map-params-tooltip');
        if (existingTooltip && parseInt(existingTooltip.mapId) === mapId) {
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

    displayTooltip(mapDiffDeepParams, mapId, element) {
        const existingTooltip = document.querySelector('.deep-map-params-tooltip');

        if (existingTooltip && parseInt(existingTooltip.mapId) === mapId) {
            existingTooltip.remove();
            return;
        }

        const tooltip = document.createElement('div');
        tooltip.classList.add('deep-map-params-tooltip');
        tooltip.innerText = mapDiffDeepParams;
        tooltip.mapId = mapId;

        const hideTooltip = () => {
            tooltip.remove();
            document.removeEventListener('click', hideTooltip);
            log('Подсказка убрана', 'dev');
        };

        element.before(tooltip);

        setTimeout(() => {
            document.addEventListener('click', hideTooltip);
        }, 0);
    }

    addChangeDiffInfoButtonsToDiffsList(beatmapDiffsGroup) {
        const links = beatmapDiffsGroup.querySelectorAll('.beatmaps-popup-item');
        this.convertLinksToDivs(links);

        const updatedLinks = beatmapDiffsGroup.querySelectorAll('.beatmaps-popup-item');
        updatedLinks.forEach(link => {
            const beatmapId = link.getAttribute('href') ? link.getAttribute('href').split('/').pop() : 'Unknown';
            const changeDiffInfoButt = `<button style="background: #711fff; border: 0; border-radius: 10px; margin-left: auto;">(ID: ${beatmapId})</button>`
            link.style.width = '100%';const beatmapListItem = link.querySelector('.beatmap-list-item');

            if (beatmapListItem) {
                beatmapListItem.style.display = 'flex';
                beatmapListItem.style.justifyContent = 'start';
                beatmapListItem.innerHTML += changeDiffInfoButt;

                const versionBlock = beatmapListItem.querySelector('.beatmap-list-item__version');
                if (versionBlock) {
                    const versionLink = document.createElement('a');
                    versionLink.href = link.getAttribute('href');
                    versionLink.className = 'u-ellipsis-overflow';
                    versionLink.innerHTML = versionBlock.innerHTML;
                    versionBlock.parentNode.replaceChild(versionLink, versionBlock);
                }
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
