<script lang="ts">
  import { asset } from '$app/paths';
  import { Heading, Text } from '$lib/components/typography';

  const smallPhotoWidth = 320;
  const mediumPhotoWidth = 480;
  const largePhotoWidth = 640;
  const extraLargePhotoWidth = 960;
  const photoWidths = [
    smallPhotoWidth,
    mediumPhotoWidth,
    largePhotoWidth,
    extraLargePhotoWidth,
  ] as const;
  const photos = [
    { alt: 'Me sitting outdoors by the sea', name: 'sitting-outdoors-by-the-sea' },
    { alt: 'Me standing on a cliff on the beach', name: 'standing-on-a-cliff-on-the-beach' },
  ] as const;
  const photoSizes = '(max-width: 35rem) calc(50vw - 2rem), 250px';

  const photoSources = (name: (typeof photos)[number]['name'], format: 'avif' | 'webp') =>
    photoWidths
      .map((width) => `${asset(`/images/generated/${name}-${width}.${format}`)} ${width}w`)
      .join(', ');
</script>

<svelte:head>
  <title>Home | Ben Bergenwall</title>
  <meta
    name="description"
    content="Hi, I'm Ben, a web developer and Information Technology student at Arcada University of Applied Sciences."
  />
  {#each photos as photo (photo.name)}
    <link
      rel="preload"
      as="image"
      type="image/avif"
      imagesrcset={photoSources(photo.name, 'avif')}
      imagesizes={photoSizes}
      fetchpriority="high"
    />
  {/each}
</svelte:head>

<section class="home-page" aria-labelledby="about-title">
  <div class="about-copy">
    <Heading level={1} id="about-title">About me</Heading>
    <Text variant="lead">
      Hi, I'm Ben, a web developer and Information Technology student at Arcada University of
      Applied Sciences.
    </Text>
    <Text>
      I've been programming for about seven years. Alongside my work in web development, I like to
      work on a wide array of side-projects in my freetime.
    </Text>
  </div>

  <div class="about-gallery" role="group" aria-label="Photos of me">
    {#each photos as photo (photo.name)}
      <figure>
        <picture>
          <source type="image/avif" srcset={photoSources(photo.name, 'avif')} sizes={photoSizes} />
          <img
            src={asset(`/images/generated/${photo.name}-640.webp`)}
            srcset={photoSources(photo.name, 'webp')}
            sizes={photoSizes}
            alt={photo.alt}
            width="1200"
            height="1600"
            decoding="sync"
            fetchpriority="high"
            loading="eager"
          />
        </picture>
      </figure>
    {/each}
  </div>
</section>

<style>
  .home-page {
    display: grid;
    grid-template-columns: 1.1fr 1fr;
    align-items: center;
    gap: clamp(2rem, 4vw, 4rem);
    padding-block: clamp(1rem, 4vw, 3rem);
    font-family: system-ui, sans-serif;
  }

  .about-copy {
    min-width: 0;
    max-width: 52ch;
  }

  .about-gallery {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.75rem;
    width: 100%;
    max-width: 32rem;
    min-width: 0;
    justify-self: end;
  }

  figure {
    min-width: 0;
    margin: 0;
    overflow: hidden;
    border: 1px solid var(--theme-border-color);
    border-radius: 0.5rem;
    background: light-dark(var(--color-100), var(--color-900));
  }

  img {
    display: block;
    width: 100%;
    height: auto;
    aspect-ratio: 3 / 4;
    object-fit: cover;
  }

  @media (max-width: 52rem) {
    .home-page {
      grid-template-columns: 1fr;
    }

    .about-gallery {
      justify-self: start;
    }
  }
</style>
