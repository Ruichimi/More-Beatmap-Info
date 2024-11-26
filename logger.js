// Current log level that determines which logs will be displayed
const currentLogLevel = 'dev';

const logPriority = {
    'prod': 0,      // For production environment, lowest priority
    'dev': 1,       // For development, higher priority
    'debug': 2,     // For debugging, even higher priority
    'full': 3       // For full logging, highest priority
};

/**
 * Logs data to the console based on the specified log level and type.
 * Checks if the log level is valid and whether it meets the current log level's priority.
 * Logs the data with the appropriate console method based on the log type.
 *
 * @param {any} data - The data to log (string, object, etc.).
 * @param {string} logLevel - The log level (e.g., 'info', 'warn', 'error').
 * @param {string} [logType='log'] - The type of log ('log', 'warn', or 'error').
 */

const log = (data, logLevel, logType = 'log') => {
    if (logPriority[logLevel] === undefined) {
        console.warn(`Invalid log level: ${logLevel}`);
        return;
    }
    if (logPriority[logLevel] <= logPriority[currentLogLevel]) {
        switch (logType) {
            case 'error':
                console.error(data);
                break;
            case 'warn':
                console.warn(data);
                break;
            default:
                console.log(data);
                break;
        }
    }
};

export default log;
