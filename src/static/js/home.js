document.addEventListener('DOMContentLoaded', function() {
    const completedSection = document.querySelector('.hero-liste-lecture.completed .content-liste-lecture');
    const cards = Array.from(completedSection.querySelectorAll('.card'));

    if (cards.length === 0) {
        return;
    }

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