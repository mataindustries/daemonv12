// Values derived from config.ts, so a release flip changes every dependent line at once.
import {config} from './config.ts';
import {outbound, siteOrigin} from './links.ts';

export const released06 = config.v06Released;
export const version = released06 ? '0.6' : '0.5';
export const status = `Public beta · v${version}`;
export const origin = siteOrigin(config.siteUrl);
export const support = outbound(config.supportUrl);
export const requestPack = outbound(config.requestPackUrl, {allowMailto: true});

/** A file or folder in the repository on main. */
export const repo = (path: string, kind: 'blob' | 'tree' = 'blob') => `${config.repoUrl}/${kind}/main/${path}`;
/** A V0.6 file: main once released, the review branch until then. */
export const repo06 = (path: string, kind: 'blob' | 'tree' = 'blob') =>
  `${config.repoUrl}/${kind}/${released06 ? 'main' : config.v06PreviewRef}/${path}`;

export const github = {href: config.repoUrl, target: '_blank' as const, rel: 'noopener noreferrer'};
