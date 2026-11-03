const PORTAL_URL = 'https://script.google.com/macros/s/AKfycbwxMBgBHl1hzU6tCfKWdOVpvUYFdgeqo6Sm1vyvuqQIQPsPiCxRO5EpH_2NaZDyJLVg/exec';
const view = document.body.dataset.view || 'inicio';
const destination = new URL(PORTAL_URL);
destination.searchParams.set('vista', view);
document.getElementById('openPortal').href = destination.href;
// Apps Script sirve las vistas para confirmar cada operación con google.script.run.
window.location.replace(destination.href);
