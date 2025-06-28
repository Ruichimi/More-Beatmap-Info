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

        const beatmapBlockMap = {};

        for (const beatmapBlock of beatmapBlocks) {
            const mapsetId = this.preProcessBeatmapBlock(beatmapBlock);
            beatmapBlockMap[mapsetId] = beatmapBlock;
        }

        return beatmapBlockMap;
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

            this.setInfoToBeatmapBlock(beatmapBlock, beatmapData);

            if (beatmapData.mode === 'osu') {
                DomHelper.addDeepInfoButtonToBeatmap(beatmapBlock, (block) => deepInfoBtnCallback(block));
            }
        } else {
            log(`Не удалось найти beatmapBlock в DOM ${mapsetId}`, 'debug', 'warn');
        }
    }

    setInfoToBeatmapBlock(beatmapBlock, beatmapData) {
        const mapDiffInfoString = this.createBeatmapParamsAsString(beatmapData);
        DomHelper.mountBeatmapInfoToBlock(beatmapBlock, mapDiffInfoString);
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
        if (!beatmapId) return;

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

    setUpdateInfoBtnToBeatmapBlock(beatmapBlock, mapsetId, callbackClick) {
        const beatmapBlockRightMenu = beatmapBlock.querySelector('.beatmapset-panel__menu');

        if (beatmapBlockRightMenu.querySelector('.update-beatmap-info-btn')) {
            return;
        }

        const moreDiffInfoBtn = this.createUpdateBeatmapInfoBtn();
        moreDiffInfoBtn.classList.add('update-beatmap-info-btn');

        beatmapBlockRightMenu.insertAdjacentElement('afterbegin', moreDiffInfoBtn);
        moreDiffInfoBtn.addEventListener('click', async () => {
            callbackClick(beatmapBlock);
        });
    }


    createUpdateBeatmapInfoBtn() {
        const getPPBtn = document.createElement('button');
        getPPBtn.title = "The information about the beatmap is wrong? Click here to update it";
        getPPBtn.classList.add('beatmap-update-info-btn');
        getPPBtn.classList.add('more-diff-info-btn');
        getPPBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" width="12" height="12" viewBox="0 0 512 512">
        <!--!Font Awesome Free 6.7.2 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2025 Fonticons, Inc.-->
        <path d="M463.5 224l8.5 0c13.3 0 24-10.7 24-24l0-128c0-9.7-5.8-18.5-14.8-22.2s-19.3-1.7-26.2 5.2L413.4 96.6c-87.6-86.5-228.7-86.2-315.8 1c-87.5 87.5-87.5 229.3 0 316.8s229.3 87.5 316.8 0c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0c-62.5 62.5-163.8 62.5-226.3 0s-62.5-163.8 0-226.3c62.2-62.2 162.7-62.5 225.3-1L327 183c-6.9 6.9-8.9 17.2-5.2 26.2s12.5 14.8 22.2 14.8l119.5 0z"/>
    </svg>`;
        //getPPBtn.innerHTML = 'U';
        return getPPBtn;
    }

}

export default new BeatmapBlockProcessor();
