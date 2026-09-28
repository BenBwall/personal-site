// @ts-check

/** @import {} from 'lighthouse-ci-types/types/assert' */
/** @import {} from 'lighthouse-ci-types/types/collect' */
/** @import {} from 'lighthouse-ci-types/types/lighthouse' */
/** @import {} from 'lighthouse-ci-types/types/lighthouserc' */
/** @import {} from 'lighthouse-ci-types/types/server' */
/** @import {} from 'lighthouse-ci-types/types/upload' */
/** @import {} from 'lighthouse-ci-types/types/wizard' */

/** @satisfies {LHCI.LighthouseRc} */
const config = {
  ci: {
    assert: {
      assertions: {
        'categories:accessibility': ['error', { aggregationMethod: 'pessimistic', minScore: 1 }],
        'categories:best-practices': ['error', { aggregationMethod: 'pessimistic', minScore: 1 }],
        'categories:performance': ['error', { aggregationMethod: 'median', minScore: 0.95 }],
        'categories:seo': ['error', { aggregationMethod: 'pessimistic', minScore: 1 }],
        'network-dependency-tree-insight': 'off',
        'render-blocking-insight': ['error', { maxLength: 0 }],
        'render-blocking-resources': ['error', { maxLength: 0 }],
      },
      preset: 'lighthouse:recommended',
    },
    collect: {
      numberOfRuns: 3,
      staticDistDir: './dist',
      url: [
        'http://localhost/',
        'http://localhost/projects/',
        'http://localhost/resume/',
        'http://localhost/rapport/',
      ],
    },
    upload: {
      outputDir: './lighthouse-reports',
      target: 'filesystem',
    },
  },
};

module.exports = config;
