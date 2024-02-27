import axios from "../axios";
import env from "/env.json";

class OsuApi {
    constructor() {
        this.baseUrl = 'https://osu.ppy.sh/api/v2/';
        this.clientId = env.osuApi.clientId;
        this.clientSecret = env.osuApi.clientSecret;
        this.accessToken = null;

        this.initPromise = this.init();
    }

    async init() {
        const response = await axios.post('https://osu.ppy.sh/oauth/token', `client_id=${this.clientId}&client_secret=${this.clientSecret}&grant_type=client_credentials&scope=public`, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json',
            },
        });

        this.accessToken = response.data.access_token;
    }

    async getMapsetData(mapsetId) {
        await this.initPromise;
        const response = await axios.get(this.baseUrl + `beatmapsets/${mapsetId}`, {
            headers: {
                'Authorization': `Bearer ${this.accessToken}`, 'Content-Type': 'application/json',
            },
        });

        return response.data;
    }

    async getBeatmapData(beatmapId) {
        await this.initPromise;

        const url = `${this.baseUrl}beatmaps/${beatmapId}/attributes`;

        const response = await axios.post(url, {}, {
            headers: {
                'Authorization': `Bearer ${this.accessToken}`,
                'Content-Type': 'application/json',
            },
        });

        return response.data;
    }

}

export default new OsuApi();
