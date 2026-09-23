# Project demos

Place the recordings here as `personal-site.mp4`, `myvm.mp4`, and `bcc-rust.mp4` (WebM also works).

In `src/lib/data/projects.ts`, replace the matching project's `demo: null` with:

```ts
demo: {
  src: '/videos/projects/personal-site.mp4',
},
```

The player appears below the description, with native playback controls and no autoplay. It starts muted; viewers can enable sound.
Projects with `demo: null` have no player or empty placeholder. Rebuild after adding recordings.

Optional `poster` and `captions` fields accept paths relative to `static`:

```ts
demo: {
  src: '/videos/projects/personal-site.mp4',
  poster: '/videos/projects/personal-site.webp',
  captions: {
    src: '/videos/projects/personal-site.en.vtt',
    language: 'en',
    label: 'English',
  },
},
```

For narrated recordings, include WebVTT captions. Silent screen recordings can omit the caption track.
The player uses a 16:9 frame and fits other recording sizes without cropping.
