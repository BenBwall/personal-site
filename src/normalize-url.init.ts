// Normalize static page filenames before SvelteKit reads the initial URL.
if (location.pathname.endsWith('/index.html')) {
  history.replaceState(
    history.state,
    '',
    `${location.pathname.replace(/\/index\.html$/, '/')}${location.search}${location.hash}`,
  );
}
