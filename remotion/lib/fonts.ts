/**
 * Load the app's typefaces via @remotion/google-fonts — the supported path that
 * hooks into Remotion's own font-readiness (no fragile module-scope
 * delayRender + <link>, which stalled the multi-worker CLI render).
 *
 * Nunito's family name matches the app CSS directly. Google renamed Source Serif
 * Pro to "Source Serif 4", so its loaded family differs from the app's
 * 'Source Serif Pro' — serif-override.css bridges that gap, and FONT_SERIF below
 * is used for our own inline display text.
 */

import { loadFont as loadNunito } from '@remotion/google-fonts/Nunito';
import { loadFont as loadSourceSerif } from '@remotion/google-fonts/SourceSerif4';

loadNunito('normal', { weights: ['400', '500', '600', '700', '800'], subsets: ['latin'] });
const serif = loadSourceSerif('normal', { weights: ['400', '600', '700'], subsets: ['latin'] });

/** The loaded serif family, e.g. "Source Serif 4". Use for inline display text. */
export const FONT_SERIF = `${serif.fontFamily}, Georgia, serif`;
