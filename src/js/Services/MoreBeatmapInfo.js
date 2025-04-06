import OsuApiService from './IntermediateOsuApiService';
import cache from './CacheService';
import DomHelper from "./DomHelper";
import log from "@/js/logger.js";

const OsuApi = new OsuApiService;

class MoreBeatmapInfo {
    constructor(observer) {
        this.domObserver = observer;
    }

    initialize() {
        try {
            log('Attempting to call function setLastDiffInfoToMapsRows', 'dev');
            this.domObserver.startObserving(
                '.beatmapsets__items',
                (addedNodes) => this.setLastDiffInfoToBeatmapsRows(addedNodes),
                {childList: true, subtree: false}
            );

            this.domObserver.observeDynamicElement(
                '.beatmaps-popup__group',
                (dynamicElement) => this.processPopupGroupChanges(dynamicElement)
            );
        } catch (err) {
            log(err, 'dev', 'error');
            //throw new Error(`Failed to initialize More Beatmap Info`, {cause: err});
        }
    }

    setLastDiffInfoToBeatmapsRows(beatmapsBlocksRows) {
        DomHelper.setBeatmapsContainerIfNeeded();
        try {
            const beatmapsBlocks = this.flattenBeatmapRows(beatmapsBlocksRows);

            for (let i = 0; i < beatmapsBlocks.length; i += 2) {
                const chunk = beatmapsBlocks.slice(i, i + 2);
                this.setInfoToBeatmapBlocks(chunk);
            }
        } catch (err) {
            throw err;
        }
    }

    async setInfoToBeatmapBlocks(beatmapBlocks) {
        try {
            if (!Array.isArray(beatmapBlocks) || beatmapBlocks.length === 0) {
                throw new Error(`Invalid beatmapBlocks array "${beatmapBlocks}"`);
            }

            const { mapsetsIds, beatmapBlockMap } = this.prepareBeatmapBlocksForProcess(beatmapBlocks);
            const mapsetData = await OsuApi.getMapsetsData(mapsetsIds);

            this.applyMapsetDataToBlocks(beatmapBlockMap, mapsetData);
        } catch (error) {
            throw new Error(`Failed to set info to beatmap blocks: ${error.message}`);
        }
    }

    prepareBeatmapBlocksForProcess(beatmapBlocks) {
        const mapsetsIds = [];
        const beatmapBlockMap = new Map();

        for (const beatmapBlock of beatmapBlocks) {
            const mapsetId = this.preProcessBeatmapBlock(beatmapBlock);
            mapsetsIds.push(mapsetId);
            beatmapBlockMap.set(beatmapBlock, mapsetId);
        }

        return { mapsetsIds, beatmapBlockMap };
    }

    applyMapsetDataToBlocks(beatmapBlockMap, mapsetData) {
        for (const [beatmapBlock, mapsetId] of beatmapBlockMap) {
            if (mapsetData[mapsetId]) {
                this.mountInfoToBeatmapBlock(beatmapBlock, mapsetId, mapsetData[mapsetId]);
            }
        }
    }

    preProcessBeatmapBlock(beatmapBlock) {
        const mapsetId = DomHelper.getMapsetIdFromBlock(beatmapBlock);
        beatmapBlock.setAttribute('mapsetId', mapsetId);

        return mapsetId;
    }

    async mountInfoToBeatmapBlock(beatmapBlock, mapsetId, mapsetData) {
        try {
            const lastDiffData = this.getLastMapsetDiffInfo(mapsetData);
            this.processBeatmapBlock(beatmapBlock, mapsetId, lastDiffData);
            this.tryMountPPToBeatmapBlock(beatmapBlock, lastDiffData.id);
        } catch (error) {
            throw new Error(`Failed to mount info beatmapBlock: ${error}`);
        }
    }

    processBeatmapBlock(beatmapBlock, mapsetId, beatmapData) {
        if (!beatmapData || !beatmapData.id) {
            return this.handleMissingBeatmapData(beatmapBlock, mapsetId);
        }

        // Mechanism for handling the absence of a reference to the DOM element
        // due to a complex issue with element loading.
        // For more details, refer to notes.txt under "Note about data processing in the class"
        if (!document.contains(beatmapBlock)) {
            beatmapBlock = document.querySelector(`[mapsetId="${mapsetId}"]`);
            log(`Переполучаем ${mapsetId}`, 'debug');
        }

        if (beatmapBlock) {
            beatmapBlock.setAttribute('mapsetId', mapsetId);
            beatmapBlock.setAttribute('beatmapId', beatmapData.id);
            const mapDiffInfoString = this.createBeatmapParamsAsString(beatmapData);

            DomHelper.mountBeatmapInfoToBlock(beatmapBlock, mapsetId, mapDiffInfoString);
            if (beatmapData.mode === 'osu') {
                DomHelper.addDeepInfoButtonToBeatmap(beatmapBlock, (block) => this.handleDeepInfoBtnClick(block));
            }
            this.setBeatmapPPReceivingToBlock(beatmapBlock, beatmapData.id);
        } else {
            log(`Не удалось найти beatmapBlock в DOM ${mapsetId}`, 'debug', 'warn');
        }
    }

    async tryMountPPToBeatmapBlock(beatmapBlock, beatmapId) {
        const beatmapPPData = await OsuApi.tryGetCachedBeatmapPP(beatmapId);
        if (beatmapPPData) DomHelper.mountPPForBeatmapBlock(beatmapBlock, beatmapPPData.pp);
    }

    processPopupGroupChanges(beatmapDiffsGroup) {
        log(beatmapDiffsGroup, 'debug');
        DomHelper.addChangeInfoButtonsToMapsetDiffsList(beatmapDiffsGroup, (beatmapId) => {
            this.handleChangeInfoDiffClick(beatmapId);
        });
    }

    /**
     * This method can be triggered in case there is an error retrieving mapsets data from the server.
     * It will add a retry button inside the beatmap block, where the information was supposed to be displayed.
     */

    handleMissingBeatmapData(beatmapBlock, mapsetId) {
        beatmapBlock.setAttribute('mapsetId', mapsetId);
        const failedInfoBlock = document.createElement('div');
        failedInfoBlock.textContent = 'Failed to get beatmap data';
        const retryGetInfoBtn = DomHelper.createRetryGetInfoBtn();
        failedInfoBlock.appendChild(retryGetInfoBtn);

        DomHelper.mountBeatmapInfoToBlock(beatmapBlock, mapsetId, failedInfoBlock);

        retryGetInfoBtn.addEventListener('click', async () => {
            try {
                await this.setInfoToBeatmapBlocks(beatmapBlock);
                failedInfoBlock.remove();
            } catch (error) {
                log(`Error processing beatmap block: ${error}`, 'dev', 'error');
            }
        });
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
                const beatmapCalcData = await OsuApi.getCalculatedBeatmapData(beatmapId);
                DomHelper.mountPPForBeatmapBlock(beatmapBlock, beatmapCalcData.pp);
                log(beatmapCalcData, 'debug');
                const deepBeatmapDataAsString = this.createBeatmapDifficultyParamsString(beatmapCalcData.difficulty);
                DomHelper.displayTooltip(deepBeatmapDataAsString, beatmapId, beatmapBlock);
            } catch (error) {
                log(`Error fetching beatmap data: ${error.message}`, 'dev', 'error');
            }
        }
    }

    setBeatmapPPReceivingToBlock(beatmapBlock, beatmapId) {
        const beatmapPPBlock = beatmapBlock.querySelector('.pp-block');
        if (!beatmapPPBlock) {
            const beatmapNameBlock = beatmapBlock.querySelector('.beatmapset-panel__info').firstElementChild;
            beatmapNameBlock.innerHTML += `<div class="pp-block"></div>`;
        }

        const cachedBeatmapPP = cache.getBeatmap(beatmapId);
        if (cachedBeatmapPP) {
            DomHelper.mountPPForBeatmapBlock(beatmapBlock, cachedBeatmapPP.pp);
        } else {
            DomHelper.mountPPButton(beatmapBlock, (beatmapBlock) => {
                this.handleGetPPBtnClick(beatmapBlock, beatmapId);
            });
        }
    }

    async handleGetPPBtnClick(beatmapBlock, beatmapId) {
        const beatmapPP = await OsuApi.getCalculatedBeatmapData(beatmapId);
        DomHelper.mountPPForBeatmapBlock(beatmapBlock, beatmapPP.pp);
    }

    createBeatmapDifficultyParamsString(beatmapData) {
        const {
            aim, speed, nCircles, nSliders, speedNoteCount, flashlight
        } = beatmapData;

        return [
            `Aim diff: ${aim.toFixed(1)}`,
            `Speed diff: ${speed.toFixed(1)}`,
            `Circles: ${nCircles}`,
            `Sliders: ${nSliders}`,
            `Speed note count: ${speedNoteCount.toFixed(1)}`,
            `FL Diff: ${flashlight.toFixed(2)}`,
        ].join(', ');
    }

    flattenBeatmapRows(beatmapsBlocksRows) {
        log(beatmapsBlocksRows, 'debug');
        return Array.from(beatmapsBlocksRows)
            .flatMap(row => Array.from(row.querySelectorAll('.beatmapsets__item')))
            .flat();
    }

    createBeatmapParamsAsString(beatmapData) {
        return `<div class="more-beatmap-info">
        ${beatmapData.difficulty_rating}★
        bpm ${beatmapData.bpm}
        combo ${beatmapData.max_combo}
        ar ${beatmapData.ar}
        cs ${beatmapData.cs}
        od ${beatmapData.accuracy}
        hp ${beatmapData.drain}`;
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
        const numericBeatmapId = this.convertToNumericBeatmapId(beatmapId);
        if (this.isBeatmapInfoAlreadyDisplayed(numericBeatmapId)) return;
        const beatmapInfo = cache.getBeatmapInfoByIdFromMapsetsCache(numericBeatmapId);
        if (!beatmapInfo) {
            return this.handleMissingBeatmapInfo(numericBeatmapId);
        }
        const beatmapBlock = DomHelper.getMapsetBlockById(beatmapInfo.mapsetId);
        this.updateBeatmapInfoDOM(beatmapInfo.map, beatmapBlock);
        this.setBeatmapPPReceivingToBlock(beatmapBlock, beatmapId);
        DomHelper.updateBeatmapIdBtn(beatmapId, beatmapInfo.mapsetId);
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

    handleMissingBeatmapInfo(numericBeatmapId) {
        log('Beatmap info not found, reloading extension...', 'dev');
        this.reloadExtensionEvent();

        setTimeout(() => {
            const retryBeatmapInfo = cache.getBeatmapInfoByIdFromMapsetsCache(numericBeatmapId);
            if (retryBeatmapInfo) {
                log(retryBeatmapInfo, 'debug');
                const beatmapBlock = DomHelper.getMapsetBlockById(retryBeatmapInfo.mapsetId);
                this.updateBeatmapInfoDOM(retryBeatmapInfo.map, beatmapBlock);
                DomHelper.updateBeatmapIdBtn(numericBeatmapId, retryBeatmapInfo.mapsetId);
            } else {
                log('Unable to fetch beatmap info after reload in 1.3 sec\nProbably bad internet connection',
                    'dev', 'error');
            }
        }, 1300);
    }

    updateBeatmapInfoDOM(beatmapInfo, beatmapBlock) {
        const diffInfoBlock = beatmapBlock.querySelector('.more-beatmap-info-block');
        const diffInfoString = this.createBeatmapParamsAsString(beatmapInfo);
        log(diffInfoBlock, 'debug');
        if (diffInfoBlock) {
            diffInfoBlock.innerHTML = diffInfoString;
        }
    }

    reloadExtensionEvent() {
        const event = new CustomEvent('reloadExtensionRequested');
        window.dispatchEvent(event);
    }
}

export default MoreBeatmapInfo;
