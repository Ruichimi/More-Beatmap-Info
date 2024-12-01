import OsuApi from './IntermediateOsuApiService';
import DOMObserver from "./DOMObserver";
import log from "/logger";

class LastDiffInfo {
    constructor() {
        this.mountedItemsAmount = 0;
        this.domObserver = new DOMObserver();
    }

    initialize() {
        this.domObserver.startObserving(
            '.beatmapsets__items',
            (addedNodes, targetSelector) => this.handleMutations(addedNodes, targetSelector),
            { childList: true, subtree: true }
        );

        this.domObserver.observeDynamicElement(
            '.beatmaps-popup__group', // Класс для поиска
            (dynamicElement) => this.processPopupGroupChanges(dynamicElement) // Обработчик найденного элемента
        );

        this.addUniqueElementToDOM('last-diff-info');

        this.catchMapsFromDom(5)
            .then(beatmapsRows => {
                log('Пытаемся вызвать setLastDiffInfoToMapsRows', 'dev');
                if (beatmapsRows) {
                    this.setLastDiffInfoToMapsRows(beatmapsRows);
                }
            })
            .catch(error => {
                log(`Произошла ошибка, не удалось загрузить карты со страницы: ${error}`, 'prod', 'error');
            });
    }

    processPopupGroupChanges(beatmapDiffsGroup) {
        log(beatmapDiffsGroup, 'dev');

        const links = beatmapDiffsGroup.querySelectorAll('.beatmaps-popup-item');
        links.forEach(link => {
            const beatmapId = link.href.split('/').pop(); // Берём последний элемент URL
            link.innerHTML += ` (ID: ${beatmapId})`;
        });
    }

    handleMutations(addedNodes, targetSelector) {
        if (targetSelector === '.beatmapsets__items') {
            this.setLastDiffInfoToMapsRows(addedNodes);
        }

        if (targetSelector === '.beatmaps-popup__group') {
            this.processPopupGroupChanges(addedNodes);
        }
    }

    catchMapsFromDom(attempts) {
        log('Вызвана функция catchMapsFromDom', 'debug');
        return new Promise((resolve, reject) => {
            const attemptToCatchMaps = () => {
                const beatmapsRows = document.getElementsByClassName('beatmapsets__items-row');
                if (beatmapsRows.length > 0) {
                    log('Получили карты', 'dev');
                    resolve(beatmapsRows);
                } else if (attempts > 1) {
                    log('Не удалось получить карты с DOM, повторяем попытку', 'dev', 'warn');
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

    addUniqueElementToDOM(id) {
        if (!document.getElementById(id)) {
            const element = document.createElement('div');
            element.id = id;
            document.body.appendChild(element);
            log(`Элемент с ID "${id}" добавлен.`, 'debug');
        } else {
            log(`Элемент с ID "${id}" уже существует.`, 'dev', 'warn');
        }
    }

    setLastDiffInfoToMapsRows(beatmapsBlocksRows) {
        const beatmapsBlocks = this.flattenBeatmapRows(beatmapsBlocksRows);

        beatmapsBlocks.map(async (element) => {
            const mapsetId = this.getMapsetId(element);
            const mapsetData = await OsuApi.getMapsetData(mapsetId);
            const lastDiffData = this.getLastMapsetDiffInfo(mapsetData);
            log(`Информация о последней сложности:\n${JSON.stringify(lastDiffData, null, 2)}\n_____________`, 'debug');

            let mapParamsString;
            if (lastDiffData.mode === 'osu') {
                const mapBlockLeftMenu = element.querySelector('.beatmapset-panel__menu');
                const moreDiffInfoBtn = document.createElement('button');
                moreDiffInfoBtn.classList.add('more-diff-info-btn');
                moreDiffInfoBtn.innerText = '...';
                moreDiffInfoBtn.addEventListener('click', () => {
                    this.showDeepMapData(lastDiffData.id, element);
                });
                mapBlockLeftMenu.insertAdjacentElement('afterbegin', moreDiffInfoBtn);
            }
            mapParamsString = this.createMapParamsString(lastDiffData);
            this.createInfoBlock(element, mapParamsString, mapsetId);
            this.mountedItemsAmount+= 1;
        });
    }

    async showDeepMapData(mapId, element) {
        log(mapId, 'dev');
        const existingTooltip = document.querySelector('.deep-map-params-tooltip');
        if (existingTooltip && parseInt(existingTooltip.mapId) === mapId) {
            existingTooltip.remove();
            return;
        }
        const deepLastDiffData = await OsuApi.getBeatmapData(mapId);
        const mapDiffDeepParams = this.createBeatmapDifficultyParamsString(deepLastDiffData);
        this.displayTooltip(mapDiffDeepParams, mapId, element);
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

    flattenBeatmapRows(beatmapsBlocksRows) {
        return Array.from(beatmapsBlocksRows)
            .flatMap(row => Array.from(row.querySelectorAll('.beatmapsets__item')))
            .flat();
    }

    getMapsetId(element) {
        const href = element.querySelector('a').getAttribute('href');
        const match = href.match(/\/(\d+)$/);
        return match ? match[1] : null;
    }

    createMapParamsString(lastDiffData) {
        return `<div class="last-diff-info">
        ${lastDiffData.difficulty_rating}★
        bpm ${lastDiffData.bpm}
        combo ${lastDiffData.max_combo}
        od ${lastDiffData.accuracy}
        ar ${lastDiffData.ar}
        cs ${lastDiffData.cs}
        hp ${lastDiffData.drain}`;
    }


    createInfoBlock(element, mapParamsString) {
        const infoBlock = document.createElement('div');
        infoBlock.classList.add('last-diff-info');
        const statsRow = element.querySelector('.beatmapset-panel__info-row--stats');
        statsRow.parentNode.insertBefore(infoBlock, statsRow.nextSibling);
        infoBlock.innerHTML = mapParamsString;
        return infoBlock;
    }

    getLastMapsetDiffInfo(mapsetData) {
        if (!mapsetData || !mapsetData.beatmaps || mapsetData.beatmaps.length === 0) {
            return null;
        }

        return mapsetData.beatmaps.reduce((maxDiff, currentMap) => {
            return currentMap.difficulty_rating > maxDiff.difficulty_rating ? currentMap : maxDiff;
        }, mapsetData.beatmaps[0]);
    }

    createBeatmapDifficultyParamsString(beatmapData) {
        const {
            aim_difficulty, speed_difficulty, speed_note_count, slider_factor, overall_difficulty
        } = beatmapData;

        return [
            `Aim diff: ${aim_difficulty.toFixed(1)}`,
            `Speed diff: ${speed_difficulty.toFixed(1)}`,
            `Speed note count: ${speed_note_count.toFixed(1)}`,
            `Slider factor: ${slider_factor.toFixed(1)}`,
            `Overall diff: ${overall_difficulty.toFixed(1)}`
        ].join(', ');
    }
}

export default new LastDiffInfo();
