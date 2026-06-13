// Dev helper: bundle the Remotion project once and render a few stills across
// the timeline so we can eyeball each segment. Not part of the app build.
import path from 'node:path';
import { bundle } from '@remotion/bundler';
import { renderStill, selectComposition } from '@remotion/renderer';
import { enableTailwind } from '@remotion/tailwind';

const root = process.cwd();
const frames = process.argv.slice(2).map(Number);
const FRAMES = frames.length ? frames : [60, 270, 420, 700, 810, 990, 1170, 1320];

const serveUrl = await bundle({
  entryPoint: path.join(root, 'remotion', 'index.ts'),
  webpackOverride: (current) => {
    const withTailwind = enableTailwind(current);
    return {
      ...withTailwind,
      resolve: {
        ...withTailwind.resolve,
        alias: { ...(withTailwind.resolve?.alias ?? {}), '@': path.join(root, 'src') },
      },
    };
  },
});

const composition = await selectComposition({ serveUrl, id: 'KhumpaiDemo' });

for (const frame of FRAMES) {
  const output = path.join(root, 'out', `frame-${frame}.png`);
  await renderStill({ composition, serveUrl, output, frame, overwrite: true });
  console.log('rendered', output);
}
console.log('done');
