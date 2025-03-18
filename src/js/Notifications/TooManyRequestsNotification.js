import {closeNotification, showNotification, transformNotification} from "@/js/Notifications/notification";

let isNotificationOnScreen = false;

function showNotificationErrorIfNotExist() {
    if (!isNotificationOnScreen) {
        const notification = showNotification('More Beatmap Info: Too many requests. Please wait a little.');
        isNotificationOnScreen = true;

        setTimeout(() => {
            transformNotification(notification, getButtonToReloadExtension(notification));
        },  10000);

        setTimeout(() => {
            closeNotification(notification);
            isNotificationOnScreen = false;
        }, 25000);

        return notification;
    }
}

function getButtonToReloadExtension(notification) {
    const button = document.createElement('button');
    button.textContent = 'Click Me';
    button.id = 'notification-button';

    button.innerHTML = `
    <svg class="icon-svg" fill="rgba(255, 255, 255, 0.85)" width="24px" height="24px" viewBox="0 0 24 24" id="update-alt" xmlns="http://www.w3.org/2000/svg">
        <path id="primary" d="M5.07,8A8,8,0,0,1,20,12" style="fill: none; stroke: rgba(255, 255, 255, 0.85); stroke-linecap: round; stroke-linejoin: round; stroke-width: 2;"></path>
        <path id="primary-2" data-name="primary" d="M18.93,16A8,8,0,0,1,4,12" style="fill: none; stroke: rgba(255, 255, 255, 0.85); stroke-linecap: round; stroke-linejoin: round; stroke-width: 2;"></path>
        <polyline id="primary-3" data-name="primary" points="5 3 5 8 10 8" style="fill: none; stroke: rgba(255, 255, 255, 0.85); stroke-linecap: round; stroke-linejoin: round; stroke-width: 2;"></polyline>
        <polyline id="primary-4" data-name="primary" points="19 21 19 16 14 16" style="fill: none; stroke: rgba(255, 255, 255, 0.85); stroke-linecap: round; stroke-linejoin: round; stroke-width: 2;"></polyline>
    </svg>
`;


    button.addEventListener('click', () => {
        const customEvent = new CustomEvent('reloadExtensionRequested');
        window.dispatchEvent(customEvent);
        closeNotification(notification);
        isNotificationOnScreen = false;
    });

    return button;
}

export default showNotificationErrorIfNotExist;
