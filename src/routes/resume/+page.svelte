<script lang="ts">
  import { asset } from '$app/paths';
  import { Heading, Text } from '$lib/components/typography';

  const cvPdf = asset('/ben-bergenwall-cv.pdf');
</script>

<svelte:head>
  <title>Resume | Ben Bergenwall</title>
  <meta
    name="description"
    content="Ben Bergenwall's experience, education, and technical skills."
  />
</svelte:head>

<div class="resume">
  <header class="resume-intro">
    <Heading level={1}>Ben Bergenwall</Heading>
    <Text variant="lead">Software Developer<span>, Espoo, Finland</span></Text>
    <nav class="resume-links" aria-label="Resume links">
      <a href="https://github.com/BenBwall">GitHub</a>
      <a href={cvPdf} target="_blank" rel="noopener" type="application/pdf">View PDF</a>
      <a href={cvPdf} download="Ben-Bergenwall-CV.pdf" type="application/pdf">Download PDF</a>
    </nav>
  </header>

  <section aria-labelledby="profile-title">
    <Heading level={2} size={4} id="profile-title">Profile</Heading>
    <div class="section-content profile-copy">
      <Text>
        I've been coding since 2019 and enjoy turning ideas into practical tools. I've built a
        complete web application for a small business, as well as larger personal projects in Rust,
        Java and Python.
      </Text>
      <Text>
        After completing 130 ECTS in Computer Science, I'm continuing my studies toward a Bachelor
        of Engineering in Information Technology at Arcada.
      </Text>
    </div>
  </section>

  <section aria-labelledby="experience-title">
    <Heading level={2} size={4} id="experience-title">Experience</Heading>
    <div class="section-content entries">
      <article>
        <div class="entry-heading">
          <Heading level={3} size={5}>Prevalabs</Heading>
          <span class="entry-meta">September 2026 - Present</span>
        </div>
        <p class="entry-role">Junior Software Developer</p>
        <p class="entry-description">
          I work on a web app for clinicians to assess kidney disease risk and follow up with
          patients. I'm working on both the frontend and backend. We use Next.js for the frontend
          and Hono with Drizzle for the backend.
        </p>
      </article>
      <article>
        <div class="entry-heading">
          <Heading level={3} size={5}>Viherkeskinen</Heading>
          <span class="entry-meta">January 2026 - Present</span>
        </div>
        <p class="entry-role">Freelance Software Developer</p>
        <ul>
          <li>
            Built a multilingual, mobile-friendly time-tracking app for a landscaping company, with
            an admin panel for reviewing reports and managing the system.
          </li>
          <li>
            Added passwordless login, user permissions, customizable reports, and synchronization
            with Google Sheets and Microsoft Excel.
          </li>
          <li>
            Developed the app with Next.js, TypeScript, tRPC, Prisma and PostgreSQL, under the
            technical supervision of Andreas Bergenwall.
          </li>
        </ul>
      </article>
      <article>
        <div class="entry-heading">
          <Heading level={3} size={5}>Helppy</Heading>
          <span class="entry-meta">October - December 2021</span>
        </div>
        <p class="entry-role">Junior Frontend Engineer</p>
        <p class="entry-description">
          Built customer-facing website features and a pricing calculator for a Finnish eldercare
          startup using TypeScript and Next.js during a ten-week fixed-term role.
        </p>
      </article>
      <article>
        <div class="entry-heading">
          <Heading level={3} size={5}>Folkhälsan</Heading>
          <span class="entry-meta">Spring 2021</span>
        </div>
        <p class="entry-role">Substitute After-School Club Instructor</p>
        <p class="entry-description">
          Supervised children across several after-school clubs, assisted with homework, and
          received positive feedback for a strong work ethic.
        </p>
      </article>
    </div>
  </section>

  <section aria-labelledby="education-title">
    <Heading level={2} size={4} id="education-title">Education</Heading>
    <div class="section-content entries">
      <article>
        <div class="entry-heading">
          <Heading level={3} size={5}>Arcada University of Applied Sciences</Heading>
          <span class="entry-meta">Autumn 2026 - Target 2028</span>
        </div>
        <p class="entry-role">Bachelor of Engineering in Information Technology</p>
        <p class="entry-description">Helsinki, Ingenjör (YH), informationsteknik</p>
      </article>
      <article>
        <div class="entry-heading">
          <Heading level={3} size={5}>Åbo Akademi University</Heading>
          <span class="entry-meta">2021 - 2025</span>
        </div>
        <p class="entry-role">Bachelor's studies in Computer Science (datavetenskap)</p>
        <p class="entry-description">Turku, 130 ECTS credits completed</p>
      </article>
      <article>
        <div class="entry-heading">
          <Heading level={3} size={5}>Mattlidens gymnasium</Heading>
          <span class="entry-meta">2018 - 2021</span>
        </div>
        <p class="entry-role">Finnish Matriculation Examination (studentexamen)</p>
        <p class="entry-description">Espoo, Completed spring 2021</p>
        <p class="entry-description">
          Completed a University of Helsinki Java programming MOOC through an elective IT course.
        </p>
      </article>
    </div>
  </section>

  <section aria-labelledby="skills-title">
    <Heading level={2} size={4} id="skills-title">Technical skills</Heading>
    <dl class="section-content skills">
      <div>
        <dt>Programming languages</dt>
        <dd>TypeScript, JavaScript, Rust, Java, Python, C#, C, F#, Kotlin, Scala</dd>
      </div>
      <div>
        <dt>Web and data</dt>
        <dd>Next.js, React, tRPC, Tailwind CSS, PostgreSQL, Prisma</dd>
      </div>
      <div>
        <dt>Testing and delivery</dt>
        <dd>Playwright, unit testing, GitHub Actions, Vercel, PWA development</dd>
      </div>
    </dl>
  </section>
</div>

<style>
  .resume {
    padding-block: clamp(1rem, 4vw, 3rem);
    font-family: system-ui, sans-serif;
  }

  .resume-intro {
    padding-bottom: 2.5rem;
  }

  .resume-intro span,
  .entry-meta,
  .entry-description,
  li,
  dd {
    color: light-dark(var(--color-600), var(--color-400));
  }

  .resume-links {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 1.5rem;
    margin-top: 1.25rem;
  }

  .resume-links a {
    display: inline-block;
    color: light-dark(var(--color-700), var(--color-300));
    text-underline-offset: 0.25em;
  }

  .resume-links a:hover {
    color: light-dark(var(--color-950), var(--color-50));
  }

  .resume-links a:focus-visible {
    outline: 2px solid light-dark(var(--color-600), var(--color-300));
    outline-offset: 3px;
  }

  section {
    display: grid;
    grid-template-columns: 11rem minmax(0, 1fr);
    gap: 2rem;
    padding-block: 2rem;
    border-top: 1px solid var(--theme-border-color);
  }

  .section-content {
    min-width: 0;
  }

  .entries {
    display: grid;
    gap: 2rem;
  }

  .entry-heading {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.25rem 1rem;
  }

  .entry-meta {
    font-size: 0.875rem;
    line-height: 1.6;
  }

  .entry-role,
  .entry-description,
  li,
  dl {
    line-height: 1.65;
  }

  .entry-role,
  .entry-description {
    margin: 0.5rem 0 0;
  }

  .entry-role {
    font-size: 0.9375rem;
  }

  ul {
    margin: 0.75rem 0 0;
    padding-left: 1.25rem;
  }

  li + li {
    margin-top: 0.5rem;
  }

  dl {
    display: grid;
    gap: 1rem;
    margin: 0;
  }

  dt {
    font-weight: 600;
  }

  dd {
    margin: 0.25rem 0 0;
  }

  @media (max-width: 52rem) {
    section {
      grid-template-columns: 1fr;
      gap: 1rem;
    }
  }

  @media print {
    :global(html:has(.resume)) {
      color-scheme: light !important;
      color: #111;
      background: #fff;
    }

    :global(.layout:has(.resume) > header) {
      display: none;
    }

    :global(.layout:has(.resume) > main) {
      width: 100%;
      padding: 0;
    }

    .resume {
      padding: 0;
    }

    .resume-intro {
      padding-bottom: 1rem;
    }

    section {
      grid-template-columns: 9rem minmax(0, 1fr);
      gap: 1rem;
      padding-block: 1rem;
      border-color: #ccc;
    }

    article {
      break-inside: avoid;
    }

    :global(.resume .heading[data-tone]),
    :global(.resume .text[data-tone]) {
      color: #111;
    }

    .resume-intro span,
    .entry-meta,
    .entry-description,
    li,
    dd {
      color: #444;
    }

    .resume-links a {
      color: #111;
    }

    .resume-links a:not(:first-child) {
      display: none;
    }
  }
</style>
