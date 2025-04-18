import OsuApiService from './IntermediateOsuApiService';
import cache from './CacheService';
import DomHelper from "./DomHelper";
import log from "@/js/logger.js";
import BeatmapProcessor from "./BeatmapBlockProcessor";

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
                (addedNodes) => this.processBeatmapsBlocks(addedNodes),
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

    processBeatmapsBlocks(beatmapsBlocksRows, single = false) {
        const beatmapsChunks = BeatmapProcessor.getBeatmapsChunks(beatmapsBlocksRows, single);
        beatmapsChunks.forEach(async (chunk) => {
            const {mapsetsIds, beatmapBlockMap} =
                BeatmapProcessor.prepareBeatmapBlocksForProcess(chunk);

            await OsuApi.getMapsetsData(mapsetsIds, (beatmapData) => {
                let beatmapMap = new Map().set(Object.keys(beatmapData)[0],
                    beatmapBlockMap.get(Object.keys(beatmapData)[0]));
                this.applyMapsetDataToBlocks(beatmapMap, beatmapData);
            }, (failedBeatmapId) => {
                const uncaughtBeatmapBlock = beatmapBlockMap.get(failedBeatmapId);
                this.handleMissingBeatmapData(uncaughtBeatmapBlock);
            });
        });
    }

    applyMapsetDataToBlocks(beatmapBlockMap, mapsetsData) {
        for (const [mapsetId, beatmapBlock] of beatmapBlockMap) {
            if (mapsetsData[mapsetId]) {
                const lastDiffData = this.getLastMapsetDiffInfo(mapsetsData[mapsetId]);
                if (lastDiffData && lastDiffData.id) {
                    BeatmapProcessor.processBeatmapBlock(beatmapBlock, mapsetId, lastDiffData,
                        (beatmapBlock) => this.handleDeepInfoBtnClick(beatmapBlock, lastDiffData.id)
                    );
                    this.trySetBeatmapPPToBlock(beatmapBlock, lastDiffData.id);
                } else {
                    this.handleMissingBeatmapData(beatmapBlock);
                }
            } else {
                this.handleMissingBeatmapData(beatmapBlock);
            }
        }
    }

    async trySetBeatmapPPToBlock(beatmapBlock, beatmapId) {
        const beatmapPPData = await OsuApi.tryGetCachedBeatmapPP(beatmapId);
        BeatmapProcessor.setPPToBeatmapBlock(beatmapBlock, beatmapId,
            (beatmapBlock) => this.setPPToBeatmapBlockAndReturnData(beatmapBlock, beatmapId), beatmapPPData);
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

    handleMissingBeatmapData(beatmapBlock) {
        BeatmapProcessor.setBeatmapBlockFailed(beatmapBlock, async () => {
            try {
                await this.processBeatmapsBlocks(beatmapBlock, true);
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
                const beatmapCalcData = await this.setPPToBeatmapBlockAndReturnData(beatmapBlock, beatmapId);
                log(beatmapCalcData, 'debug');
                const deepBeatmapDataAsString = this.createBeatmapDifficultyParamsString(beatmapCalcData.difficulty);
                DomHelper.displayTooltip(deepBeatmapDataAsString, beatmapId, beatmapBlock);
            } catch (error) {
                log(`Error fetching beatmap data: ${error.message}`, 'dev', 'error');
            }
        }
    }

    async setPPToBeatmapBlockAndReturnData(beatmapBlock, beatmapId) {
        const beatmapPP = await OsuApi.getCalculatedBeatmapData(beatmapId);
        BeatmapProcessor.setPPToBeatmapBlock(beatmapBlock, beatmapId, null, beatmapPP);
        return beatmapPP;
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
        BeatmapProcessor.updateBeatmapInfo(beatmapBlock, beatmapInfo.map);
        BeatmapProcessor.setPPToBeatmapBlock(beatmapBlock, beatmapId,
            (beatmapBlock) => this.setPPToBeatmapBlockAndReturnData(beatmapBlock, beatmapId)
        );
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
                BeatmapProcessor.updateBeatmapInfo(beatmapBlock, retryBeatmapInfo.map);
                DomHelper.updateBeatmapIdBtn(numericBeatmapId, retryBeatmapInfo.mapsetId);
            } else {
                log('Unable to fetch beatmap info after reload in 1.3 sec\nProbably bad internet connection',
                    'dev', 'error');
            }
        }, 1300);
    }

    reloadExtensionEvent() {
        const event = new CustomEvent('reloadExtensionRequested');
        window.dispatchEvent(event);
    }
}

export default MoreBeatmapInfo;
