import OsuApi from './IntermediateOsuApiService';
import DomHelper from "./DomHelper";
import log from "/logger";
import IntermediateOsuApiService from "./IntermediateOsuApiService";

//TODO: Проверять необходимость обновления информации и по возможности её обновление после перезагрузки расширения

class LastDiffInfo {
    constructor(observer) {
        this.domObserver = observer;
    }

    initialize() {
        DomHelper.catchMapsFromDom()
            .then(beatmapsRows => {
                log('Пытаемся вызвать setLastDiffInfoToMapsRows', 'dev');
                if (beatmapsRows) {
                    this.setLastDiffInfoToMapsRows(beatmapsRows);
                }
                this.domObserver.startObserving(
                    '.beatmapsets__items',
                    (addedNodes) => this.setLastDiffInfoToMapsRows(addedNodes),
                    { childList: true, subtree: true }
                );

                this.domObserver.observeDynamicElement(
                    '.beatmaps-popup__group',
                    (dynamicElement) => this.processPopupGroupChanges(dynamicElement)
                );
            })
            .catch(error => {
                log(`Произошла ошибка, не удалось загрузить карты со страницы: ${error}`, 'prod', 'error');
            });
    }

    processPopupGroupChanges(beatmapDiffsGroup) {
        log(beatmapDiffsGroup, 'dev');
        DomHelper.addChangeDiffInfoButtonsToDiffsList(beatmapDiffsGroup, (beatmapId) => {
            this.handleChangeInfoDiffClick(beatmapId);
        });
    }

    setLastDiffInfoToMapsRows(beatmapsBlocksRows) {
        const beatmapsBlocks = this.flattenBeatmapRows(beatmapsBlocksRows);

        beatmapsBlocks.map(async (element) => {
            const mapsetId = this.getMapsetId(element);
            const mapsetData = await OsuApi.getMapsetData(mapsetId);
            const lastDiffData = this.getLastMapsetDiffInfo(mapsetData);
            log(`Информация о последней сложности:\n${JSON.stringify(lastDiffData, null, 2)}\n_____________`, 'debug');
            DomHelper.addDeepInfoButtonToMap(element, lastDiffData.id, lastDiffData.mode, (deepLastDiffData) => {
                return this.createBeatmapDifficultyParamsString(deepLastDiffData);
            });
            const mapDiffInfoString = this.createMapParamsString(lastDiffData);
            this.insertInfoToBeatmapBlock(element, mapDiffInfoString, mapsetId);
        });
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

    insertInfoToBeatmapBlock(element, mapDiffInfoString, mapsetId) {
        const infoBlock = document.createElement('div');
        infoBlock.classList.add('last-diff-info-block');
        infoBlock.id = mapsetId;
        const statsRow = element.querySelector('.beatmapset-panel__info-row--stats');
        statsRow.parentNode.insertBefore(infoBlock, statsRow.nextSibling);
        infoBlock.innerHTML = mapDiffInfoString;
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

    /**
     * Handles the click to change diff info for a given beatmapId, in beatmap card in DOM.
     * Converts and validates the `beatmapId`, retrieves the diff info from cache,
     * and updates the display or reloads the extension if not found. For example, if cache was cleaned.
     *
     * @param beatmapId {string|int}
     * @returns {void}
     */

    handleChangeInfoDiffClick(beatmapId) {
        const numericBeatmapId = parseInt(beatmapId, 10);
        if (isNaN(numericBeatmapId)) {
            log(`Invalid beatmapId: ${beatmapId}`, 'dev', 'error');
            return;
        }
        const beatmapInfo = IntermediateOsuApiService.getDiffInfoByIdFromCache(numericBeatmapId);
        if (!beatmapInfo) {
            log(beatmapInfo, 'dev');
            this.reloadExtensionEvent();
            return;
        }
        log(beatmapInfo, 'debug');
        this.updateBeatmapInfoDOM(beatmapInfo.map, beatmapInfo.mapsetId);
    }

    updateBeatmapInfoDOM(beatmapInfo, mapsetId) {
        const diffInfoString = this.createMapParamsString(beatmapInfo);
        const beatmapBlock = document.getElementById(mapsetId);
        if (beatmapBlock) {
            beatmapBlock.innerHTML = diffInfoString;
        }
    }

    reloadExtensionEvent() {
        const event = new CustomEvent('reloadExtensionRequested');
        window.dispatchEvent(event);
    }
}

export default LastDiffInfo;
