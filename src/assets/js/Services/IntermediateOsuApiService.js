import axios from "axios";

class IntermediateOsuApiService {
    constructor() {
        this.localStorageMapsetsKey = "beatmapsetsCache";
        this.localStorageMapsetsItemKey = "beatmapset";
        this.localStorageBeatmapDeepInfoKey = "beatmapsDeepInfoCache";
        this.localStorageBeatmapDeepInfoItemKey = "beatmap";
        this.serverUrl = "http://localhost:3000";
    }

    /**
     * Retrieves and caches mapset data by its unique ID.
     * If the mapset data is already cached, it is returned from the cache.
     * Otherwise, it fetches the data from the intermediate server and caches it for future use.
     *
     * @param {string} mapsetId - The unique identifier of the mapset.
     * @returns {Promise<Object>} - The filtered mapset data.
     */

    async getMapsetData(mapsetId) {
        const beatmapsetDataFromCache = this.getDataFromCacheById(mapsetId, this.localStorageMapsetsItemKey, this.localStorageMapsetsKey);
        if (beatmapsetDataFromCache) {
            console.log('Данные мапсета получены из кеша');
            return beatmapsetDataFromCache;
        }
        try {
            const response = await axios.get(`${this.serverUrl}/api/MapsetData/${mapsetId}`);
            const beatmapsetBeatmapRequiredFields = ["difficulty_rating", "bpm", "max_combo", "accuracy", "ar", "cs", "drain", "mode", "id"];
            const dateForCache = this.getDateForCache(response.data);
            const beatmaps = response.data.beatmaps.map((beatmap) =>
                this.filterObject(beatmap, beatmapsetBeatmapRequiredFields)
            );
            const beatmapsetDataFiltered = {...this.filterObject(response.data, ['bpm']), beatmaps};
            const beatmapsetFilteredWithDate = this.addDateToObject(beatmapsetDataFiltered, dateForCache);
            this.cacheDataToObjectWithId(mapsetId, this.localStorageMapsetsItemKey, this.localStorageMapsetsKey, beatmapsetFilteredWithDate);
            //console.log(beatmapsetDataFiltered);
            console.log(this.getItemsCountFromLocalStorage(this.localStorageMapsetsKey ));
            if (this.getItemsCountFromLocalStorage(this.localStorageMapsetsKey ) >= 600) {
                this.removeOldestItemsFromCache(this.localStorageMapsetsKey , 300);
                console.log('Очистили часть кеша');
            }
            return beatmapsetDataFiltered;
        } catch (error) {
            console.error('Ошибка:', error);
            throw new Error(`Не удалось получить данные для мапсета ${mapsetId}: ${error.message}`);
        }
    }

    /**
     * Retrieves and caches beatmap data by its unique ID.
     * If the beatmap data is already cached, it is returned from the cache.
     * Otherwise, it fetches the data from the server and caches it for future use.
     *
     * @param {string} beatmapId - The unique identifier of the beatmap.
     * @returns {Promise<Object>} - The filtered beatmap data.
     * @throws {Error} - Throws an error if the data cannot be retrieved.
     */

    async getBeatmapData(beatmapId) {
        const beatmapDataFromCache = this.getDataFromCacheById(beatmapId, this.localStorageBeatmapDeepInfoItemKey, this.localStorageBeatmapDeepInfoKey);
        if (beatmapDataFromCache) {
            console.log('Полные данные о карте получены из кеша:');
            return beatmapDataFromCache;
        }
        try {
            const response = await axios.get(`${this.serverUrl}/api/BeatmapData/${beatmapId}`);
            console.log(response.data);
            const requiredBeatmapFields = ["aim_difficulty", "speed_difficulty", "speed_note_count", "slider_factor", "overall_difficulty", "ranked_date", "last_updated"];
            const beatmapDataFiltered = this.filterObject(response.data.attributes, requiredBeatmapFields);
            this.cacheDataToObjectWithId(beatmapId, this.localStorageBeatmapDeepInfoItemKey, this.localStorageBeatmapDeepInfoKey, beatmapDataFiltered);
            return beatmapDataFiltered;
        } catch (error) {
            console.error('Ошибка:', error);
            throw new Error(`Не удалось получить данные для карты ${beatmapId}: ${error.message}`);
        }
    }

    /**
     * Stores data in localStorage under a specified cache name and associates it with a unique ID and name.
     *
     * @param {string} cacheItemId - The unique identifier for the cache item.
     * @param {string} cacheItemName - The name or type of the cache item (e.g., 'user', 'beatmap').
     * @param {string} cacheName - The name of the cache in localStorage where the data will be stored.
     * @param {any} data - The data to be stored, which will be serialized into JSON format.
     */

    cacheDataToObjectWithId(cacheItemId, cacheItemName, cacheName, data) {
        const localStorageObject = JSON.parse(localStorage.getItem(cacheName)) || {};
        const cacheKey = `${cacheItemName}_${cacheItemId}`;
        localStorageObject[cacheKey] = data;
        localStorage.setItem(cacheName, JSON.stringify(localStorageObject));
    }

    /**
     * Retrieves data from localStorage by a unique ID and cache item name.
     *
     * @param {string} cacheItemId - The unique identifier for the cache item.
     * @param {string} cacheItemName - The name or type of the cache item (e.g., 'user', 'beatmap').
     * @param {string} cacheName - The name of the cache in localStorage where the data might be stored.
     * @returns {any|null} - The cached data associated with the specified ID and name, or null if not found.
     */

    getDataFromCacheById(cacheItemId, cacheItemName, cacheName) {
        const cacheKey = `${cacheItemName}_${cacheItemId}`;
        const beatmapsetsCache = JSON.parse(localStorage.getItem(cacheName));
        if (beatmapsetsCache && beatmapsetsCache[cacheKey]) {
            return beatmapsetsCache[cacheKey];
        }
        return null;
    }

    /**
     * Filters an object, keeping only the specified keys.
     *
     * @param {Object} beatmapData - The object to filter.
     * @param {Array} requiredFields - An array of keys to retain in the object.
     * @returns {Object} A new object containing only the keys specified in `requiredFields`.
     */

    filterObject(beatmapData, requiredFields) {
        return Object.keys(beatmapData)
            .filter((key) => requiredFields.includes(key))
            .reduce((filteredObject, key) => {
                filteredObject[key] = beatmapData[key];
                return filteredObject;
            }, {});
    }

    getDateForCache(beatmapsetData) {
        return beatmapsetData.ranked_date || beatmapsetData.last_updated;
    }

    addDateToObject(object, date) {
        object.date = date;
        return object;
    }

    getOldestItemsFromCache(key, count) {
        const storageData = JSON.parse(localStorage.getItem(key)) || {};
        const storageArrayWithNames = Object.keys(storageData).map(itemKey => {
            const item = storageData[itemKey];
            return {
                ...item,
                key: itemKey
            };
        });

        // Сортируем по дате
        storageArrayWithNames.sort((a, b) => new Date(a.date) - new Date(b.date));

        // Возвращаем первые 'count' элементов
        return storageArrayWithNames.slice(0, count);
    }



    removeOldestItemsFromCache(key, count) {
        const oldestItems = this.getOldestItemsFromCache(key, count);
        console.log(oldestItems);
        const storageData = JSON.parse(localStorage.getItem(key)) || {};

        oldestItems.forEach(item => {
            console.log(item.key);
            delete storageData[item.key];
        });


        localStorage.setItem(key, JSON.stringify(storageData));
    }

    getItemsCountFromLocalStorage(key) {
        const storageData = JSON.parse(localStorage.getItem(key)) || {};
        console.log(storageData);
        return Object.keys(storageData).length;
    }
}

export default new IntermediateOsuApiService();
