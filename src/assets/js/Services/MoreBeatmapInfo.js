import OsuApi from './IntermediateOsuApiService';
import DomHelper from "./DomHelper";
import log from "/logger";
import IntermediateOsuApiService from "./IntermediateOsuApiService";
import axios from "axios";

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
            element.setAttribute('mapsetId', mapsetId);
            element.setAttribute('beatmapId', lastDiffData.id);
            log(`Информация о последней сложности:\n${JSON.stringify(lastDiffData, null, 2)}\n_____________`, 'debug');
            DomHelper.addDeepInfoButtonToBeatmap(element, lastDiffData.id, lastDiffData.mode, (deepLastDiffData) => {
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
        axios.get(`https://osu.ppy.sh/osu/${beatmapId}`, {
            responseType: 'text',
        })
            .then(response => {
                const mapContent = response.data;
                const map = this.fetchBeatmapPP(beatmapId, mapContent);
                console.log(map);
            })
            .catch(error => {
                console.error('Ошибка:', error);
            });
        // async function fetchBeatmapPP(beatmapId) {
        //     try {
        //         const response = await axios.get(`http://localhost:3000/api/BeatmapPP/${beatmapId}`);
        //         console.log('Данные от API:', response.data);
        //     } catch (error) {
        //         console.error('Ошибка при обращении к API:', error.response ? error.response.data : error.message);
        //     }
        // }
        // await fetchBeatmapPP(beatmapId);
        const numericBeatmapId = this.convertToNumericBeatmapId(beatmapId);
        if (isNaN(numericBeatmapId)) return;

        if (this.isInfoAlreadyDisplayed(beatmapId)) return;

        const beatmapInfo = this.getBeatmapInfoFromCache(numericBeatmapId);
        if (!beatmapInfo) {
            this.handleMissingBeatmapInfo(numericBeatmapId);
            return;
        }

        this.updateBeatmapInfoDOM(beatmapInfo.map, beatmapInfo.mapsetId);
        DomHelper.updateMapIdBtn(beatmapId, beatmapInfo.mapsetId);
    }

    convertToNumericBeatmapId(beatmapId) {
        const numericBeatmapId = parseInt(beatmapId, 10);
        if (isNaN(numericBeatmapId)) {
            log(`Invalid beatmapId: ${beatmapId}`, 'dev', 'error');
        }
        return numericBeatmapId;
    }

    isInfoAlreadyDisplayed(beatmapId) {
        const existingDisplayingInfo = document.querySelector(`[beatmapId="${beatmapId}"]`);
        if (existingDisplayingInfo) {
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
                DomHelper.updateMapIdBtn(numericBeatmapId, retryBeatmapInfo.mapsetId);
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

    async fetchBeatmapPP(beatmapId, beatmap) {
        try {
            const response = await axios.post(`http://localhost:3000/api/BeatmapPP/${beatmapId}`, {
                beatmap: beatmap, // Данные для отправки
            });

            console.log('Данные с сервера:', response.data);
        } catch (error) {
            console.error('Ошибка при запросе данных:', error);
        }
    }
}

export default MoreBeatmapInfo;
