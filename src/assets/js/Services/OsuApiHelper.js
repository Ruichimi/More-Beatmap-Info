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
        console.log('Вызванна функция getMapsetData');
        try {
            const response = await axios.get(`http://localhost:3000/api/MapsetData/${mapsetId}`);
            console.log('Данные мапсета:', response.data);
            return response.data;
        } catch (error) {
            console.error('Ошибка:', error);
        }
    }

    async getBeatmapData(beatmapId) {
        try {
            const response = await axios.get(`http://localhost:3000/api/BeatmapData/${beatmapId}`);
            console.log('Данные мапсета:', response.data);
            return response.data;
        } catch (error) {
            console.error('Ошибка:', error);
        }
    }

}

export default new OsuApi();
