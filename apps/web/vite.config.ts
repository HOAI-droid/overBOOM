import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { fileURLToPath } from 'node:url';

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));
const single = process.env.SINGLE === '1';

export default defineConfig({
  root: r('.'),
  base: './',
  resolve: {
    alias: {
      '@overboom/core': r('../../packages/core/src/index.ts'),
      '@overboom/data': r('../../packages/data/src/index.ts'),
      '@overboom/render': r('../../packages/render/src/index.ts'),
      '@overboom/ui': r('../../packages/ui/src/index.ts'),
      '@overboom/net': r('../../packages/net/src/index.ts'),
      '@overboom/platform': r('../../packages/platform/src/index.ts'),
      '@overboom/audio': r('../../packages/audio/src/index.ts')
    }
  },
  plugins: single
    ? [viteSingleFile(), { name: 'overboom-single', transformIndexHtml: (html: string) => html.replace('<head>', '<head>\n<meta name="overboom-single" content="1">') }]
    : [],
  build: {
    outDir: r(single ? '../../dist-single' : '../../dist'),
    emptyOutDir: true,
    target: 'es2020'
  },
  server: { host: true }
});
