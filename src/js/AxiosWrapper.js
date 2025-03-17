import axios from 'axios';
import Config from '/config';
import Cookies from "js-cookie";
import showNotificationErrorIfNotExist from '@/js/Notifications/TooManyRequestsNotification';
import log from "@/js/logger.js";

/**
 * Encapsulated Axios instance for handling JWT tokens and protecting against duplicate requests.
 * Includes logic for:
 * - Automatic token refreshing
 * - Blocking duplicate and failed requests
 * - Handling rate limiting (429 errors)
 * - Stopping all requests when necessary
 */

const instance = axios.create({
    baseURL: 'http://localhost:3000',
    timeout: 12000,
});

let reRequestTokenDelay = 4000; //4 seconds

let stopAllRequests = false;
let isTokenRefreshing = false;
let refreshTokenPromise = null;

// Sets to track ongoing, failed, and forbidden requests
let ongoingRequests = new Set();
let failedRequests = new Set();
let doubleFailedRequests = new Set();
let forbiddenRequests = new Set();

/**
 * Removes an object from specified lists after a delay if status is 429 (Too Many Requests)
 */
const clearObjectFromListsIf429WithDelay = async (status, lists = [], objectToRemove) => {
    if (status === 429) {
        await new Promise(resolve => setTimeout(resolve, reRequestTokenDelay));
        lists.forEach(list => list.delete(objectToRemove));
    }
}

/**
 * Continues processing requests after a delay if the status is 429.
 */
const continueRequestingIf429 = async (status, url) => {
    if (status === 429) {
        await clearObjectFromListsIf429WithDelay(status, [doubleFailedRequests, forbiddenRequests], url);
        ongoingRequests.clear();
        stopAllRequests = false;
    }
};


/**
 * Refreshes the client token by making a request to the token endpoint.
 * If it fails, all requests are stopped.
 */
const refreshClientToken = async () => {
    try {
        const response = await instance.post('/api/token');
        const newToken = response.data.token;
        Cookies.set('client_token', newToken, {
            expires: 100,
            secure: true
        });
        return newToken;
    } catch (err) {
        log('Failed to refresh token, all requests has been stopped', 'dev', 'error');
        stopAllRequests = true;
        continueRequestingIf429(err.status, '/api/token');
    }
}

/**
 * Tries to refresh the token if another request is already doing so.
 */
const tryRefreshToken = async () => {
    try {
        if (isTokenRefreshing) {
            const newToken = await refreshTokenPromise;
            if (!newToken) {
                throw new Error('token is empty or undefined');
            }
            return newToken;
        }
    } catch (err) {
        isTokenRefreshing = false;
    }
}

/**
 * Sets the token into request header.
 */
const setToken = (headerName, token, errorMessage) => {
    if (!token) throw new Error(errorMessage);
    return {[headerName]: token};
};

/**
 * Blocks repeated failed requests to prevent infinite loops.
 */
const repeatedFailedRequestsBlocker = (error) => {
    let requestHasBeenBanned = false;
    const requestUrl = error.config?.url;
    if (!requestUrl) return false;

    ongoingRequests.delete(requestUrl);

    if (failedRequests.has(requestUrl)) {
        if (doubleFailedRequests.has(requestUrl)) {
            forbiddenRequests.add(requestUrl);
            if (error.response) clearObjectFromListsIf429WithDelay(error.response.status,
                [doubleFailedRequests, forbiddenRequests], requestUrl)
            requestHasBeenBanned = true;
        } else {
            doubleFailedRequests.add(requestUrl);
        }
    } else {
        failedRequests.add(requestUrl);
    }

    return requestHasBeenBanned;
}

/**
 * Cleans up the list of ongoing requests after completion.
 * Also handles 429 errors by displaying a notification.
 */
instance.interceptors.response.use(
    (response) => {
        ongoingRequests.delete(response.config.url);
        failedRequests.delete(response.config.url);
        doubleFailedRequests.delete(response.config.url);
        return response;
    },
    (error) => {
        const urlHasBeenBanned = repeatedFailedRequestsBlocker(error);
        if (urlHasBeenBanned) return Promise.reject(error);
        if (error.response && error.response.status === 429) showNotificationErrorIfNotExist();

        return Promise.reject(error);
    }
);

/**
 * Request interceptor:
 * - Rejects requests if `stopAllRequests` is `true`, the request is banned, or it is already ongoing.
 * - Adds the request to `ongoingRequests` to prevent duplicates.
 * - Waits if the token is currently being refreshed.
 * - Automatically includes authentication tokens in request headers.
 * - Skips token injection for retried requests (`x-retry-request` is set).
 */
instance.interceptors.request.use(async config => {
    if (stopAllRequests) {
        return Promise.reject(new axios.Cancel(`Reject the request because all requests are stopped.: ${config.url}`));
    }
    if (forbiddenRequests.has(config.url)) {
        console.warn(`${config.url} has been banned`);
        return Promise.reject(new axios.Cancel(`Request has been denied: ${config.url}`));
    }
    if (ongoingRequests.has(config.url)) {
        return Promise.reject(new axios.Cancel(`Duplicate request blocked: ${config.url}`));
    }
    if (config?.url === '/api/token') {
        return config;
    }
    ongoingRequests.add(config.url);

    await tryRefreshToken;

    if (!config.headers['x-retry-request']) {
        let token = Cookies.get('client_token');
        const clientIdToken = Config.client_id;

        config.headers = {
            ...config.headers,
            ...setToken('Authorization', `Bearer ${token}`, `Failed to get client token: '${token}'`),
            ...setToken('x-client-id', clientIdToken, `Failed to get client id token: '${clientIdToken}'`)
        };
    }

    return config;
}, error => Promise.reject(error));

/**
 * Response interceptor for handling token expiration.
 * If a 403 error is received, it triggers token refreshing.
 * - The first request with a 403 starts the token refresh process.
 * - Other requests wait for the new token and retry automatically.
 */
instance.interceptors.response.use(
    response => response,
    async error => {
        if (error.response && error.response.status === 403) {
            if (stopAllRequests) {
                return Promise.reject(new axios.Cancel(`Reject the request because all requests are stopped.: ${error.config.url}`));
            }
            if (!isTokenRefreshing) {
                isTokenRefreshing = true;
                log('403 Forbidden: Refreshing token...', 'dev', 'warn');
                refreshTokenPromise = refreshClientToken();
            }

            const newToken = await tryRefreshToken();
            if (newToken) {
                error.config.headers['Authorization'] = `Bearer ${newToken}`;
                error.config.headers['x-retry-request'] = true;
                isTokenRefreshing = false;
                return instance(error.config);
            }
        }

        return Promise.reject(error);
    }
);

export default instance;
