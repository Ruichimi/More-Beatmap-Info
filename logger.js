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
    // Validate log level
    if (!(logLevel in logPriority)) {
        console.warn(`Invalid log level: ${logLevel}`);
        return;
    }

    // Ensure log level priority meets the current log level
    if (logPriority[logLevel] > logPriority[currentLogLevel]) {
        return;
    }

    // Prepare common log properties
    const currentTime = new Date().toLocaleTimeString();
    const stack = new Error().stack.split('\n')[2]; // Get the stack trace, second line is the caller
    const callerInfo = stack ? stack.trim() : 'Unknown source';

    // Determine the style based on log type
    const styles = {
        'error': 'background: rgba(240, 93, 107, 0.2); color: white;',
        'warn': 'background: rgba(255, 255, 50, 0.2); color: white;',
        'log': 'color: white;'
    };

    const groupStyle = styles[logType] || styles['log'];

    // Log output
    try {
        console.groupCollapsed(`%c[${logLevel.toUpperCase()}] ${data}`, groupStyle);
        if (logType === 'error') {
            console.error(data);
        } else if (logType === 'warn') {
            console.warn(data);
        } else {
            console.log(data);
        }

        console.log(`Time: ${currentTime}`);
        console.log(`Caller info: ${callerInfo}`);
        console.groupEnd();
    } catch (error) {
        console.error('Error during logging:', error);
    }
};

export default log;
