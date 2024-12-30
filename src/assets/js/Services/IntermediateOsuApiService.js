import axios from "axios";
import log from "/logger";

/**
 * Class for interacting with the osu! intermediate API to fetch and cache mapset and beatmap data.
 * The class isolates API interactions and manages data caching internally.
 * Main methods:
 * - getMapsetData(mapsetId): Fetches mapset data by its ID, using cache or requesting from the API if not cached.
 * - getBeatmapData(beatmapId): Fetches full beatmap data by its ID, using cache or requesting from the API if not cached.
 */

class IntermediateOsuApiService {
    constructor() {
        this.serverUrl = "http://localhost:3000";
        //cache settings
        this.localStorageMapsetsKey = "beatmapsetsCache";
        this.localStorageMapsetsItemKey = "beatmapset";
        this.localStorageBeatmapDeepInfoKey = "beatmapsDeepInfoCache";
        this.localStorageBeatmapDeepInfoItemKey = "beatmap";
        this.localStorageBeatmapsAmountKey = "beatmapsCount";
        this.localStoragePPKey = "beatmapsPPCache";
        this.mapsetsCacheLimit = 600;
        this.mapsetsCacheClearItems = 300;
        this.beatmapsCacheLimit = 50;
        this.beatmapsCacheClearItems = 40;
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
            log('Данные мапсета получены из кеша', 'debug');
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
            this.incrementBeatmapsAmountsCache();
            this.clearBeatmapsetsCacheIfNeeded();
            return beatmapsetDataFiltered;
        } catch (error) {
            log(`Ошибка: ${error}`, 'dev', 'error');
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
            log('Полные данные о карте получены из кеша:', 'dev');
            return beatmapDataFromCache;
        }
        try {
            const response = await axios.get(`${this.serverUrl}/api/BeatmapData/${beatmapId}`);
            log(response.data, 'dev');
            const requiredBeatmapFields = ["aim_difficulty", "speed_difficulty", "speed_note_count", "slider_factor", "overall_difficulty", "ranked_date", "last_updated"];
            const beatmapDataFiltered = this.filterObject(response.data.attributes, requiredBeatmapFields);
            const dateForCache = this.getDateForCache(beatmapDataFiltered);
            const beatmapDataFilteredWithData = {...beatmapDataFiltered, date: dateForCache};
            this.cacheDataToObjectWithId(beatmapId, this.localStorageBeatmapDeepInfoItemKey, this.localStorageBeatmapDeepInfoKey, beatmapDataFilteredWithData);
            this.clearBeatmapsCacheIfNeeded()
            return beatmapDataFilteredWithData;
        } catch (error) {
            log(`Ошибка: ${error}`, 'dev', 'error');
            throw new Error(`Не удалось получить данные для карты ${beatmapId}: ${error.message}`);
        }
    }

    /**
     * Clears the cache if the number of beatmap sets exceeds the cache limit for beatmap sets.
     * Removes the oldest items from the cache and updates the count in localStorage.
     * The cache limit and the number of items to be removed are defined in the constructor
     * with the variables `mapsetsCacheLimit` and `mapsetsCacheClearItems`.
     *
     * @returns {void}
     */
    clearBeatmapsetsCacheIfNeeded() {
        const beatmapsInCacheAmount = parseInt(localStorage.getItem(
            this.localStorageBeatmapsAmountKey), 10) || 0;
        if (beatmapsInCacheAmount >= this.mapsetsCacheLimit) {
            const beatmapsInCacheAmountInCache = this.getItemsCountFromLocalStorage(this.localStorageMapsetsKey);
            //Проверяем сам объект на случай неправильного сохранённого значения
            if (beatmapsInCacheAmountInCache >= this.mapsetsCacheLimit) {
                this.removeOldestItemsFromCache(this.localStorageMapsetsKey, this.mapsetsCacheClearItems);
                localStorage.setItem(this.localStorageBeatmapsAmountKey, (beatmapsInCacheAmountInCache
                    - this.mapsetsCacheClearItems).toString());
                log('Очистили часть кеша для сетов карт', 'dev');
            } else {
                localStorage.setItem(this.localStorageBeatmapsAmountKey, beatmapsInCacheAmountInCache.toString());
            }
        }
    }

    /**
     * Clears the cache if the number of beatmaps exceeds the cache limit for beatmaps.
     * Removes the oldest items from the cache and updates the count in localStorage.
     * The cache limit and the number of items to be removed are defined in the constructor
     * with the variables `beatmapsCacheLimit` and `beatmapsCacheClearItems`.
     *
     * @returns {void}
     */
    clearBeatmapsCacheIfNeeded() {
        const beatmapsInCacheAmountInCache = this.getItemsCountFromLocalStorage(this.localStorageBeatmapDeepInfoKey);
        if (beatmapsInCacheAmountInCache >= this.beatmapsCacheLimit) {
            this.removeOldestItemsFromCache(this.localStorageBeatmapDeepInfoKey, this.beatmapsCacheClearItems);
            log('Очистили часть кеша для подробностей карты', 'dev');
        }
    }

    /**
     * Stores data in localStorage under a specified cache name and associates it with a unique ID and name.
     *
     * @param {string} cacheItemId - The unique identifier for the cache item.
     * @param {string} cacheItemName - The name or type of the cache item (e.g., 'user', 'beatmap').
     * @param {string} cacheName - The name of the cache in localStorage where the data will be stored.
     * @param {any} data - The data to be stored, which will be serialized into JSON format.
     * @returns {void}
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

    /**
     * Retrieves the oldest items from a cached object stored in localStorage.
     * Date should be as ISO string.
     *
     * @param {string} key - The localStorage key where the cached object is stored.
     * @param {number} count - The number of oldest items to retrieve.
     * @returns {Array} An array of the oldest items, each including its original key and data.
     */
    getOldestItemsFromCache(key, count) {
        const storageData = JSON.parse(localStorage.getItem(key)) || {};
        const storageArrayWithNames = Object.keys(storageData).map(itemKey => {
            const item = storageData[itemKey];
            return {
                ...item,
                key: itemKey
            };
        });
        storageArrayWithNames.sort((a, b) => new Date(a.date) - new Date(b.date));

        return storageArrayWithNames.slice(0, count);
    }

    /**
     * Removes the oldest items from a cached object stored in localStorage.
     *
     * @param {string} key - The localStorage key where the cached object is stored.
     * @param {number} count - The number of oldest items to remove.
     * @returns {void}
     */
    removeOldestItemsFromCache(key, count) {
        const oldestItems = this.getOldestItemsFromCache(key, count);
        log(oldestItems, 'debug');
        const storageData = JSON.parse(localStorage.getItem(key)) || {};

        oldestItems.forEach(item => {
            delete storageData[item.key];
        });

        localStorage.setItem(key, JSON.stringify(storageData));
    }

    /**
     * Retrieves the relevant date for caching from the provided beatmapset data.
     *
     * @param {Object} beatmapsetData - The data object containing date fields.
     * @returns {string|null} The ranked date if available; otherwise, the last updated date.
     */
    getDateForCache(beatmapsetData) {
        return beatmapsetData.ranked_date || beatmapsetData.last_updated || new Date().toISOString();
    }

    /**
     * Adds a date property to the provided object.
     *
     * @param {Object} object - The object to which the date will be added.
     * @param {string} date - The date to add to the object.
     * @returns {Object} The same object with the added date property.
     */
    addDateToObject(object, date) {
        object.date = date;
        return object;
    }

    /**
     * Counts the number of items stored in a localStorage object.
     *
     * @param {string} key - The localStorage key where the object is stored.
     * @returns {number} The number of items in the stored object.
     */
    getItemsCountFromLocalStorage(key) {
        const storageData = JSON.parse(localStorage.getItem(key)) || {};
        log(storageData, 'debug');
        return Object.keys(storageData).length;
    }

    /**
     * Increments the cached amount of beatmaps stored in localStorage.
     *
     * This method retrieves the current beatmap count from localStorage, increments it by 1,
     * and then stores the updated value back in localStorage.
     *
     * @returns {void}
     */
    incrementBeatmapsAmountsCache() {
        const currentAmount = parseInt(localStorage.getItem(this.localStorageBeatmapsAmountKey)
            || '0', 10);
        localStorage.setItem(this.localStorageBeatmapsAmountKey, (currentAmount + 1).toString());
    }

    /**
     * Searching for beatmap info in the beatmapsets cache by its ID.
     *
     * The function might work slowly if there are too many beatmapsets in the cache,
     * and it is used for non-constant function calls.
     *
     * @param {int} mapId - id of beatmap in beatmapset.
     * @returns {Object|null}
     */
    getDiffInfoByIdFromCache(mapId) {
        const mapsets = JSON.parse(localStorage.getItem(this.localStorageMapsetsKey));
        if (!mapsets) return null;
        try {
            for (const [key, mapset] of Object.entries(mapsets)) {
                const mapsetId = key.replace(`${this.localStorageMapsetsItemKey}_`, '');

                for (const map of mapset.beatmaps) {
                    if (map.id === mapId) {
                        return {map, mapsetId};
                    }
                }
            }
        } catch (e) {
            log(`Failed to parse mapsets from localStorage: ${e}`, 'dev', 'error');
        }
        return null;
    }

    async getBeatmapPP(beatmapId, beatmapStructure) {
        const cachedBeatmapPP = this.getBeatmapPPFromCache(beatmapId);
        if (cachedBeatmapPP) {
            log('PP data recived from cache', 'dev');
            return cachedBeatmapPP.pp;
        } else {
            try {
                const response = await axios.post(`${this.serverUrl}/api/BeatmapPP/${beatmapId}`, {
                    beatmap: beatmapStructure,
                });
                log(`${response.data.pp}`, 'dev'); //also has ppAim, ppSpeed, ppAccuracy
                const paramsToCache = {
                    pp: parseFloat(response.data.pp.toFixed(2)),
                    ppAim: parseFloat(response.data.ppAim.toFixed(2)),
                    ppSpeed: parseFloat(response.data.ppSpeed.toFixed(2)),
                    ppAccuracy: parseFloat(response.data.ppAccuracy.toFixed(2))
                };
                this.cacheBeatmapPP(paramsToCache, beatmapId);
                return response.data.pp;
            } catch (error) {
                log(`Failed to get beatmap pp:\n ${error}`, 'prod', 'error');
            }
        }
        return null;
    }

    async getBeatmapStructureAsText(beatmapId) {
        try {
            const response = await axios.get(`https://osu.ppy.sh/osu/${beatmapId}`, {
                responseType: 'text',
            });
            const beatmapStructure = response.data;
            if (beatmapStructure.length < 50 || typeof beatmapStructure !== 'string') {
                log(`Something went wrong, with beatmap structure: ${beatmapStructure.length}`, 'dev');
            }
            return beatmapStructure;
        } catch (error) {
            log(`Failed to get pp for beatmap: ${beatmapId}\n, ${error}`, 'prod', 'error');
        }
    }

    cacheBeatmapPP(cacheData, beatmapId) {
        log(cacheData, 'dev');
        try {
            const cache = JSON.parse(localStorage.getItem('beatmapsPPCache')) || {};
            const cacheKey = `beatmap_${beatmapId}`;

            cache[cacheKey] = JSON.stringify(cacheData);

            localStorage.setItem(this.localStoragePPKey, JSON.stringify(cache));

            log(`Cached data for ${beatmapId}`, 'dev');
        } catch (error) {
            log(`Failed to cache beatmap pp:\n ${error}`, 'dev', 'error');
        }
    }

    getBeatmapPPFromCache(beatmapId) {
        try {
            const cache = JSON.parse(localStorage.getItem('beatmapsPPCache')) || {};
            const cacheKey = `beatmap_${beatmapId}`;

            if (cache[cacheKey]) {
                return JSON.parse(cache[cacheKey]);
            } else {
                log(`No cached data found for ${beatmapId}`, 'dev');
                return null;
            }
        } catch (error) {
            log(`Failed to retrieve cached beatmap pp:\n ${error}`, 'dev', 'error');
            return null;
        }
    }
}

export default new IntermediateOsuApiService();
