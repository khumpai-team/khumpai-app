/**
 * Remotion config for the Khumpai pitch demo.
 *
 * Reuses the real app: the same Tailwind setup (via @remotion/tailwind, which
 * reads tailwind.config.js) and the `@/` → src alias, so segments can import
 * the actual screens and components unchanged.
 */

import path from 'path';
import { Config } from '@remotion/cli/config';
import { enableTailwind } from '@remotion/tailwind';

Config.setVideoImageFormat('jpeg');
Config.setOverwriteOutput(true);
// Crisp text in the device frame.
Config.setChromiumOpenGlRenderer('angle');

Config.overrideWebpackConfig((current) => {
  const withTailwind = enableTailwind(current);
  return {
    ...withTailwind,
    resolve: {
      ...withTailwind.resolve,
      alias: {
        ...(withTailwind.resolve?.alias ?? {}),
        '@': path.join(process.cwd(), 'src'),
      },
    },
  };
});
