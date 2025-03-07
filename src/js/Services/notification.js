function showNotification(message) {
    const notification = document.createElement('div');
    notification.id = 'notification';
    notification.textContent = message;

    const button = document.createElement('button');
    button.textContent = 'Click Me';
    button.id = 'notification-button';
    button.addEventListener('click', () => {
        const customEvent = new CustomEvent('reloadExtensionRequested');
        document.dispatchEvent(customEvent);
    });

    notification.appendChild(button);

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.right = '20px';
    }, 100);

    return notification;
}

function closeNotification(notification) {
    setTimeout(() => {
        notification.classList.add('notification-fade-out');
        setTimeout(() => {
            notification.remove();
        }, 1000);
    }, 5000);
}

export { showNotification, closeNotification };
