// Type: Archivo (variable weight and width) for the display lines, JetBrains Mono for the maker's
// mark. Both are bundled from fontsource (OFL) and loaded through @remotion/fonts, which holds the
// render until they are ready. Nothing is fetched at render time.
import {loadFont} from '@remotion/fonts';
import archivoUrl from '@fontsource-variable/archivo/files/archivo-latin-wdth-normal.woff2';
import monoUrl from '@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2';

export const DISPLAY = 'IR Display';
export const MONO = 'IR Mono';

loadFont({family: DISPLAY, url: archivoUrl, weight: '100 900', stretch: '62% 125%', display: 'block'});
loadFont({family: MONO, url: monoUrl, weight: '100 800', display: 'block'});
