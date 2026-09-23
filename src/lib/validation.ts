import { z } from 'zod';

// Avoid eval probes and generated validators under the site's script-src policy.
z.config({ jitless: true });

export { z };
