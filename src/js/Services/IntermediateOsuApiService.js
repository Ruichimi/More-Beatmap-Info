import axios from "../AxiosWrapper";
import cache from "./CacheService";
import log from "@/js/logger.js";

/**
 * Class for interacting with the osu! intermediate API to fetch and cache mapset and beatmap data.
 * The class isolates API interactions and manages data caching internally.
 * Main methods:
 * - getMapsetsData(mapsetsId): Retrieves data for many mapsets at once.
 * - getCalculatedBeatmapData(beatmapId): Retrieves full beatmap data with PP.
 */

class IntermediateOsuApiService {
    /**
     * Retrieves mapset data for a list of mapset IDs. Checks the cache first and fetches missing data.
     * If data is fetched, it is cached for future use.
     *
     * @param {Array<string>} mapsetsIds - List of mapset IDs to retrieve data for.
     * @returns {Object} - An object containing the mapset data for the requested IDs.
     * @throws {Error} - If the input is not a valid array or if fetching mapset data fails.
     */
    async getMapsetsData(mapsetsIds = []) {
        try {
            if (!Array.isArray(mapsetsIds) || !(mapsetsIds.length >= 1)) {
                throw new Error(`Undefined array or empty "${mapsetsIds}"`);
            }

            const {result, unfoundedIds} = this.#getExistMapsetsFromCacheByIds(mapsetsIds);

            if (unfoundedIds.length > 0) {
                const fetchedBeatmapsets = await this.#fetchMapsetsData(unfoundedIds);
                Object.assign(result, fetchedBeatmapsets);

                for (const mapsetId of unfoundedIds) {
                    const fetchedData = fetchedBeatmapsets[mapsetId];
                    if (fetchedData) {
                        cache.setMapset(mapsetId, fetchedData);
                    }
                }
            }

            return result;
        } catch (err) {
            throw new Error(`Failed to get mapset data\n${err.message}`);
        }
    }

    /**
     * Retrieves and caches calculated beatmap data from the server using Rosu-js.
     * If the beatmap data is already cached locally, it is returned from the cache.
     * If not, the server is checked for a cached result, and if unavailable,
     * the beatmap structure is fetched and new data is calculated.
     * Then the result is then cached locally.
     *
     * @param {string} beatmapId - The unique identifier of the beatmap.
     * @returns {Promise<Object>} - The filtered and calculated beatmap data.
     */
    async getCalculatedBeatmapData(beatmapId) {
        const cachedBeatmapPP = cache.getBeatmap(beatmapId);
        if (cachedBeatmapPP) {
            return cachedBeatmapPP;
        } else {
            const beatmapData = await this.#fetchCalculatedBeatmapData(beatmapId);
            cache.setBeatmap(beatmapId, beatmapData);
            return beatmapData;
        }
    }

    /**
     * Sends a request to the server to calculate beatmap data including PP.
     * To do this, it downloads the beatmap structure via the osu API
     * and sends it to the server for calculation.
     * The structure of the beatmap can be quite large, so this method is only used after ensuring
     * that the server does not already have this calculation data cached
     * via the tryGetCachedBeatmapPP method.
     * Otherwise, this would create an unnecessary load.
     *
     * @param {string|number} beatmapId
     * @returns {Promise<Object>}
     */
    async #fetchCalculatedBeatmapData(beatmapId) {
        const beatmapStructure = await this.#getBeatmapStructureAsText(beatmapId);
        const filteredBeatmapCalcData = await this.#getFilteredCalculatedBeatmapData(beatmapId, beatmapStructure);
        log(filteredBeatmapCalcData, 'debug');

        return filteredBeatmapCalcData;
    }

    /**
     * Attempts to retrieve the PP data of a beatmap from the server cache.
     * If the server already has it cached, we will receive it; otherwise, we will get null.
     *
     * @param {string|number} beatmapId
     * @returns {Promise<{difficulty: {[p: string]: *}, pp: number}|null>}
     */
    async tryGetCachedBeatmapPP(beatmapId) {
        try {
            const response = await axios.get(`/api/cachedBeatmapData/${beatmapId}`);
            if (!response.data || Object.keys(response.data).length === 0) {
                throw new Error(`Cached beatmap data is empty`);
            }
            const filteredBeatmapData = this.#filterCalculatedBeatmapData(response.data);
            cache.setBeatmap(beatmapId, filteredBeatmapData);
            return filteredBeatmapData;
        } catch (error) {
            return null;
        }
    }

    /**
     * Retrieves mapset data from cache for a list of mapset IDs.
     * Returns an object with found mapsets and an array of IDs not found in the cache.
     *
     * @param {Array<string>} mapsetsIds - Array of mapset IDs to check.
     * @returns {Object} - Object containing `result` (found data) and `unfoundedIds` (not found IDs).
     */
    #getExistMapsetsFromCacheByIds(mapsetsIds) {
        const result = {};
        const unfoundedIds = [];

        for (const mapsetId of mapsetsIds) {
            const mapsetDataFromCache = cache.getMapset(mapsetId);
            if (mapsetDataFromCache) {
                result[mapsetId] = mapsetDataFromCache;
            } else {
                unfoundedIds.push(mapsetId);
            }
        }

        return {result, unfoundedIds};
    }

    /**
     * Fetches mapset data from an external API for a list of mapset IDs.
     * Processes the data and returns the result as an object.
     *
     * @param {Array<string>} mapsetsIds - List of mapset IDs to fetch data for.
     * @returns {Object} - Processed mapset data for the requested IDs.
     * @throws {Error} - If the API request fails.
     */
    async #fetchMapsetsData(mapsetsIds) {
        try {
            const result = {};
            const idsString = mapsetsIds.join(',');

            const response = await axios.get(`/api/MapsetsData?mapsetsIds=${idsString}`);
            for (const [beatmapsetId, beatmapsetData] of Object.entries(response.data)) {
                result[beatmapsetId] = this.#processBeatmapsetData(beatmapsetId, beatmapsetData);
            }

            return result;
        } catch (error) {
            throw new Error(`Failed to fetch mapset data ${error.message}`);
        }
    }

    /**
     * Processes and filters the beatmapset data, extracting the necessary fields and preparing it for caching.
     *
     * @param {string} beatmapsetId - The unique identifier of the beatmapset.
     * @param {Object} beatmapsetData - The raw data of the beatmapset to be processed.
     * @returns {Object|null} - The filtered and processed beatmapset data, or null if processing fails.
     */
    #processBeatmapsetData(beatmapsetId, beatmapsetData) {
        try {
            const beatmapsetBeatmapRequiredFields = ["difficulty_rating", "bpm", "max_combo", "accuracy", "ar", "cs", "drain", "mode", "id"];
            if (!(typeof beatmapsetData === 'object' && beatmapsetData !== null && 'id' in beatmapsetData)) {
                throw new Error(`Received bad response for ${beatmapsetId} mapset`);
            }
            const dateForCache = this.#getDateForCache(beatmapsetData);
            const beatmaps = beatmapsetData.beatmaps.map((beatmap) =>
                this.#filterObject(beatmap, beatmapsetBeatmapRequiredFields)
            );
            let beatmapsetDataFiltered = {...this.#filterObject(beatmapsetData, ['bpm']), beatmaps};
            beatmapsetDataFiltered.date = dateForCache;
            return beatmapsetDataFiltered;
        } catch (err) {
            log(`Failed to process beatmapsetData for ${beatmapsetId}: ${err.message}`, 'dev', 'error');
        }
    }

    /**
     * Fetches beatmap calculated data by rosu-pp.js from server by beatmap structure text
     * and filter it, leaving only the required fields.
     *
     * @param {string} beatmapId - The unique identifier of the beatmap.
     * @param {string} beatmapStructure - The unique identifier of the mapset.
     * @returns {Promise<Object>} - The filtered mapset data.
     */
    async #getFilteredCalculatedBeatmapData(beatmapId, beatmapStructure) {
        try {
            const response = await axios.post(`/api/BeatmapPP/${beatmapId}`, {
                beatmap: beatmapStructure,
            });
            console.log(response.data);
            log(response.data, 'debug');
            return this.#filterCalculatedBeatmapData(response.data);
        } catch (error) {
            log(`Failed to get beatmap pp`, 'prod', 'error');
            throw new Error(`Failed to get beatmap pp:\n ${error}`);
        }
    }

    /**
     * Filters an object, keeping only the specified keys.
     *
     * @param {Object} beatmapData - The object to filter.
     * @param {Array} requiredFields - An array of keys to retain in the object.
     * @returns {Object} A new object containing only the keys specified in `requiredFields`.
     */
    #filterObject(beatmapData, requiredFields) {
        return Object.keys(beatmapData)
            .filter((key) => requiredFields.includes(key))
            .reduce((filteredObject, key) => {
                filteredObject[key] = beatmapData[key];
                return filteredObject;
            }, {});
    }

    /**
     * Fetches the structure of a beatmap as text by its ID.
     * Makes an HTTP GET request to the osu! server to download the beatmap file that contains the layout of all objects.
     * The structure used for calculating various beatmap parameters by rosu-pp.js.
     *
     * @param {string} beatmapId - The ID of the beatmap to retrieve.
     * @returns {Promise<string|undefined>} - A promise that resolves to the beatmap structure as text if successful.
     */
    async #getBeatmapStructureAsText(beatmapId) {
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
     * @throws {Error} If the input object does not have the required `pp` field.
     */
    #filterCalculatedBeatmapData(fullCalcObject) {
        if (!fullCalcObject || !fullCalcObject.pp) {
            throw new Error("Invalid input: 'pp' field is required");
        }

        const round = (value) => (value != null ? parseFloat(value.toFixed(3)) : undefined);

        const difficulty = Object.fromEntries(
            Object.entries(fullCalcObject.difficulty || {})
                .map(([key, value]) => [key, round(value)])
        );

        const filteredData = {difficulty, pp: round(fullCalcObject.pp)};
        filteredData.date = new Date().toISOString();
        log(filteredData, 'full');
        return filteredData;
    }

    /**
     * Retrieves the relevant date for caching from the provided beatmapset data.
     *
     * @param {Object} beatmapsetData - The data object containing date fields.
     * @returns {string|null} The ranked date if available; otherwise, the last updated date.
     */
    #getDateForCache(beatmapsetData) {
        return beatmapsetData.ranked_date || beatmapsetData.last_updated || new Date().toISOString();
    }
}

export default IntermediateOsuApiService;
