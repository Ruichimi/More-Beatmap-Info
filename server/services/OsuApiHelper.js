const path = require("path");
const axios = require(path.resolve(__dirname, "./axios"));
const env = require(path.resolve(process.cwd(), './env.json'));

class OsuApiHelper {
    constructor() {
        this.baseUrl = 'https://osu.ppy.sh/api/v2/';
        this.clientId = env.osuApi.clientId;
        this.clientSecret = env.osuApi.clientSecret;
        this.accessToken = null;
    }

    async init() {
        const response = await axios.post('https://osu.ppy.sh/oauth/token', `client_id=${this.clientId}&client_secret=${this.clientSecret}&grant_type=client_credentials&scope=public`, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json',
            },
        });

        this.accessToken = response.data.access_token;
    }

    getMapsetData = async (mapsetId) => {
        const response = await axios.get(this.baseUrl + `beatmapsets/${mapsetId}`, {
            headers: {
                'Authorization': `Bearer ${this.accessToken}`, 'Content-Type': 'application/json',
            },
        });
        console.log(response.data);
        return response.data;
    }

    getBeatmapData = async (beatmapId) => {
        const url = `${this.baseUrl}beatmaps/${beatmapId}/attributes`;

        const response = await axios.post(url, {}, {
            headers: {
                'Authorization': `Bearer ${this.accessToken}`,
                'Content-Type': 'application/json',
            },
        });

        console.log(response.data);
        return response.data;
    }
}

module.exports = new OsuApiHelper();
