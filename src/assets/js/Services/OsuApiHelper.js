import axios from "axios";
import env from "/env.json";

class OsuApi {
    constructor() {
        this.baseUrl = 'https://osu.ppy.sh/api/v2/';
        this.clientId = env.osuApi.clientId;
        this.clientSecret = env.osuApi.clientSecret;
        this.accessToken = null;


        this.getToken();
    }

    async getToken() {
        try {
            const response = await axios.post(
                'https://osu.ppy.sh/oauth/token',
                `client_id=${this.clientId}&client_secret=${this.clientSecret}&grant_type=client_credentials&scope=public`,
                {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'Accept': 'application/json',
                    },
                }
            );

            this.accessToken = response.data.access_token;

        } catch (error) {
            console.error('Error:', error.response ? error.response.data : error.message);
        }
    }

    async getMapsetData(beatmapId) {
        try {
            const response = await axios.get(this.baseUrl + `beatmapsets/${beatmapId}`, {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Content-Type': 'application/json',
                },
            });

            return response.data;

        } catch (error) {
            console.error('Error:', error.response ? error.response.data : error.message);
        }
    }


}

export default new OsuApi();
