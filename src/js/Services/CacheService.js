import log from "@/js/logger";

class CacheService {
    constructor() {
        this.localStorageMapsetsKey = "beatmapsetsCache";
        this.localStorageMapsetsItemKey = "beatmapset";
        this.localStorageBeatmapsKey = "beatmapsCache";
        this.localStorageBeatmapsItemKey = "beatmap";
        this.mapsetsCacheLimit = 600;
        this.mapsetsCacheClearItems = 300;
        this.beatmapsPPCacheLimit = 50;
        this.beatmapsPPCacheClearItems = 40;
    }

    getMapset(mapsetId) {
        return this.#getItemFromCacheById(mapsetId, this.localStorageMapsetsItemKey, this.localStorageMapsetsKey);
    }

    setMapset(mapsetId, mapsetData) {
        this.#clearCacheIfNeeded(this.localStorageMapsetsKey, this.mapsetsCacheLimit, this.mapsetsCacheClearItems);
        return this.#setItemWithId(mapsetId, mapsetData, this.localStorageMapsetsItemKey, this.localStorageMapsetsKey);
    }

    getBeatmap(beatmapId) {
        return this.#getItemFromCacheById(beatmapId, this.localStorageBeatmapsItemKey, this.localStorageBeatmapsKey);
    }

    setBeatmap(id, data) {
        this.#clearCacheIfNeeded(this.localStorageBeatmapsKey, this.beatmapsPPCacheLimit, this.beatmapsPPCacheClearItems);
        this.#setItemWithId(id, data, this.localStorageBeatmapsItemKey, this.localStorageBeatmapsKey);
    }

    /** TODO: Optimize
     * Searching for beatmap info in the beatmapsets cache by its ID.
     *
     * The function might work slowly if there are too many beatmapsets in the cache,
     * and it is used for non-constant function calls.
     *
     * @param {int} mapId - id of beatmap in beatmapset.
     * @returns {Object|null}
     */
    getBeatmapInfoByIdFromMapsetsCache(mapId) {
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
     * Retrieves data from localStorage by a unique ID and cache item name.
     *
     * @param {string} cacheItemId - The unique identifier for the cache item.
     * @param {string} cacheItemName - The name or type of the cache item (e.g., 'user', 'beatmap').
     * @param {string} cacheName - The name of the cache in localStorage where the data might be stored.
     * @returns {object|null} - The cached data associated with the specified ID and name, or null if not found.
     */
    #getItemFromCacheById(cacheItemId, cacheItemName, cacheName) {
        const cacheKey = `${cacheItemName}_${cacheItemId}`;
        const beatmapsetsCache = JSON.parse(localStorage.getItem(cacheName));
        if (beatmapsetsCache && beatmapsetsCache[cacheKey]) {
            return beatmapsetsCache[cacheKey];
        }
        return null;
    }

    /**
     * Stores data in localStorage under a specified cache name and associates it with a unique ID and name.
     *
     * @param {string} cacheItemId - The unique identifier for the cache item.
     * @param {any} data - The data to be stored, which will be serialized into JSON format.
     * @param {string} cacheItemName - The name or type of the cache item (e.g., 'user', 'beatmap').
     * @param {string} cacheName - The name of the cache in localStorage where the data will be stored.
     * @returns {void}
     */
    #setItemWithId(cacheItemId, data, cacheItemName, cacheName) {
        const localStorageObject = JSON.parse(localStorage.getItem(cacheName)) || {};
        const cacheKey = `${cacheItemName}_${cacheItemId}`;
        localStorageObject[cacheKey] = data;
        localStorage.setItem(cacheName, JSON.stringify(localStorageObject));
    }

    /**
     * Clears the specified cache in localStorage if the number of items
     * has reached or exceeded the limit.
     */
    #clearCacheIfNeeded(cacheName, itemsLimit, clearItemsCount) {
        const cache = JSON.parse(localStorage.getItem(cacheName));
        if (cache) {
            const numberOfItems = Object.keys(cache).length;
            if (numberOfItems >= itemsLimit) {
                this.#removeOldestItemsFromCache(cacheName, clearItemsCount);
                log(`Cleared ${clearItemsCount} from beatmaps cache`, 'dev');
            }
        }
    }

    /**
     * Removes the oldest items from a cached object stored in localStorage.
     *
     * @param {string} key - The localStorage key where the cached object is stored.
     * @param {number} count - The number of oldest items to remove.
     * @returns {void}
     */
    #removeOldestItemsFromCache(key, count) {
        const oldestItems = this.#getOldestItemsFromCache(key, count);
        log(oldestItems, 'debug');
        const storageData = JSON.parse(localStorage.getItem(key)) || {};

        oldestItems.forEach(item => {
            delete storageData[item.key];
        });

        localStorage.setItem(key, JSON.stringify(storageData));
        log(`Clear ${count} items from ${key}`, 'dev');
    }

    /**
     * Retrieves the oldest items from a cached object stored in localStorage.
     * Date should be as ISO string.
     *
     * @param {string} key - The localStorage key where the cached object is stored.
     * @param {number} count - The number of oldest items to retrieve.
     * @returns {Array} An array of the oldest items, each including its original key and data.
     */
    #getOldestItemsFromCache(key, count) {
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
}

export default new CacheService();
