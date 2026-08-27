document.addEventListener('click', (event) => {
  const link = event.target.closest('a[data-target]');
  if (!link) return;
  const target = link.dataset.target;
  if (Array.isArray(window.dataLayer)) {
    window.dataLayer.push({ event: 'portal_version_select', version: target });
  }
});
