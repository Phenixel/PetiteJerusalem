document.addEventListener('scroll', function() {
    const scrolled = window.pageYOffset;
    const parallax = document.querySelector('.hero-header');
    parallax.style.setProperty('--parallax-offset', `${scrolled * 0.1}px`);
});