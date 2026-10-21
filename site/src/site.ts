// Values derived from config.ts so visible status and structured data share one release.
import {config} from './config.ts';
import {outbound, siteOrigin} from './links.ts';

export const engineVersion = config.engineVersion;
export const version = engineVersion.split('.').slice(0, 2).join('.');
export const status = `Public beta · v${version}`;
export const origin = siteOrigin(config.siteUrl);
export const support = outbound(config.supportUrl);
export const requestPack = outbound(config.requestPackUrl, {allowMailto: true});
export const contact = outbound(config.contactUrl, {allowMailto: true});
export const portfolio = outbound(config.portfolioUrl);
export const ignitionVideo = outbound(config.ignition.videoUrl);

/** A file or folder in the repository on main. */
export const repo = (path: string, kind: 'blob' | 'tree' = 'blob') => `${config.repoUrl}/${kind}/main/${path}`;
export const github = {href: config.repoUrl, target: '_blank' as const, rel: 'noopener noreferrer'};
