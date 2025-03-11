import axios from 'axios';
import Config from '/config';
import Cookies from "js-cookie";
import {setToken, refreshClientToken} from './Services/token';
import showNotificationErrorIfNotExist from '@/js/Notifications/TooManyRequestsNotification';
import log from "@/js/logger.js";

//TODO: Make sure that if refreshTokenPromise will fail, it won't request it everytime.

/**
 * Encapsulated axios instance for JWT token handling and protection against duplicate requests.
 */

const instance = axios.create({
    timeout: 12000,
});

let stopAllRequests = false;
let isTokenRefreshing = false;
let refreshTokenPromise = null;
let ongoingRequests = new Set();

/**
 * Cleans up the list of ongoing requests after they are completed.
 *
 * - Removes the request from the list if it fails.
 * - If the error is a 429 (Too Many Requests), displays a notification with an option to reload the extension.
 */
instance.interceptors.response.use(
    (response) => {
        ongoingRequests.delete(response.config.url);
        return response;
    },
    (error) => {
        ongoingRequests.delete(error.config?.url);

        if (error.response && error.response.status === 429) {
            showNotificationErrorIfNotExist();
        }
        return Promise.reject(error);
    }
);

/**
 * A crucial interceptor for handling tokens.
 *
 * - Rejects requests if `stopAllRequests` is `true` or if the request is already in the ongoing requests list.
 * - Adds the request to the list if it's not already there.
 * - Checks if the request has an `x-retry-request` header and does nothing if the header is present.
 * - Attempts to retrieve the token from cookies and includes it, along with a special `clientIdToken`, in every request.
 * - If the token is invalid or missing, another interceptor may handle token refreshing.
 * In that case, it checks `isTokenRefreshing` and awaits `refreshTokenPromise` set token into request and send it.
 */
instance.interceptors.request.use(async config => {
    if (stopAllRequests) {
        return Promise.reject(new axios.Cancel(`Reject the request because all requests are stopped.: ${config.url}`));
    }
    if (ongoingRequests.has(config.url)) {
        return Promise.reject(new axios.Cancel(`Duplicate request blocked: ${config.url}`));
    }
    ongoingRequests.add(config.url);

    if (!config.headers['x-retry-request']) {
        if (isTokenRefreshing) await refreshTokenPromise;
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
 * The important interceptor for handling a valid token.
 *
 * If a 403 error is received from the server, it indicates that the token is either invalid or nonexistent.
 * - Only once, via 'isTokenRefreshing', after the first request with a 403 error, the token update process will begin.
 *   The token update is a promise that will write the token into the cookie and return it.
 * - All requests, including the first one that triggered the token update, will wait for the new token promise and will retry with it.
 *   It automatically and encapsulates the token handling, including updating and retrying requests.
 * Additionally, the request will have the `x-retry-request` header set to ensure it is ignored by the previous interceptor.
 */
instance.interceptors.response.use(
    response => response,
    async error => {
        if (error.response && error.response.status === 403) {
            if (!isTokenRefreshing) {
                isTokenRefreshing = true;
                log('403 Forbidden: Refreshing token...', 'dev', 'warn');
                refreshTokenPromise = refreshClientToken();
            }

            const newToken = await refreshTokenPromise;
            error.config.headers['Authorization'] = `Bearer ${newToken}`;
            error.config.headers['x-retry-request'] = true;
            isTokenRefreshing = false;
            return instance(error.config);
        }
        return Promise.reject(error);
    }
);

export default instance;
