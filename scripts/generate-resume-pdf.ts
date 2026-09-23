/** Build the downloadable CV from the /resume Svelte page. Run with Bun. */
/* oxlint-disable eslint/no-magic-numbers -- Point sizes and spacing values define the PDF layout. */
import { createWriteStream } from 'node:fs';
import { mkdir, readFile } from 'node:fs/promises';
import { dirname, resolve as resolvePath } from 'node:path';
import { fileURLToPath } from 'node:url';

import PDFKit from 'pdfkit';
import { type AST, parse } from 'svelte/compiler';

type Element = AST.RegularElement | AST.Component;
type Entry = {
  name: string;
  date: string;
  roles: string[];
  descriptions: string[];
  bullets: string[];
};
type Section =
  | { kind: 'profile'; title: string; paragraphs: string[] }
  | { kind: 'entries'; title: string; entries: Entry[] }
  | { kind: 'skills'; title: string; skills: { name: string; detail: string }[] };
type Resume = { name: string; lead: string; github: string; sections: Section[] };

const source = fileURLToPath(new URL('../src/routes/resume/+page.svelte', import.meta.url));
const defaultOutput = fileURLToPath(new URL('../static/ben-bergenwall-cv.pdf', import.meta.url));
const outputFlag = process.argv.indexOf('--output');
if (outputFlag >= 0 && !process.argv[outputFlag + 1]) {
  throw new Error('--output needs a path.');
}
const output = outputFlag >= 0 ? resolvePath(process.argv[outputFlag + 1]) : defaultOutput;

const colors = { ink: '#1c2733', muted: '#4d5b68', rule: '#cfd7df' };
const margins = { bottom: 30, left: 46, right: 46, top: 34 };
const fonts = { bold: 'Helvetica-Bold', regular: 'Helvetica' };

const elements = (parent: Element | AST.Fragment, name: string): Element[] => {
  const fragment = parent.type === 'Fragment' ? parent : parent.fragment;
  return fragment.nodes.filter(
    (node): node is Element =>
      (node.type === 'RegularElement' || node.type === 'Component') && node.name === name,
  );
};

const first = (parent: Element | AST.Fragment, name: string): Element => {
  const found = elements(parent, name).at(0);
  if (!found) {
    throw new Error(`CV source is missing ${name}.`);
  }
  return found;
};

const attribute = (element: Element, name: string): string => {
  const found = element.attributes.find(
    (item): item is AST.Attribute => item.type === 'Attribute' && item.name === name,
  );
  if (!found || !Array.isArray(found.value)) {
    throw new Error(`CV source is missing a static ${name} attribute.`);
  }
  return found.value
    .map((part) => {
      if (part.type !== 'Text') {
        throw new Error(`CV source has a dynamic ${name} attribute.`);
      }
      return part.data;
    })
    .join('');
};

const text = (element: Element): string => {
  const chunks: string[] = [];
  const visit = (fragment: AST.Fragment): void => {
    for (const node of fragment.nodes) {
      if (node.type === 'Text') {
        chunks.push(node.data);
      } else if (node.type === 'RegularElement' || node.type === 'Component') {
        visit(node.fragment);
      } else if (node.type !== 'Comment') {
        throw new Error(`CV source contains dynamic text in ${element.name}.`);
      }
    }
  };
  visit(element.fragment);
  return chunks.join('').replace(/\s+/g, ' ').trim();
};

const parseResume = (svelte: string): Resume => {
  const root = parse(svelte, { modern: true });
  const resume = elements(root.fragment, 'div').find((element) =>
    attribute(element, 'class').split(/\s+/).includes('resume'),
  );
  if (!resume) {
    throw new Error('CV source is missing the resume container.');
  }
  const intro = first(resume, 'header');
  const githubLink = elements(first(intro, 'nav'), 'a').find((link) =>
    attribute(link, 'href').startsWith('https://github.com/'),
  );
  if (!githubLink) {
    throw new Error('CV source is missing the GitHub link.');
  }

  const sections = elements(resume, 'section').map((section): Section => {
    const title = text(first(section, 'Heading'));
    const content = elements(section, 'div').at(0);
    const articles = content ? elements(content, 'article') : [];
    if (articles.length > 0) {
      return {
        entries: articles.map((article) => {
          const heading = first(article, 'div');
          return {
            bullets: elements(article, 'ul').flatMap((list) => elements(list, 'li').map(text)),
            date: text(first(heading, 'span')),
            descriptions: elements(article, 'p')
              .filter((item) => attribute(item, 'class').includes('entry-description'))
              .map(text),
            name: text(first(heading, 'Heading')),
            roles: elements(article, 'p')
              .filter((item) => attribute(item, 'class').includes('entry-role'))
              .map(text),
          };
        }),
        kind: 'entries',
        title,
      };
    }
    if (title === 'Profile') {
      if (!content) {
        throw new Error('CV source is missing the profile content.');
      }
      return { kind: 'profile', paragraphs: elements(content, 'Text').map(text), title };
    }
    if (title === 'Technical skills') {
      const list = first(section, 'dl');
      return {
        kind: 'skills',
        skills: elements(list, 'div').map((item) => ({
          detail: text(first(item, 'dd')),
          name: text(first(item, 'dt')),
        })),
        title,
      };
    }
    throw new Error(`Unexpected resume section: ${title}`);
  });

  return {
    github: attribute(githubLink, 'href'),
    lead: text(first(intro, 'Text')),
    name: text(first(intro, 'Heading')),
    sections,
  };
};

// oxlint-disable-next-line eslint/max-lines-per-function -- Keep the one-page layout sequence together.
const renderResume = (resume: Resume, document: PDFKit.PDFDocument): void => {
  const left = margins.left;
  const width = document.page.width - margins.left - margins.right;
  const bottom = document.page.height - margins.bottom;
  let y = margins.top;

  const height = (value: string, font: string, size: number, textWidth: number): number => {
    document.font(font).fontSize(size);
    return document.heightOfString(value, { lineGap: 1, width: textWidth });
  };
  const ensureSpace = (needed: number): void => {
    if (y + needed > bottom) {
      document.addPage();
      y = margins.top;
    }
  };
  const draw = (
    value: string,
    options: {
      x?: number;
      width?: number;
      font?: string;
      size?: number;
      color?: string;
      after?: number;
    },
  ): void => {
    const x = options.x ?? left;
    const textWidth = options.width ?? width;
    const font = options.font ?? fonts.regular;
    const size = options.size ?? 8.8;
    const textHeight = height(value, font, size, textWidth);
    ensureSpace(textHeight + (options.after ?? 0));
    document
      .font(font)
      .fontSize(size)
      .fillColor(options.color ?? colors.ink);
    document.text(value, x, y, { lineGap: 1, width: textWidth });
    y += textHeight + (options.after ?? 0);
  };
  const sectionTitle = (title: string): void => {
    ensureSpace(28);
    document
      .strokeColor(colors.rule)
      .lineWidth(0.6)
      .moveTo(left, y)
      .lineTo(left + width, y)
      .stroke();
    y += 7;
    draw(title, { after: 5, font: fonts.bold, size: 10 });
  };
  const entry = (item: Entry): void => {
    const nameWidth = width * 0.64;
    const dateWidth = width - nameWidth;
    const rowHeight = Math.max(
      height(item.name, fonts.bold, 9.5, nameWidth),
      height(item.date, fonts.regular, 8.3, dateWidth),
    );
    ensureSpace(rowHeight + 26);
    document.font(fonts.bold).fontSize(9.5).fillColor(colors.ink);
    document.text(item.name, left, y, { lineGap: 1, width: nameWidth });
    document.font(fonts.regular).fontSize(8.3).fillColor(colors.muted);
    document.text(item.date, left + nameWidth, y, {
      align: 'right',
      lineGap: 1,
      width: dateWidth,
    });
    y += rowHeight + 2;
    for (const role of item.roles) {
      draw(role, { after: 2, size: 8.8 });
    }
    for (const description of item.descriptions) {
      draw(description, { after: 2, color: colors.muted, size: 8.8 });
    }
    for (const bullet of item.bullets) {
      const bulletHeight = height(bullet, fonts.regular, 8.8, width - 16);
      ensureSpace(bulletHeight + 2);
      document
        .fillColor(colors.muted)
        .circle(left + 5, y + 5, 1.5)
        .fill();
      draw(bullet, { after: 2, color: colors.muted, width: width - 13, x: left + 13 });
    }
    y += 5;
  };

  draw(resume.name, { after: 4, font: fonts.bold, size: 21 });
  draw(resume.lead, { after: 5, size: 10.5 });
  const githubLabel = resume.github.replace(/^https:\/\//, '');
  const linkHeight = height(githubLabel, fonts.regular, 9, width);
  document.font(fonts.regular).fontSize(9).fillColor(colors.muted);
  document.text(githubLabel, left, y, { link: resume.github, width });
  y += linkHeight + 12;

  for (const section of resume.sections) {
    sectionTitle(section.title);
    if (section.kind === 'profile') {
      for (const paragraph of section.paragraphs) {
        draw(paragraph, { after: 5, color: colors.muted });
      }
      y += 2;
    } else if (section.kind === 'entries') {
      for (const item of section.entries) {
        entry(item);
      }
    } else {
      const columnWidth = width / section.skills.length;
      const heights = section.skills.map((skill) => {
        const cellWidth = columnWidth - 8;
        return (
          height(skill.name, fonts.bold, 8.8, cellWidth) +
          height(skill.detail, fonts.regular, 8.8, cellWidth) +
          3
        );
      });
      ensureSpace(Math.max(...heights));
      let tallest = 0;
      for (const [index, skill] of section.skills.entries()) {
        const x = left + index * columnWidth;
        const cellWidth = columnWidth - 8;
        const nameHeight = height(skill.name, fonts.bold, 8.8, cellWidth);
        const detailHeight = height(skill.detail, fonts.regular, 8.8, cellWidth);
        tallest = Math.max(tallest, nameHeight + detailHeight + 3);
        document.font(fonts.bold).fontSize(8.8).fillColor(colors.ink);
        document.text(skill.name, x, y, { lineGap: 1, width: cellWidth });
        document.font(fonts.regular).fontSize(8.8).fillColor(colors.muted);
        document.text(skill.detail, x, y + nameHeight + 3, { lineGap: 1, width: cellWidth });
      }
      y += tallest;
    }
  }
  if (y > bottom) {
    throw new Error('The CV content overflowed its final page.');
  }
};

const main = async (): Promise<void> => {
  const resume = parseResume(await readFile(source, 'utf8'));
  await mkdir(dirname(output), { recursive: true });
  const document = new PDFKit({
    info: { Author: 'Ben Bergenwall', Title: 'Ben Bergenwall - CV' },
    margins,
    size: 'A4',
  });
  const stream = createWriteStream(output);
  const complete = new Promise<void>((resolve, reject) => {
    stream.on('finish', resolve);
    stream.on('error', reject);
    document.on('error', reject);
  });
  document.pipe(stream);
  renderResume(resume, document);
  document.end();
  await complete;
  process.stdout.write(`Generated ${output}\n`);
};

await main();
