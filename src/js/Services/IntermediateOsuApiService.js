import axios from "../AxiosWrapper";
import log from "@/js/logger.js";

//TODO: Caching a beatmap structure
//TODO: Validate beatmap pp data

/**
 * Class for interacting with the osu! intermediate API to fetch and cache mapset and beatmap data.
 * The class isolates API interactions and manages data caching internally.
 * Main methods:
 * - getMapsetData(mapsetId): Fetches mapset data by its ID, using cache or requesting from the API if not cached.
 * - getCalculatedBeatmapData(beatmapId): Fetches full beatmap data with PP by its ID,
 *   using cache or requesting from the API if not cached.
 */

class IntermediateOsuApiService {
    constructor() {
        //cache settings
        this.localStorageMapsetsKey = "beatmapsetsCache";
        this.localStorageMapsetsItemKey = "beatmapset";
        this.localStorageBeatmapsKey = "beatmapsCache";
        this.localStorageBeatmapsItemKey = "beatmap";
        this.localStorageBeatmapsAmountKey = "beatmapsCount";
        this.mapsetsCacheLimit = 600;
        this.mapsetsCacheClearItems = 300;
        this.beatmapsPPCacheLimit = 200;
        this.beatmapsPPCacheClearItems = 200;
    }

    async getMapsetsData(mapsetsIds = []) {
        try {
            if (!Array.isArray(mapsetsIds) || !(mapsetsIds.length > 1)) {
                throw new Error(`Undefined array or empty`);
            }

            let idsToFetch = [];
            let result = {};

            for (const mapsetId of mapsetsIds) {
                const mapsetDataFromCache = this.getDataFromCacheById(mapsetId, this.localStorageMapsetsItemKey, this.localStorageMapsetsKey);
                if (mapsetDataFromCache) {
                    result[mapsetId] = mapsetDataFromCache;
                } else {
                    idsToFetch.push(mapsetId);
                }
            }

            if (idsToFetch.length > 0) {
                const fetchedBeatmapsets = await this.getBeatmapsetsData(idsToFetch);
                Object.assign(result, fetchedBeatmapsets);

                for (const mapsetId of idsToFetch) {
                    const fetchedData = fetchedBeatmapsets[mapsetId];
                    if (fetchedData) {
                        this.cacheDataToObjectWithId(mapsetId, this.localStorageMapsetsItemKey, this.localStorageMapsetsKey, fetchedData);
                    }
                }
            }

            return result;
        } catch(err) {
            throw new Error("Ну пиписечька", { cause: err });
        }
    }

    /**
     * Retrieves and caches filtered mapset data.
     * If the mapset data is already cached, it is returned from the cache.
     * Otherwise, it fetches the data from the intermediate server and caches it for future use.
     *
     * @param {string} mapsetId - The unique identifier of the mapset.
     * @returns {Promise<Object>} - The filtered mapset data.
     */
    async getMapsetData(mapsetId) {
        const beatmapsetDataFromCache = this.getDataFromCacheById(mapsetId, this.localStorageMapsetsItemKey, this.localStorageMapsetsKey);
        if (beatmapsetDataFromCache) {
            log('Mapset data received from the cache', 'debug');
            return beatmapsetDataFromCache;
        }

        const beatmapsetDataFiltered = await this.getBeatmapsetData(mapsetId);
        if (beatmapsetDataFiltered) {
            this.clearBeatmapsetsCacheIfNeeded();
            this.cacheDataToObjectWithId(mapsetId, this.localStorageMapsetsItemKey, this.localStorageMapsetsKey, beatmapsetDataFiltered);
        }

        return beatmapsetDataFiltered;
    }

    async getBeatmapsetsData(mapsetsIds) {
        try {
            const result = {};
            const idsString = mapsetsIds.join(',');

            // Отправляем запрос через GET, передавая ids в query string
            const response = await axios.get(`/api/MapsetsData?mapsetsIds=${idsString}`);

            for (const [beatmapsetId, beatmapsetData] of Object.entries(response.data)) {
                result[beatmapsetId] = this.processBeatmapsetData(beatmapsetId, beatmapsetData);
            }

            return result;
        } catch (error) {
            throw new Error('Failed to fetch mapset data', {cause : error});
        }
    }

    /**
     * Fetches beatmapset data from server and filter it, leaving only the required fields.
     *
     * @param {string} mapsetId - The unique identifier of the mapset.
     * @returns {Promise<Object>} - The filtered mapset data.
     */
    async getBeatmapsetData(mapsetId) {
        try {
            const response = await axios.get(`/api/MapsetData/${mapsetId}`);
            return this.processBeatmapsetData(mapsetId, response.data);
        } catch (error) {
            return null;
        }
    }

    processBeatmapsetData(beatmapsetId, beatmapsetData) {
        try {
            const beatmapsetBeatmapRequiredFields = ["difficulty_rating", "bpm", "max_combo", "accuracy", "ar", "cs", "drain", "mode", "id"];
            if (!(typeof beatmapsetData === 'object' && beatmapsetData !== null && 'id' in beatmapsetData)) {
                throw new Error(`Received bad response for ${beatmapsetId} mapset`);
            }
            const dateForCache = this.getDateForCache(beatmapsetData);
            const beatmaps = beatmapsetData.beatmaps.map((beatmap) =>
                this.filterObject(beatmap, beatmapsetBeatmapRequiredFields)
            );
            let beatmapsetDataFiltered = {...this.filterObject(beatmapsetData, ['bpm']), beatmaps};
            beatmapsetDataFiltered.date = dateForCache;
            return beatmapsetDataFiltered;
        } catch(err) {
            log(`Failed to process beatmapsetData for ${beatmapsetId}: ${err.message}`, 'dev', 'error');
        }
    }

    /**
     * Retrieves and caches calculated beatmap data by Rosu-js at the server.
     * If the beatmap data is already cached, it is returned from the cache.
     * Otherwise, it fetches the data from the intermediate server and caches it for future use.
     *
     * @param {string} beatmapId - The unique identifier of the beatmap.
     * @returns {Promise<Object>} - The filtered beatmap calculated data.
     */
    async getCalculatedBeatmapData(beatmapId) {
        const cachedBeatmapPP = this.getCalculatedBeatmapDataFromCache(beatmapId);
        if (cachedBeatmapPP) {
            return cachedBeatmapPP;
        } else {
            const beatmapStructure = await this.getBeatmapStructureAsText(beatmapId);
            const filteredBeatmapCalcData = await this.getFilteredCalculatedBeatmapData(beatmapId, beatmapStructure);
            log(filteredBeatmapCalcData, 'debug');
            this.clearBeatmapsCacheIfNeeded();
            this.cacheDataToObjectWithId(beatmapId, this.localStorageBeatmapsItemKey, this.localStorageBeatmapsKey, filteredBeatmapCalcData);
            return filteredBeatmapCalcData;
        }
    }

    /**
     * Fetches beatmap calculated data by rosu-pp.js from server and filter it, leaving only the required fields.
     *
     * @param {string} beatmapId - The unique identifier of the beatmap.
     * @param {string} beatmapStructure - The unique identifier of the mapset.
     * @returns {Promise<Object>} - The filtered mapset data.
     */
    async getFilteredCalculatedBeatmapData(beatmapId, beatmapStructure) {
        try {
            const response = await axios.post(`/api/BeatmapPP/${beatmapId}`, {
                beatmap: beatmapStructure,
            });
            log(response.data, 'debug');
            let filteredBeatmapCalcData = this.filterCalculatedBeatmapData(response.data);
            filteredBeatmapCalcData.date = new Date().toISOString();
            return response.data;
        } catch (error) {
            log(`Failed to get beatmap pp`, 'prod', 'error');
            throw new Error(`Failed to get beatmap pp:\n ${error}`);
        }
    }

    /**
     * Retrieves the calculated beatmap data from the cache by beatmap ID.
     * This function looks for the cached data in `localStorage` using the `localStorageBeatmapsKey` and the specific `beatmapId`.
     * If the data is found in the cache, it is returned. Otherwise, it logs a message indicating that no data was found.
     *
     * @param {string} beatmapId - The ID of the beatmap whose calculated data is being retrieved.
     * @returns {Object|null} - The cached beatmap data if found, or null if no cached data has not saved.
     */
    getCalculatedBeatmapDataFromCache(beatmapId) {
        try {
            const cache = JSON.parse(localStorage.getItem(this.localStorageBeatmapsKey)) || {};
            const cacheKey = this.localStorageBeatmapsItemKey + '_' + beatmapId;
            if (cache[cacheKey]) {
                log('PP data recived from cache', 'dev');
                return cache[cacheKey];
            } else {
                log(`No cached data found for ${beatmapId}`, 'debug');
                return null;
            }
        } catch (error) {
            log(`Failed to retrieve cached beatmap pp:\n ${error}`, 'dev', 'error');
            return null;
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
            //Checking the object in case the wrong saved value
            if (beatmapsInCacheAmountInCache >= this.mapsetsCacheLimit) {
                this.removeOldestItemsFromCache(this.localStorageMapsetsKey, this.mapsetsCacheClearItems);
                localStorage.setItem(this.localStorageBeatmapsAmountKey, (beatmapsInCacheAmountInCache
                    - this.mapsetsCacheClearItems).toString());
                log('Cleared some of the of cache for beatmapset', 'dev');
            } else {
                localStorage.setItem(this.localStorageBeatmapsAmountKey, beatmapsInCacheAmountInCache.toString());
            }
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
        log(`Clear ${count} items from ${key}`, 'dev');
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

    /**
     * Fetches the structure of a beatmap as text by its ID.
     * Makes an HTTP GET request to the osu! server to download the beatmap file that contains the layout of all objects.
     * The structure used for calculating various beatmap parameters by rosu-pp.js.
     *
     * @param {string} beatmapId - The ID of the beatmap to retrieve.
     * @returns {Promise<string|undefined>} - A promise that resolves to the beatmap structure as text if successful.
     */
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

    /**
     * Filters the relevant data from a full beatmap calculation object.
     * This function extracts specific properties from the `difficulty` and `pp` fields of the input object.
     *
     * @param {Object} fullCalcObject - The full beatmap calculation object containing all the data.
     * @returns {Object} filteredData - The filtered object containing only the relevant fields.
     */
    filterCalculatedBeatmapData(fullCalcObject) {
        const filteredData = {
            difficulty: {
                aim: fullCalcObject.difficulty?.aim,
                speed: fullCalcObject.difficulty?.speed,
                nCircles: fullCalcObject.difficulty?.nCircles,
                nSliders: fullCalcObject.difficulty?.nSliders,
                speedNoteCount: fullCalcObject.difficulty?.speedNoteCount,
                flashlight: fullCalcObject.difficulty?.flashlight,
            },
            pp: fullCalcObject.pp,
        };

        log(filteredData, 'full');
        return filteredData;
    }

    /**
     * Clears the beatmaps cache if the number of cached items exceeds the specified limit.
     * These options for method defined in the class constructor.
     * If the cache is full, it removes the oldest beatmaps to free up space.
     */
    clearBeatmapsCacheIfNeeded() {
        const cache = JSON.parse(localStorage.getItem(this.localStorageBeatmapsKey));
        if (cache) {
            const numberOfItems = Object.keys(cache).length;
            if (numberOfItems >= this.beatmapsPPCacheLimit) {
                this.removeOldestItemsFromCache(this.localStorageBeatmapsKey, this.beatmapsPPCacheClearItems);
                log(`Cleared ${this.beatmapsPPCacheClearItems} from beatmaps cache`, 'dev');
            }
        }
    }
}

export default IntermediateOsuApiService;
