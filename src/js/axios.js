import axios from 'axios';
import Cookies from 'js-cookie';
import Config from '/config';

const instance = axios.create();

let isRefreshing = false;
let failedQueue = [];

const setToken = (headerName, token, errorMessage) => {
    if (!token) throw new Error(errorMessage);
    return { [headerName]: token };
};

async function getClientToken() {
    let token = Cookies.get('client_token');

    if (!token) {
        try {
            const response = await axios.post('http://localhost:3000/api/token');
            token = response.data.token;
            Cookies.set('client_token', token, { expires: 100, secure: true });
        } catch (error) {
            console.error('Failed to get client token:', error);
            return null;
        }
    }
    return token;
}

async function refreshClientToken() {
    try {
        const response = await axios.post('http://localhost:3000/api/token');
        const newToken = response.data.token;
        Cookies.set('client_token', newToken, { expires: 100, secure: true });
        return newToken;
    } catch (error) {
        console.error('Failed to refresh client token:', error);
        return null;
    }
}

instance.interceptors.request.use(async config => {
    const token = await getClientToken();
    const clientIdToken = Config.client_id;

    config.headers = {
        ...config.headers,
        ...setToken('Authorization', `Bearer ${token}`, `Failed to get client token: '${token}'`),
        ...setToken('x-client-id', clientIdToken, `Failed to get client id token: '${clientIdToken}'`)
    };

    return config;
}, error => Promise.reject(error));

instance.interceptors.response.use(
    response => response,
    async error => {
        const originalRequest = error.config;

        if (error.response && error.response.status === 403) {
            if (isRefreshing) {
                return new Promise((resolve, reject) => {
                    failedQueue.push({ resolve, reject });
                });
            }

            isRefreshing = true;
            console.warn('403 Forbidden: Refreshing token...');

            const newToken = await refreshClientToken();
            if (newToken) {
                originalRequest.headers['Authorization'] = `Bearer ${newToken}`;

                failedQueue.forEach(({ resolve }) => resolve(instance(originalRequest)));
                failedQueue = [];

                return instance(originalRequest);
            } else {
                failedQueue.forEach(({ reject }) => reject(error));
                failedQueue = [];
                return Promise.reject(error);
            }
        }

        console.error('Error:', error.response ? error.response.data : error.message);
        return Promise.reject(error);
    }
);

export default instance;
