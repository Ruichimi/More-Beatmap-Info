import axios from 'axios';
import { getClientToken, refreshClientToken } from './Services/token';
import { showNotification, closeNotification } from "@/js/Services/notification";
import Config from '/config';

const instance = axios.create({
    timeout: 10000,
});

let isRefreshing = false;
let refreshTokenPromise = null;
let isNotificationOnScreen = false;
instance.interceptors.response.use(
    (response) => {
        return response;
    },
    (error) => {
        if (error.response && error.response.status === 429) {
            if (!isNotificationOnScreen) {
                console.log('Показываем уведомление');
                const notification = showNotification('Too many requests! Please try again later.');
                isNotificationOnScreen = true;

                setTimeout(() => {
                    closeNotification(notification);
                    isNotificationOnScreen = false;
                }, 10000);
            }
        }
        return Promise.reject(error);
    }
);

const setToken = (headerName, token, errorMessage) => {
    if (!token) throw new Error(errorMessage);
    return { [headerName]: token };
};

/**
 * Adds jwt and client id tokens to request header
 */

instance.interceptors.request.use(async config => {
    if (!config.headers['x-retry-request']) {
        const token = await getClientToken();
        const clientIdToken = Config.client_id;

        config.headers = {
            ...config.headers,
            ...setToken('Authorization', `Bearer ${token}`, `Failed to get client token: '${token}'`),
            ...setToken('x-client-id', clientIdToken, `Failed to get client id token: '${clientIdToken}'`)
        };

        return config;
    }
}, error => Promise.reject(error));

/**
 * If we're getting 403 error from server (Forbidden/Access denial), attempt to refresh the token
 * and retry the original request. If token refresh is in progress, queue the requests
 * that failed due to token expiration and resolve them once the token refresh is complete.
 */

instance.interceptors.response.use(
    response => response,
    async error => {
        if (error.response && error.response.status === 403) {
            if (!isRefreshing) {
                isRefreshing = true;
                console.warn('403 Forbidden: Refreshing token...');

                refreshTokenPromise = refreshClientToken();
            }

            const newToken = await refreshTokenPromise;
            if (isRefreshing) isRefreshing = false;
            error.config.headers['Authorization'] = `Bearer ${newToken}`;
            error.config.headers['x-retry-request'] = true;
            return instance(error.config);
        }

        console.error('Error:', error.response ? error.response.data : error.message);
        return Promise.reject(error);
    }
);

export default instance;
