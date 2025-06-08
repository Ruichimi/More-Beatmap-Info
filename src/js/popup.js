const issueLink = document.querySelector('.issue-report-link');

issueLink.addEventListener('click', (e) => {
    e.preventDefault();
    window.open('https://github.com/Ruichimi/More-Beatmap-Info/issues', '_blank');
});

