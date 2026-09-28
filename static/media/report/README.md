# Report demo media

These files were optimized from the supplied `demo.mp4`. The original is kept outside
the public assets and was not modified.

- `myvm-demo.mp4`: H.264, 1920 × 1080, 30 fps, CRF 26, AAC at 96 kb/s.
- `myvm-demo.m4a`: the same compressed AAC track, extracted without another encode.
- `myvm-demo-poster.webp`: a 1280-pixel-wide frame at five seconds, WebP quality 80.
- `myvm-demo.vtt`: Swedish captions generated locally with Whisper large-v3, then
  cleaned up and split into shorter cues using its word timestamps. They cover the
  narration through 45.62 seconds; the full audio transcript is also in the report.

Both MP4 containers use fast start, and both players use `preload="none"`.
Metadata and the source timecode track were removed from the public files.

To replace the recording, run these commands with its path in place of `input.mp4`:

```sh
ffmpeg -i input.mp4 -map 0:v:0 -map 0:a:0 -vf fps=30 -c:v libx264 -preset slow -crf 26 -pix_fmt yuv420p -c:a aac -b:a 96k -map_metadata -1 -map_chapters -1 -write_tmcd 0 -movflags +faststart myvm-demo.mp4
ffmpeg -i myvm-demo.mp4 -map 0:a:0 -vn -c:a copy -map_metadata -1 -map_chapters -1 -movflags +faststart myvm-demo.m4a
ffmpeg -ss 5 -i myvm-demo.mp4 -vf scale=1280:-2 -frames:v 1 -c:v libwebp -quality 80 -map_metadata -1 myvm-demo-poster.webp
whisper input.mp4 --language sv --model large-v3 --fp16 False --beam_size 1 --best_of 1 --temperature 0 --condition_on_previous_text False --no_speech_threshold None --word_timestamps True --output_format all
```

Review the wording and word timestamps, split the captions into readable cues,
and save them as `myvm-demo.vtt`. Keep the report's audio transcript in sync.
