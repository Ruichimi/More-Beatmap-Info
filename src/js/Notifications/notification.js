function showNotification(message) {
    const notification = document.createElement('div');
    notification.classList.add('notification');

    const content = document.createElement('div');
    content.className = 'notification-content';
    content.textContent = message;

    notification.appendChild(content);

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.right = '20px';
    }, 100);

    return notification;
}


function transformNotification(notification, newContent) {
    const oldContent = notification.querySelector('.notification-content');
    oldContent.classList.add('notification-fade-out');
    oldContent.addEventListener('animationend', () => {
        oldContent.innerHTML = '';
        oldContent.appendChild(newContent);
        oldContent.classList.remove('notification-fade-out');
        oldContent.classList.add('notification-fade-in');
        notification.classList.add('notification-remove-background');
    });
}

function closeNotification(notification = null) {
    notification.classList.add('notification-fade-out');
    setTimeout(() => {
        notification.remove();
    }, 1000);
}

export {showNotification, transformNotification, closeNotification};
