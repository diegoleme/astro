import type { AstroConfig, AstroUserConfig } from '../@types/astro-core';

import { existsSync } from 'fs';
import * as colors from 'kleur/colors';
import path from 'path';
import { pathToFileURL } from 'url';
import { z } from 'zod';

export const AstroConfigSchema = z.object({
  projectRoot: z
    .string()
    .optional()
    .default('.')
    .transform((val) => new URL(val)),
  src: z
    .string()
    .optional()
    .default('./src')
    .transform((val) => new URL(val)),
  pages: z
    .string()
    .optional()
    .default('./src/pages')
    .transform((val) => new URL(val)),
  layouts: z
    .string()
    .optional()
    .default('./src/layouts')
    .transform((val) => new URL(val)),
  public: z
    .string()
    .optional()
    .default('./public')
    .transform((val) => new URL(val)),
  dist: z
    .string()
    .optional()
    .default('./dist')
    .transform((val) => new URL(val)),
  renderers: z.array(z.string()).optional().default(['@astrojs/renderer-svelte', '@astrojs/renderer-vue', '@astrojs/renderer-react', '@astrojs/renderer-preact']),
  markdownOptions: z
    .object({
      footnotes: z.boolean().optional(),
      gfm: z.boolean().optional(),
      remarkPlugins: z.array(z.any()).optional(),
      rehypePlugins: z.array(z.any()).optional(),
      render: z.any().optional().default(['@astrojs/markdown-remark', {}]),
    })
    .optional()
    .default({}),
  buildOptions: z
    .object({
      site: z.string().optional(),
      sitemap: z.boolean().optional().default(true),
      pageUrlFormat: z
        .union([z.literal('file'), z.literal('directory')])
        .optional()
        .default('directory'),
    })
    .optional()
    .default({}),
  devOptions: z
    .object({
      hostname: z.string().optional().default('localhost'),
      port: z.number().optional().default(3000),
      tailwindConfig: z.string().optional(),
      trailingSlash: z
        .union([z.literal('always'), z.literal('never'), z.literal('ignore')])
        .optional()
        .default('ignore'),
    })
    .optional()
    .default({}),
  vite: z.any().optional().default({}), // TODO: we don’t need validation, but can we get better type inference?
});

/** Turn raw config values into normalized values */
export async function validateConfig(userConfig: any, root: string): Promise<AstroConfig> {
  const fileProtocolRoot = pathToFileURL(root + path.sep);
  // We need to extend the global schema to add transforms that are relative to root.
  // This is type checked against the global schema to make sure we still match.
  const AstroConfigRelativeSchema = AstroConfigSchema.extend({
    projectRoot: z
      .string()
      .default('.')
      .transform((val) => new URL(addTrailingSlash(val), fileProtocolRoot)),
    src: z
      .string()
      .default('./src')
      .transform((val) => new URL(addTrailingSlash(val), fileProtocolRoot)),
    pages: z
      .string()
      .default('./src/pages')
      .transform((val) => new URL(addTrailingSlash(val), fileProtocolRoot)),
    layouts: z
      .string()
      .default('./src/layouts')
      .transform((val) => new URL(addTrailingSlash(val), fileProtocolRoot)),
    public: z
      .string()
      .default('./public')
      .transform((val) => new URL(addTrailingSlash(val), fileProtocolRoot)),
    dist: z
      .string()
      .default('./dist')
      .transform((val) => new URL(addTrailingSlash(val), fileProtocolRoot)),
  });
  return AstroConfigRelativeSchema.parseAsync(userConfig);
}

interface LoadConfigOptions {
  cwd?: string;
  filename?: string;
}

/** Adds '/' to end of string but doesn’t double-up */
function addTrailingSlash(str: string): string {
  return str.replace(/\/*$/, '/');
}

interface LoadConfigOptions {
  cwd?: string;
  filename?: string;
}

/** Attempt to load an `astro.config.mjs` file */
export async function loadConfig(options: LoadConfigOptions): Promise<AstroConfig> {
  const root = options.cwd ? path.resolve(options.cwd) : process.cwd();
  const astroConfigPath = new URL(`./${options.filename || 'astro.config.mjs'}`, `file://${root}/`);
  let userConfig: AstroUserConfig = {};
  // Load a user-config, if one exists and is provided
  if (existsSync(astroConfigPath)) {
    userConfig = (await import(astroConfigPath.href)).default;
  }
  // normalize, validate, and return
  return validateConfig(userConfig, root);
}

export function formatConfigError(err: z.ZodError) {
  const errorList = err.issues.map((issue) => `  ! ${colors.bold(issue.path.join('.'))}  ${colors.red(issue.message + '.')}`);
  return `${colors.red('[config]')} Astro found issue(s) with your configuration:\n${errorList.join('\n')}`;
}
