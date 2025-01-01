import OsuApi from './IntermediateOsuApiService';
import DomHelper from "./DomHelper";
import log from "/logger";
import IntermediateOsuApiService from "./IntermediateOsuApiService";
import domHelper from "./DomHelper";

//TODO: Оптимизировать обращения к DOM

class MoreBeatmapInfo {
    constructor(observer) {
        this.domObserver = observer;
    }

    initialize() {
        DomHelper.catchBeatmapsFromDOM()
            .then(beatmapsRows => {
                log('Пытаемся вызвать setLastDiffInfoToMapsRows', 'dev');
                if (beatmapsRows) {
                    this.setLastDiffInfoToMapsRows(beatmapsRows);
                }
                this.domObserver.startObserving(
                    '.beatmapsets__items',
                    (addedNodes) => this.setLastDiffInfoToMapsRows(addedNodes),
                    {childList: true, subtree: false}
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

    async setLastDiffInfoToMapsRows(beatmapsBlocksRows) {
        const beatmapsBlocks = this.flattenBeatmapRows(beatmapsBlocksRows);
        for (const beatmapBlock of beatmapsBlocks) {
            try {
                const mapsetId = this.getMapsetId(beatmapBlock);
                const mapsetData = await OsuApi.getMapsetData(mapsetId);
                const lastDiffData = this.getLastMapsetDiffInfo(mapsetData);

                beatmapBlock.setAttribute('mapsetId', mapsetId);
                beatmapBlock.setAttribute('beatmapId', lastDiffData.id);
                log(`Информация о последней сложности:\n${JSON.stringify(lastDiffData, null, 2)}\n_____________`, 'debug');

                if (lastDiffData.mode === 'osu') {
                    DomHelper.addDeepInfoButtonToBeatmap(beatmapBlock, (beatmapBlock) => {
                        this.handleDeepInfoBtnClick(beatmapBlock);
                    });
                }

                const mapDiffInfoString = this.createMapParamsString(lastDiffData);
                this.insertInfoToBeatmapBlock(beatmapBlock, mapDiffInfoString, mapsetId);
                this.setBeatmapPPReceivingToBlock(beatmapBlock, lastDiffData.id);
            } catch (error) {
                log(`Произошла ошибка при обработке beatmapBlock: ${error}`, 'prod', 'error');
            }
        }
    }

    async handleDeepInfoBtnClick(beatmapBlock) {
        log(`Handling deep info button for block: ${beatmapBlock}`, 'debug');
        const beatmapId = beatmapBlock.getAttribute('beatmapId');
        log(`Deep beatmapData initialized for: ${beatmapId}`, 'debug');
        const existingDeepInfoTooltip = DomHelper.getExistingDeepInfoTooltip(beatmapId);
        if (existingDeepInfoTooltip) {
            existingDeepInfoTooltip.remove();
        } else {
            try {
                const beatmapPP = await OsuApi.getBeatmapPP(beatmapId);
                DomHelper.mountPPForBeatmapBlock(beatmapBlock, beatmapId, beatmapPP);
                const deepLastDiffData = await OsuApi.getBeatmapData(beatmapId);
                const deepLastDiffDataAsString = this.createBeatmapDifficultyParamsString(deepLastDiffData);
                DomHelper.displayTooltip(deepLastDiffDataAsString, beatmapId, beatmapBlock);
            } catch (error) {
                log(`Error fetching beatmap data: ${error.message}`, 'dev', 'error');
            }
        }
    }

    setBeatmapPPReceivingToBlock(beatmapBlock, beatmapId) {
        if (beatmapBlock.querySelector('.beatmap-pp-btn') || beatmapBlock.querySelector('.beatmap-pp-block')) {
            return;
        }
        const cachedBeatmapPP = IntermediateOsuApiService.getBeatmapPPFromCache(beatmapId);
        if (cachedBeatmapPP) {
            domHelper.mountPPForBeatmapBlock(beatmapBlock, beatmapId, cachedBeatmapPP.pp);
        } else {
            domHelper.mountPPButton(beatmapBlock, beatmapId, async (beatmapBlock) => {
                const beatmapPP = await OsuApi.getBeatmapPP(beatmapId);
                domHelper.mountPPForBeatmapBlock(beatmapBlock, beatmapId, beatmapPP)
            });
        }
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
        log(beatmapsBlocksRows, 'debug');
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
        return `<div class="more-beatmap-info">
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
        infoBlock.classList.add('more-beatmap-info-block');
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

    async handleChangeInfoDiffClick(beatmapId) {
        if (this.isBeatmapInfoAlreadyDisplayed(beatmapId)) return;

        const numericBeatmapId = this.convertToNumericBeatmapId(beatmapId);
        const beatmapInfo = this.getBeatmapInfoFromCache(numericBeatmapId);
        if (!beatmapInfo) {
            this.handleMissingBeatmapInfo(numericBeatmapId);
            return;
        }

        this.updateBeatmapInfoDOM(beatmapInfo.map, beatmapInfo.mapsetId);
        await this.updatePPBlockForNewBeatmapId(beatmapInfo.mapsetId, beatmapId);
        DomHelper.updateBeatmapIdBtn(beatmapId, beatmapInfo.mapsetId);
    }

    async updatePPBlockForNewBeatmapId(mapsetId, beatmapId) {
        console.log(`updating PP for beatmap set: ${mapsetId} to beatmap: ${beatmapId}`);
        const beatmapBlock = DomHelper.getMapsetBlockById(mapsetId);
        const beatmapPP = await OsuApi.getBeatmapPP(beatmapId);
        DomHelper.mountPPForBeatmapBlock(beatmapBlock, beatmapId, beatmapPP);
    }

    convertToNumericBeatmapId(beatmapId) {
        const numericBeatmapId = parseInt(beatmapId, 10);
        if (isNaN(numericBeatmapId)) {
            log(`Invalid beatmapId: ${beatmapId}`, 'dev', 'error');
        }
        return numericBeatmapId;
    }

    isBeatmapInfoAlreadyDisplayed(beatmapId) {
        const mapsetBlock = DomHelper.getMapsetBlockByCurrentDiffDisplayed(beatmapId);
        if (mapsetBlock) {
            log('A block already contains current info', 'dev');
            return true;
        }
        return false;
    }

    getBeatmapInfoFromCache(numericBeatmapId) {
        return IntermediateOsuApiService.getDiffInfoByIdFromCache(numericBeatmapId);
    }

    handleMissingBeatmapInfo(numericBeatmapId) {
        log('Beatmap info not found, reloading extension...', 'dev');
        this.reloadExtensionEvent();

        setTimeout(() => {
            const retryBeatmapInfo = IntermediateOsuApiService.getDiffInfoByIdFromCache(numericBeatmapId);
            if (retryBeatmapInfo) {
                log(retryBeatmapInfo, 'debug');
                this.updateBeatmapInfoDOM(retryBeatmapInfo.map, retryBeatmapInfo.mapsetId);
                DomHelper.updateBeatmapIdBtn(numericBeatmapId, retryBeatmapInfo.mapsetId);
            } else {
                log('Unable to fetch beatmap info after reload in 1.3 sec\nProbably bad internet connection',
                    'dev', 'error');
            }
        }, 1300);
    }

    updateBeatmapInfoDOM(beatmapInfo, mapsetId) {
        const diffInfoString = this.createMapParamsString(beatmapInfo);
        const beatmapBlock = document.getElementById(mapsetId);
        log(beatmapBlock, 'debug');
        if (beatmapBlock) {
            beatmapBlock.innerHTML = diffInfoString;
        }
    }

    reloadExtensionEvent() {
        const event = new CustomEvent('reloadExtensionRequested');
        window.dispatchEvent(event);
    }
}

export default MoreBeatmapInfo;
