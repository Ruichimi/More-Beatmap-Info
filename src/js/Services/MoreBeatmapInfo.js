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
            this.domObserver.stopObservingPresence('.beatmapsets__items', '.beatmaps-popup__group');
            this.domObserver.stopObserving('.beatmapsets__items');

            this.watchBeatmapsContainer();

            this.domObserver.watchElementPresence(
                '.beatmaps-popup__group',
                (appearedElement) => this.processPopupGroupChanges(appearedElement),
            );
        } catch (err) {
            log(err, 'dev', 'error');
            //throw new Error(`Failed to initialize More Beatmap Info`, {cause: err});
        }
    }

    watchBeatmapsContainer() {
        let beatmapsContainerDisappeared = false;

        this.domObserver.watchElementPresence(
            '.beatmapsets__items',
            () => {
                if (beatmapsContainerDisappeared) {
                    DomHelper.reloadBeatmapsContainer();
                }

                this.domObserver.startObserving(
                    '.beatmapsets__items',
                    (addedNodes) => this.processBeatmapsBlocks(addedNodes),
                    {childList: true, subtree: false}
                );
            },
            () => {
                beatmapsContainerDisappeared = true;
                this.domObserver.stopObserving('.beatmapsets__items')
            }
        );
    }

    processBeatmapsBlocks(blocks, single = false) {
        const beatmapsChunks = BeatmapProcessor.getBeatmapsChunks(blocks, single);
        beatmapsChunks.forEach(async (chunk) => {
            const beatmapBlocks = BeatmapProcessor.prepareBeatmapBlocksForProcess(chunk);
            const beatmapBlocksLastDiffs = await this.setDataToBeatmapBlock(beatmapBlocks);
            const beatmapIdsToFetchPP = Object.keys(beatmapBlocksLastDiffs);
            const cachedBeatmapsPPData = await this.getCachedBeatmapsPP(beatmapIdsToFetchPP);

            Object.entries(beatmapBlocksLastDiffs).forEach(([beatmapId, beatmapBlock]) => {
                const beatmapData = cachedBeatmapsPPData?.[beatmapId];
                BeatmapProcessor.setPPToBeatmapBlock(beatmapBlock, beatmapId,
                    (beatmapBlock) => this.setPPToBeatmapBlockAndReturnData(beatmapBlock, beatmapId),
                    beatmapData
                );
            });
        });
    }

    async setDataToBeatmapBlock(beatmapBlocks) {
        const beatmapBlockLastDiff = {};
        const mapsetsIds = Object.keys(beatmapBlocks);

        try {
            await OsuApi.getMapsetsData(
                mapsetsIds,
                (mapsetId, mapsetData) => {
                    const beatmapBlock = beatmapBlocks[mapsetId];
                    const result = this.fillBeatmapBlock(mapsetId, mapsetData, beatmapBlock);
                    Object.assign(beatmapBlockLastDiff, result);
                },
                (failedBeatmapId) => {
                    const uncaughtBeatmapBlock = beatmapBlocks[failedBeatmapId];
                    this.handleMissingBeatmapData(uncaughtBeatmapBlock);
                }
            );

            return beatmapBlockLastDiff;
        } catch (err) {
            log(`Failed to get data for mapsets ${mapsetsIds}\n ${err.message}`, 'dev', 'error');
        }
    }

    /**
     * Returns the PP data of beatmaps from the local cache.
     * If the data is not available, it will try to load it from the server's cache.
     * If the data has been fetched from server, it will locally cache it.
     *
     * @param {array} beatmapIds - An array of beatmap IDs for which PP data is to be retrieved.
     * @returns {Promise<Object>} - A promise that resolves to an object containing PP data for the given beatmaps.
     */
    async getCachedBeatmapsPP(beatmapIds) {
        let uncachedBeatmapsIds = [];
        let result = {};

        for (const beatmapId of beatmapIds) {
            const cachedBeatmapData = cache.getBeatmap(beatmapId);
            if (cachedBeatmapData) {
                result[beatmapId] = cachedBeatmapData;
            } else {
                uncachedBeatmapsIds.push(beatmapId);
            }
        }

        const serverCachedBeatmapPP = await OsuApi.tryFetchBeatmapsPPFromServersCache(uncachedBeatmapsIds)

        Object.entries(serverCachedBeatmapPP).forEach(([beatmapId, beatmapData]) => {
            cache.setBeatmap(beatmapId, beatmapData);
            result[beatmapId] = beatmapData;
        });

        return result;
    }

    /**
     * Fills the beatmap block with information and adds a button to retrieve PP.
     * The button is added to the beatmap block at the same time as the first information mounting.
     * It will be replaced later if PP is received from any cache.
     *
     * @returns {Object} An object containing the beatmap block with the added button and PP.
     */
    fillBeatmapBlock(mapsetId, mapsetData, beatmapBlock) {
        if (mapsetData === '') {
            BeatmapProcessor.setUpdateInfoBtnToBeatmapBlock(beatmapBlock, mapsetId, async () => {
                await this.updateInfoInBeatmapBlock(beatmapBlock, mapsetId);
            });
            return { '': beatmapBlock };
        }

        const lastMapsetDiffId = this.getLastMapsetDiffInfo(mapsetData).id;

        BeatmapProcessor.setPPToBeatmapBlock(
            beatmapBlock,
            lastMapsetDiffId,
            (beatmapBlock) => this.setPPToBeatmapBlockAndReturnData(beatmapBlock, lastMapsetDiffId),
            null
        );

        BeatmapProcessor.setUpdateInfoBtnToBeatmapBlock(beatmapBlock, mapsetId, async () => {
            await this.updateInfoInBeatmapBlock(beatmapBlock, mapsetId);
        });

        this.applyMapsetDataToBlocks(mapsetId, beatmapBlock, mapsetData);
        return { [lastMapsetDiffId]: beatmapBlock };
    }

    async updateInfoInBeatmapBlock(beatmapBlock, mapsetId) {
        const currentBeatmapIdInBlock = DomHelper.getCurrentBeatmapIdFromBlock(beatmapBlock);
        cache.removeAllBeatmapsFromCacheByIDOfItsMapset(mapsetId);
        cache.removeMapset(mapsetId);
        const updatedData = await OsuApi.updateMapsetDataOnServerAngGetIt(mapsetId);
        const currentBeatmapData = this.getBeatmapInfoById(updatedData, currentBeatmapIdInBlock);
        BeatmapProcessor.setInfoToBeatmapBlock(beatmapBlock, currentBeatmapData);
    }

    applyMapsetDataToBlocks(mapsetId, beatmapBlock, mapsetData) {
        if (!mapsetId || typeof mapsetData !== 'object' || !mapsetData || Object.keys(mapsetData).length === 0) {
            return this.handleMissingBeatmapData(beatmapBlock);
        }

        const lastDiffData = this.getLastMapsetDiffInfo(mapsetData);
        if (lastDiffData && lastDiffData.id) {
            BeatmapProcessor.processBeatmapBlock(beatmapBlock, mapsetId, lastDiffData,
                (beatmapBlock) => this.handleDeepInfoBtnClick(beatmapBlock, lastDiffData.id)
            );
        } else {
            this.handleMissingBeatmapData(beatmapBlock);
        }
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
        try {
            const beatmapPP = await OsuApi.getCalculatedBeatmapData(beatmapId);
            BeatmapProcessor.setPPToBeatmapBlock(beatmapBlock, beatmapId, null, beatmapPP);
            return beatmapPP;
        } catch (error) {
            log(`Failed to get beatmap pp for beatmap ${beatmapId}`, 'prod', 'error');
        }
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

    getBeatmapInfoById(mapsetData, targetId) {
        const targetIdNum = Number(targetId);
        if (isNaN(targetIdNum)) {
            throw new Error(`target id ${targetIdNum} is invalid`);
        }
        if (!mapsetData || !Array.isArray(mapsetData.beatmaps)) return null;

        return mapsetData.beatmaps.find(beatmap => Number(beatmap.id) === targetIdNum) || null;
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
