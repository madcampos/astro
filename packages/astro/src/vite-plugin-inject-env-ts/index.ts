import type { AstroSettings } from '../@types/astro.js';
import type fsMod from 'node:fs';
import { normalizePath, Plugin } from 'vite';
import path from 'node:path';
import { getContentPaths, getDotAstroTypeReference } from '../content/index.js';
import { info, LogOptions } from '../core/logger/core.js';
import { fileURLToPath } from 'node:url';
import { bold } from 'kleur/colors';

export function getEnvTsPath({ srcDir }: { srcDir: URL }) {
	return new URL('env.d.ts', srcDir);
}

export function astroInjectEnvTsPlugin({
	settings,
	logging,
	fs,
}: {
	settings: AstroSettings;
	logging: LogOptions;
	fs: typeof fsMod;
}): Plugin {
	return {
		name: 'astro-inject-env-ts',
		// Use `post` to ensure project setup is complete
		// Ex. `.astro` types have been written
		enforce: 'post',
		async config() {
			await setUpEnvTs({ settings, logging, fs });
		},
	};
}

export async function setUpEnvTs({
	settings,
	logging,
	fs,
}: {
	settings: AstroSettings;
	logging: LogOptions;
	fs: typeof fsMod;
}) {
	const envTsPath = getEnvTsPath(settings.config);
	const dotAstroDir = getContentPaths(settings.config).cacheDir;
	const dotAstroTypeReference = getDotAstroTypeReference(settings.config);
	const envTsPathRelativetoRoot = normalizePath(
		path.relative(fileURLToPath(settings.config.root), fileURLToPath(envTsPath))
	);

	if (fs.existsSync(envTsPath)) {
		// Add `.astro` types reference if none exists
		if (!fs.existsSync(dotAstroDir)) return;

		let typesEnvContents = await fs.promises.readFile(envTsPath, 'utf-8');
		const expectedTypeReference = getDotAstroTypeReference(settings.config);

		if (!typesEnvContents.includes(expectedTypeReference)) {
			typesEnvContents = `${expectedTypeReference}\n${typesEnvContents}`;
			await fs.promises.writeFile(envTsPath, typesEnvContents, 'utf-8');
			info(logging, 'content', `Added ${bold(envTsPathRelativetoRoot)} types`);
		}
	} else {
		// Otherwise, inject the `env.d.ts` file
		let referenceDefs: string[] = [];
		if (settings.config.integrations.find((i) => i.name === '@astrojs/image')) {
			referenceDefs.push('/// <reference types="@astrojs/image/client" />');
		} else {
			referenceDefs.push('/// <reference types="astro/client" />');
		}

		if (fs.existsSync(dotAstroDir)) {
			referenceDefs.push(dotAstroTypeReference);
		}

		await fs.promises.mkdir(settings.config.srcDir, { recursive: true });
		await fs.promises.writeFile(envTsPath, referenceDefs.join('\n'), 'utf-8');
		info(logging, 'astro', `Added ${bold(envTsPathRelativetoRoot)} types`);
	}
}