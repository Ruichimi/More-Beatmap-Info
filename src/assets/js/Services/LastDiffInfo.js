import OsuApi from './OsuApiHelper'

class LastDiffInfo {
    initialize() {
        this.setLastDiffInfoToMapsRows(document.querySelectorAll('.beatmapsets__items-row'));

        const observer = new MutationObserver(mutations => {
            mutations.forEach(mutation => {
                if (mutation.addedNodes.length > 0) {
                    this.setLastDiffInfoToMapsRows(mutation.addedNodes);
                }
            });
        });
        const targetNode = document.querySelector('.beatmapsets__items');

        if (targetNode) {
            observer.observe(targetNode, {childList: true});
        }
    }

    setLastDiffInfoToMapsRows(beatmapsBlocksRows) {
        const beatmapsBlocks = this.flattenBeatmapRows(beatmapsBlocksRows);

        return beatmapsBlocks.map(async element => {
            const beatmapId = this.getBeatmapId(element);
            const mapsetData = await OsuApi.getMapsetData(beatmapId);
            const lastDiffData = this.getLastMapsetDiffInfo(mapsetData);
            console.log(lastDiffData);

            const mapParamsString = this.createMapParamsString(lastDiffData);
            this.createInfoBlock(element, mapParamsString, beatmapId);

            return beatmapId;
        });
    }

    flattenBeatmapRows(beatmapsBlocksRows) {
        return Array.from(beatmapsBlocksRows)
            .flatMap(row => Array.from(row.querySelectorAll('.beatmapsets__item')))
            .flat();
    }

    getBeatmapId(element) {
        const href = element.querySelector('a').getAttribute('href');
        const match = href.match(/\/(\d+)$/);
        return match ? match[1] : null;
    }

    createMapParamsString(lastDiffData) {
        return `<div class="last-diff-info">${lastDiffData.difficulty_rating}★
      bpm ${lastDiffData.bpm} combo ${lastDiffData.max_combo} od ${lastDiffData.accuracy}
      ar ${lastDiffData.ar} cs ${lastDiffData.cs} hp ${lastDiffData.drain}</div>`;
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
}

export default new LastDiffInfo();
