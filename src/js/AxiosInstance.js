import axios from 'axios';
import { getClientToken, refreshClientToken } from './Services/token';
import Config from '/config';

const instance = axios.create();

let isRefreshing = false;
let failedQueue = [];

const setToken = (headerName, token, errorMessage) => {
    if (!token) throw new Error(errorMessage);
    return { [headerName]: token };
};

/**
 * Adds jwt and client id tokens to request header
 */

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

/**
 * If we're getting 403 error from server (Forbidden/Access denial), attempt to refresh the token
 * and retry the original request. If token refresh is in progress, queue the requests
 * that failed due to token expiration and resolve them once the token refresh is complete.
 */

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
