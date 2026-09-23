<script lang="ts">
  import { base } from '$app/paths';
  import { Heading, Text } from '$lib/components/typography';
  import { projects } from '$lib/data/projects';
  import { siGithub } from 'simple-icons';

  const previewWidths = [320, 480, 640, 960];
  const previewSizes = '(max-width: 38rem) calc(100vw - 2rem), 36rem';
  const previewSources = (name: string, format: 'avif' | 'webp') =>
    previewWidths
      .map((width) => `${base}/images/generated/${name}-${width}.${format} ${width}w`)
      .join(', ');
</script>

<svelte:head>
  <title>Projects | Ben Bergenwall</title>
  <meta
    name="description"
    content="Three projects I've built: my personal site, Myvm, and bcc-rust."
  />
</svelte:head>

<div class="projects-page">
  <header class="projects-intro">
    <Heading level={1}>Projects</Heading>
    <div class="intro-copy">
      <Text variant="lead">
        Three projects I've built, spanning web development, virtual machines, and compiler
        development.
      </Text>
    </div>
  </header>

  <section class="project-list" aria-label="Selected projects">
    {#each projects as project (project.id)}
      <article class="project-row" id={project.id} aria-labelledby={`${project.id}-title`}>
        <header class="project-heading">
          <Heading level={2} id={`${project.id}-title`} style="margin: 0">
            {project.title}
          </Heading>
          <a
            class="github-link"
            href={project.href}
            aria-label={`View ${project.title} on GitHub`}
            title={`View ${project.title} on GitHub`}
          >
            <span aria-hidden="true">{@html siGithub.svg}</span>
          </a>
          {#if project.liveUrl}
            <a class="live-link" href={project.liveUrl}>Visit site</a>
          {/if}
        </header>
        <div class="project-details">
          <Text>{project.description}</Text>
        </div>
        {#if project.preview}
          <picture class="project-preview">
            <source
              type="image/avif"
              srcset={previewSources(project.preview.name, 'avif')}
              sizes={previewSizes}
            />
            <img
              src={`${base}/images/generated/${project.preview.name}-640.webp`}
              srcset={previewSources(project.preview.name, 'webp')}
              sizes={previewSizes}
              alt={project.preview.alt}
              width={project.preview.width}
              height={project.preview.height}
              loading="lazy"
              decoding="async"
            />
          </picture>
        {/if}
        {#if project.demo}
          <video
            class="project-demo"
            controls
            muted
            playsinline
            preload="none"
            src={`${base}${project.demo.src}`}
            poster={project.demo.poster ? `${base}${project.demo.poster}` : undefined}
            aria-label={`${project.title} demo`}
          >
            {#if project.demo.captions}
              <track
                kind="captions"
                src={`${base}${project.demo.captions.src}`}
                srclang={project.demo.captions.language}
                label={project.demo.captions.label}
                default
              />
            {/if}
            <a href={`${base}${project.demo.src}`}>Download the {project.title} demo</a>
          </video>
        {/if}
      </article>
    {/each}
  </section>
</div>

<style>
  .projects-page {
    padding-block: clamp(1rem, 4vw, 3rem);
    font-family: system-ui, sans-serif;
  }

  .projects-intro {
    margin-bottom: 2.5rem;
  }

  .intro-copy {
    max-width: 52ch;
    margin-bottom: 1rem;
  }

  a {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    min-height: 2rem;
    color: light-dark(var(--color-700), var(--color-300));
    font-size: 0.875rem;
    line-height: 1.6;
    text-underline-offset: 0.25em;
  }

  a:hover {
    color: light-dark(var(--color-950), var(--color-50));
  }

  a:focus-visible {
    outline: 2px solid light-dark(var(--color-600), var(--color-300));
    outline-offset: 3px;
    border-radius: 2px;
  }

  .github-link:hover {
    background: light-dark(var(--color-100), var(--color-900));
  }

  .live-link {
    margin-inline-start: 0.5rem;
  }

  .github-link :global(svg) {
    display: block;
    width: 24px;
    height: 24px;
    fill: light-dark(#000, #fff);
  }

  .project-list {
    display: grid;
    gap: clamp(2.5rem, 5vw, 4rem);
  }

  .project-row {
    display: grid;
    gap: 1rem;
    max-width: 56rem;
    min-width: 0;
  }

  .project-heading {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
    min-width: 0;
  }

  .project-heading :global(h2) {
    /* Center the icon against the letters rather than the font's extra leading. */
    text-box: trim-both cap alphabetic;
  }

  .project-details {
    min-width: 0;
    max-width: 62ch;
  }

  .project-demo {
    display: block;
    width: 100%;
    aspect-ratio: 16 / 9;
    object-fit: contain;
    border-radius: 0.5rem;
    background: light-dark(var(--color-100), var(--color-900));
  }

  .project-preview {
    display: block;
    width: 100%;
    max-width: 36rem;
  }

  .project-preview img {
    display: block;
    width: 100%;
    height: auto;
    border-radius: 0.5rem;
  }

  .project-demo:focus-visible {
    outline: 2px solid light-dark(var(--color-600), var(--color-300));
    outline-offset: 3px;
  }
</style>
