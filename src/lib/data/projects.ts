export type ProjectDemo = {
  src: `/videos/projects/${string}`;
  poster?: `/${string}`;
  captions?: {
    src: `/${string}`;
    language: string;
    label: string;
  };
};

export type Project = {
  id: string;
  title: string;
  description: string;
  href: string;
  liveUrl?: string;
  preview?: {
    name: string;
    alt: string;
    width: number;
    height: number;
  };
  demo: ProjectDemo | null;
};

export const projects: readonly Project[] = [
  {
    demo: null,
    description:
      'My personal website, built with SvelteKit. I designed a responsive layout with light and dark themes, reusable components, and images optimized for different screen sizes.',
    href: 'https://github.com/BenBwall/personal-site',
    id: 'personal-site',
    title: 'Personal site',
  },
  {
    demo: null,
    description:
      'A virtual machine and assembler inspired by the game Turing Complete. I built a Rust assembler and runtime, plus a browser editor where programs can be assembled, inspected as bytecode, and stepped through one instruction at a time.',
    href: 'https://github.com/BenBwall/Myvm',
    id: 'myvm',
    liveUrl: 'https://vm.bwallker.com',
    preview: {
      alt: 'Myvm editor running an assembly program, with register values and a smiling emoji in the output.',
      height: 1078,
      name: 'myvm-preview',
      width: 1018,
    },
    title: 'Myvm',
  },
  {
    demo: null,
    description:
      'An experimental C compiler front end written in Rust. It preprocesses C source, parses C99 syntax, and provides syntax-tree views and error diagnostics through a command-line interface. Semantic analysis and code generation are still to come.',
    href: 'https://github.com/BenBwall/bcc-rust',
    id: 'bcc-rust',
    title: 'bcc-rust',
  },
];
