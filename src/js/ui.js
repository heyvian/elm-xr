const body = document.querySelector('body');
const togglePanelBtn = document.querySelector('.js-info-panel-toggle');
const infoPanel = document.querySelector('.js-info-panel');
const supportedBlurb = document.querySelector('.js-device-support-blurb-supported');
const notSupportedBlurb = document.querySelector('.js-device-support-blurb-not-supported');

navigator.xr.isSessionSupported( 'immersive-ar' ).then( function ( supported ) {

    supported ? showSupportedBlurb() : showNotSupportedBlurb();

} ).catch( showNotSupportedBlurb );

function showSupportedBlurb() {
    supportedBlurb.classList.add('is-visible');
    supportedBlurb.setAttribute('aria-hidden', 'false');
    notSupportedBlurb.classList.add('not-visible');
    notSupportedBlurb.setAttribute('aria-hidden', 'true');
}

function showNotSupportedBlurb() {
    supportedBlurb.classList.add('not-visible');
    supportedBlurb.setAttribute('aria-hidden', 'true');
    notSupportedBlurb.classList.add('is-visible');
    notSupportedBlurb.setAttribute('aria-hidden', 'false');
}

function togglePanel() {
    if(body.classList.contains('has-menu-open')) {
        body.classList.remove('has-menu-open');
        // infoPanel.classList.remove('is-open');
        infoPanel.setAttribute('aria-hidden', 'true');
        togglePanelBtn.setAttribute('aria-label', 'Open more info panel');
    } else {
        body.classList.add('has-menu-open');
        // infoPanel.classList.add('is-open');
        infoPanel.setAttribute('aria-hidden', 'false');
        togglePanelBtn.setAttribute('aria-label', 'Close info panel');
    }
}

togglePanelBtn.addEventListener('click', e => {
    togglePanel();
});