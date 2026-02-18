window.addEventListener('pageshow', function(e) {
  if (e.persisted) window.location.reload();
});
