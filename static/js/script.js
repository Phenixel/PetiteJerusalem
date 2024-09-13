// Fonction pour basculer entre les vues
function toggleView(viewType) {
    const urlParams = new URLSearchParams(window.location.search);
    urlParams.set('display', viewType);
    window.location.search = urlParams.toString();
}

// Gestion du thème
document.addEventListener('DOMContentLoaded', () => {
    const themeToggleBtn = document.getElementById('theme-toggle');
    const currentTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', currentTheme);
    updateThemeIcon(currentTheme);

    themeToggleBtn.addEventListener('click', () => {
        const newTheme = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        updateThemeIcon(newTheme);
    });
});

function updateThemeIcon(theme) {
    const icon = document.getElementById('theme-toggle').querySelector('i');
    if (theme === 'dark') {
        icon.classList.replace('fa-moon', 'fa-sun');
    } else {
        icon.classList.replace('fa-sun', 'fa-moon');
    }
}

document.addEventListener('DOMContentLoaded', function() {
    const completedSection = document.querySelector('.hero-liste-lecture.completed .content-liste-lecture');
    const cards = Array.from(completedSection.querySelectorAll('.card'));
    const containerWidth = completedSection.offsetWidth;
    let totalWidth = cards.reduce((acc, card) => acc + card.offsetWidth, 0);

    while (totalWidth < containerWidth * 2) {
        cards.forEach(card => {
            const clone = card.cloneNode(true);
            completedSection.appendChild(clone);
            totalWidth += card.offsetWidth;
        });
    }

    completedSection.style.width = `${totalWidth}px`;
});