import type { Reroute } from '@sveltejs/kit';

// Static hosts serve the same page with or without an explicit index.html filename.
export const reroute: Reroute = ({ url }) => url.pathname.replace(/\/index\.html$/, '/');
