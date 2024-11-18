import axios from "axios";

class OsuApi {
    async getMapsetData(mapsetId) {
        console.log('Вызванна функция getMapsetData');
        const cachedData = this.getCachedBeatmapsetData(mapsetId, 'beatmapsetCache', 'beatmapData');
        if (cachedData) {
            console.log('Данные получены из кеша:', cachedData);
            return cachedData;
        }

        try {
            const response = await axios.get(`http://localhost:3000/api/MapsetData/${mapsetId}`);
            console.log('Данные мапсета:', response.data);
            this.cacheBeatmapsetData(mapsetId, response.data, 'beatmapsetCache', 'beatmapData');
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

    cacheBeatmapsetData (beatmapId, data, cacheName, cacheItemName) {
        const deepParams = JSON.parse(localStorage.getItem(cacheName)) || {};
        const cacheKey = `${cacheItemName}_${beatmapId}`;
        deepParams[cacheKey] = data;
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

}

export default new OsuApi();
