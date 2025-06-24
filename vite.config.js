import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig({
  build: {
    base: '', // fixes path rewriting for extensions
    build: {
      assetsInlineLimit: 0,
    },
    rollupOptions: {
      input: {
        popup: 'src/popup/popup.html',
        over: 'src/newTab/over.html',
        history: 'src/history/history.html',
        offScreen: 'src/offScreen/offScreen.html',
        settings: 'src/settings/settings.html',
        streak: 'src/streak/streak.html',
        userGuide: 'src/userGuide/userGuide.html',
        background: 'src/background.js',
      },
      output: {
        // Keeps filenames predictable
        entryFileNames: 'public/[name].js',
        chunkFileNames: 'public/[name].js',
        assetFileNames: 'public/[name].[ext]',
      },
    },
    outDir: 'dist',
  },
  publicDir: 'public',
  plugins: [
    viteStaticCopy({
      targets: [
        { src: 'manifest.json', dest: '.' },
      ],
    }),
    reorderCssLinksPlugin()
  ],
});

function reorderCssLinksPlugin() {
  return {
    name: 'html-reorder-css-links',
    transformIndexHtml: {
      enforce: 'post',
      transform(html, ctx) {
        // This runs for every HTML entry
        const linkRegex = /<link[^>]+>/g;
        const links = html.match(linkRegex);

        if (!links || links.length < 2) return html;

        const globalLinks = links.filter(l => l.includes('global.css'));
        const localLinks = links.filter(l => !l.includes('global.css'));
        const reordered = [...globalLinks, ...localLinks].join('\n');

        // Remove old <link> tags and inject reordered ones inside <head>
        const updatedHtml = html.replace(linkRegex, '').replace('<head>', `<head>\n${reordered}`);
        return updatedHtml;
      },
    },
  };
}
