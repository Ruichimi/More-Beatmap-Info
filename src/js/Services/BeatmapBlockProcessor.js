import DomHelper from "./DomHelper";
import log from "@/js/logger";
import cache from "@/js/Services/CacheService";

class BeatmapBlockProcessor {
    getBeatmapsChunks(beatmapsBlocksRows, single = false) {
        DomHelper.setBeatmapsContainerIfNeeded();

        try {
            let beatmapsBlocks;
            if (!single) {
                beatmapsBlocks = this.flattenBeatmapRows(beatmapsBlocksRows);
            } else {
                beatmapsBlocks = [beatmapsBlocksRows];
            }

            const chunks = [];

            for (let i = 0; i < beatmapsBlocks.length; i += 2) {
                const chunk = beatmapsBlocks.slice(i, i + 2);
                chunks.push(chunk);
            }
            return chunks;
        } catch (err) {
            throw err;
        }
    }

    prepareBeatmapBlocksForProcess(beatmapBlocks) {
        if (!Array.isArray(beatmapBlocks) || beatmapBlocks.length === 0) {
            throw new Error(`Invalid beatmapBlocks array "${beatmapBlocks}"`);
        }

        const mapsetsIds = [];
        const beatmapBlockMap = new Map();

        for (const beatmapBlock of beatmapBlocks) {
            const mapsetId = this.preProcessBeatmapBlock(beatmapBlock);
            mapsetsIds.push(mapsetId);
            beatmapBlockMap.set(mapsetId, beatmapBlock);
        }

        return { mapsetsIds, beatmapBlockMap };
    }

    preProcessBeatmapBlock(beatmapBlock) {
        const mapsetId = DomHelper.getMapsetIdFromBlock(beatmapBlock);
        beatmapBlock.setAttribute('mapsetId', mapsetId);

        return mapsetId;
    }

    processBeatmapBlock(beatmapBlock, mapsetId, beatmapData, deepInfoBtnCallback) {
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

            DomHelper.mountBeatmapInfoToBlock(beatmapBlock, mapDiffInfoString);
            if (beatmapData.mode === 'osu') {
                DomHelper.addDeepInfoButtonToBeatmap(beatmapBlock, (block) => deepInfoBtnCallback(block));
            }
        } else {
            log(`Не удалось найти beatmapBlock в DOM ${mapsetId}`, 'debug', 'warn');
        }
    }

    updateBeatmapInfo(beatmapBlock, beatmapData) {
        const diffInfoString = this.createBeatmapParamsAsString(beatmapData);
        DomHelper.mountBeatmapInfoToBlock(beatmapBlock, diffInfoString);
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

    setPPToBeatmapBlock(beatmapBlock, beatmapId, callbackClick, beatmapPPData = null) {
        const beatmapPPBlock = beatmapBlock.querySelector('.pp-block');
        if (!beatmapPPBlock) {
            const beatmapNameBlock = beatmapBlock.querySelector('.beatmapset-panel__info').firstElementChild;
            beatmapNameBlock.innerHTML += `<div class="pp-block"></div>`;
        }

        if (beatmapPPData) {
            return DomHelper.mountPPForBeatmapBlock(beatmapBlock, beatmapPPData.pp);
        }

        const cachedBeatmapPP = cache.getBeatmap(beatmapId);
        if (cachedBeatmapPP) {
            DomHelper.mountPPForBeatmapBlock(beatmapBlock, cachedBeatmapPP.pp);
        } else {
            DomHelper.mountPPButton(beatmapBlock, (beatmapBlock) => {
                callbackClick(beatmapBlock, beatmapId);
            });
        }
    }

    setBeatmapBlockFailed(beatmapBlock, callbackClick) {
        const failedInfoBlock = document.createElement('div');
        failedInfoBlock.textContent = 'Failed to get beatmap data';
        const retryGetInfoBtn = DomHelper.createRetryGetInfoBtn();
        failedInfoBlock.appendChild(retryGetInfoBtn);
        DomHelper.mountBeatmapInfoToBlock(beatmapBlock, failedInfoBlock);
        retryGetInfoBtn.addEventListener('click', async () => {
            await callbackClick();
            failedInfoBlock.remove();
        });
    }
}

export default new BeatmapBlockProcessor();
