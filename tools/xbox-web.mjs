// Kopiert den Web-Build (dist/) in die Xbox-App (apps/xbox/OverboomXbox/Web), damit er ins MSIX-Paket kommt.
import { cpSync, existsSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const src = root + 'dist';
const dst = root + 'apps/xbox/OverboomXbox/Web';
if (!existsSync(src + '/index.html')) {
  console.error('dist/index.html fehlt – erst „npm run build:web" ausführen.');
  process.exit(1);
}
rmSync(dst, { recursive: true, force: true });
cpSync(src, dst, { recursive: true });
console.log('Web-Build nach apps/xbox/OverboomXbox/Web kopiert.');
