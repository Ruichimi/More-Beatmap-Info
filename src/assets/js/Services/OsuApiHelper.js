import axios from "axios";

class OsuApi {
    async getMapsetData(mapsetId) {
        console.log('Вызванна функция getMapsetData');
        const cachedData = this.getCachedBeatmapsetData(mapsetId, 'beatmapsetCache',
            'beatmapData');
        if (cachedData) {
            console.log('Данные получены из кеша:', cachedData);
            return cachedData;
        }

        try {
            const response = await axios.get(`http://localhost:3000/api/MapsetData/${mapsetId}`);
            const beatmapsData = this.removeExtraInfoFromBeatmapsetDiffs(response.data.beatmaps,
                ["difficulty_rating", "bpm", "max_combo", "accuracy", "ar", "cs", "drain", "mode"]);


            this.cacheBeatmapsetData(mapsetId, response.data, 'beatmapsetCache', 'beatmapData',
                ["bpm"], {beatmaps: beatmapsData});
            return response.data;
        } catch (error) {
            console.error('Ошибка:', error);
        }
    }

    async getBeatmapData(beatmapId) {
        console.log('Вызвана функция getBeatmapData');
        const cachedData = this.getCachedBeatmapsetData(beatmapId, 'deepParams', 'mapCache');
        if (cachedData) {
            console.log('Полные данные получены из кеша:', cachedData);
            return cachedData;
        }

        try {
            const response = await axios.get(`http://localhost:3000/api/BeatmapData/${beatmapId}`);
            console.log('Полные данные карты:', response.data);

            this.cacheBeatmapsetData(beatmapId, response.data, 'deepParams', 'mapCache');

            return response.data;
        } catch (error) {
            console.error('Ошибка:', error);
        }
    }

    cacheBeatmapsetData(beatmapId, data, cacheName, cacheItemName, requiredFields, otherParams = {}) {
        const deepParams = JSON.parse(localStorage.getItem(cacheName)) || {};
        const cacheKey = `${cacheItemName}_${beatmapId}`;
        let filteredData = {};

        if (data && typeof data === "object") {
            requiredFields.forEach(field => {
                if (field in data) {
                    filteredData[field] = data[field];
                }
            });
        }

        filteredData = {...filteredData, ...otherParams}

        deepParams[cacheKey] = filteredData;
        localStorage.setItem(cacheName, JSON.stringify(deepParams));
    }


    getCachedBeatmapsetData(beatmapId, cacheName, cacheItemName) {
        const cacheKey = `${cacheItemName}_${beatmapId}`;
        const deepParams = JSON.parse(localStorage.getItem(cacheName));

        if (deepParams && deepParams[cacheKey]) {
            return deepParams[cacheKey];
        }

        return null;
    }

    removeExtraInfoFromBeatmapsetDiffs(beatmapsetData, requiredFields) {
        Object.keys(beatmapsetData).forEach((key) => {
            // Проверяем, является ли значение под этим ключом объектом
            if (typeof beatmapsetData[key] === 'object' && beatmapsetData[key] !== null) {
                // Оставляем только поля, указанные в requiredFields
                beatmapsetData[key] = Object.keys(beatmapsetData[key])
                    .filter((subKey) => requiredFields.includes(subKey))
                    .reduce((filteredObject, subKey) => {
                        filteredObject[subKey] = beatmapsetData[key][subKey];
                        return filteredObject;
                    }, {});
            }
        });

        return beatmapsetData;
    }



}

export default new OsuApi();
