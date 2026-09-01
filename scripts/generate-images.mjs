/**
 * Script post-build para generar imágenes PNG de los posts del blog
 * Se ejecuta después de que Astro haya generado los archivos HTML
 * 
 * Uso: node scripts/generate-images.mjs
 */

import { readdir, readFile, mkdir, writeFile, copyFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import { createServer } from 'http';
import { createHash } from 'crypto';
import { parse } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');
const rendererHash = createHash('sha256')
  .update(await readFile(__filename))
  .digest('hex');

function calculateImageHash(html) {
  return createHash('sha256')
    .update(html)
    // Changing the renderer also invalidates every generated image.
    .update(rendererHash)
    .digest('hex');
}

// Simple HTTP server to serve files from dist directory
function createLocalServer(distDir, port = 0) {
  return new Promise((resolve) => {
    const server = createServer(async (req, res) => {
      const parsedUrl = parse(req.url, true);
      let pathname = parsedUrl.pathname;
      
      // Remove leading slash
      if (pathname.startsWith('/')) {
        pathname = pathname.substring(1);
      }
      
      // Default to index.html if path ends with /
      if (pathname.endsWith('/') || pathname === '') {
        pathname = pathname + 'index.html';
      }
      
      const filePath = join(distDir, pathname);
      
      // Security: ensure file is within distDir
      if (!filePath.startsWith(distDir)) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        res.end('Forbidden');
        return;
      }
      
      // Check if file exists
      if (!existsSync(filePath)) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found: ' + pathname);
        return;
      }
      
      try {
        const data = await readFile(filePath);
        
        // Determine content type
        let contentType = 'text/html';
        if (filePath.endsWith('.css')) contentType = 'text/css';
        else if (filePath.endsWith('.js')) contentType = 'application/javascript';
        else if (filePath.endsWith('.png')) contentType = 'image/png';
        else if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) contentType = 'image/jpeg';
        else if (filePath.endsWith('.webp')) contentType = 'image/webp';
        else if (filePath.endsWith('.svg')) contentType = 'image/svg+xml';
        else if (filePath.endsWith('.woff2')) contentType = 'font/woff2';
        else if (filePath.endsWith('.woff')) contentType = 'font/woff';
        else if (filePath.endsWith('.ttf')) contentType = 'font/ttf';
        else if (filePath.endsWith('.otf')) contentType = 'font/otf';
        
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Internal Server Error');
      }
    });
    
    server.listen(port, () => {
      const address = server.address();
      const actualPort = address.port;
      resolve({ server, port: actualPort });
    });
  });
}

let puppeteer;

async function getPuppeteer() {
  if (puppeteer) return puppeteer;
  
  try {
    puppeteer = await import('puppeteer');
    return puppeteer;
  } catch (error) {
    console.warn('⚠️  Puppeteer no está instalado. Ejecuta: bun add -d puppeteer');
    return null;
  }
}

async function generateImageFromHtml(page, htmlFilePath, outputPath, serverPort, distDir) {

    // Calculate relative path from distDir to htmlFilePath
    const relativePath = htmlFilePath.replace(distDir, '').replace(/\\/g, '/');
    const urlPath = relativePath.startsWith('/') ? relativePath : '/' + relativePath;
    const httpUrl = `http://localhost:${serverPort}${urlPath}`;
    
    await page.goto(httpUrl, {
      waitUntil: 'networkidle0',
      timeout: 30000
    });

    // Wait for the content element
    await page.waitForSelector('.blog-post-content', { timeout: 10000 });

    // Wait for fonts and styles to load
    await page.evaluate(() => {
      return Promise.all([
        document.fonts.ready,
        new Promise((resolve) => {
          if (document.readyState === 'complete') {
            resolve();
          } else {
            window.addEventListener('load', resolve);
          }
        })
      ]);
    });

    // Add padding and background to the captured element
    await page.evaluate(() => {
      const el = document.querySelector('.blog-post-content');
      if (el) {
        const PADDING_X = '32px';
        const PADDING_Y = '32px';
        el.style.boxSizing = 'border-box';
        el.style.padding = `${PADDING_Y} ${PADDING_X}`;
        el.style.background = '#ffffff';
        el.style.width = '650px';
        el.style.maxWidth = '650px';
        el.style.margin = '0 auto';
        el.style.borderRadius = '12px';
      }
    });

    // Hide elements that shouldn't be in the screenshot
    await page.evaluate(() => {
      const elementsToHide = document.querySelectorAll('.download-image-button, .audio-player, .no-screenshot');
      elementsToHide.forEach((el) => {
        el.style.display = 'none';
      });
    });

    const element = await page.$('.blog-post-content');

    if (!element) {
      throw new Error('No se encontró el elemento .blog-post-content');
    }

    await element.screenshot({
      path: outputPath,
      type: 'png'
    });
}

async function generateImageWithRetry(page, post, outputPath, serverPort, distDir) {
  const maxAttempts = 2;
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await generateImageFromHtml(page, post.htmlPath, outputPath, serverPort, distDir);
      return;
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts) {
        console.warn(`   ⚠️  Intento ${attempt} falló; reintentando imagen...`);
      }
    }
  }

  throw lastError;
}

async function findBlogPosts(distDir) {
  const posts = [];
  
  async function scanDirectory(dir, category = null) {
    const entries = await readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      
      if (entry.isDirectory()) {
        // Check if this looks like a date (YYYY-MM-DD format)
        if (/^\d{4}-\d{2}-\d{2}$/.test(entry.name)) {
          const htmlPath = join(fullPath, 'index.html');
          try {
            const html = await readFile(htmlPath);
            posts.push({
              category: category || 'blog',
              dateISO: entry.name,
              htmlPath,
              imageHash: await calculateImageHash(html)
            });
          } catch (error) {
            // HTML file doesn't exist, skip
          }
        } else {
          // This might be a category directory
          await scanDirectory(fullPath, entry.name);
        }
      }
    }
  }
  
  await scanDirectory(distDir);
  return posts.sort((a, b) => {
    const categoryComparison = a.category.localeCompare(b.category);
    return categoryComparison || a.dateISO.localeCompare(b.dateISO);
  });
}

async function main() {
  console.log('🖼️  Iniciando generación de imágenes PNG...\n');
  
  const distDir = join(rootDir, 'dist');
  const publicImagesDir = join(rootDir, 'public', 'images');
  
  // Create images directory if it doesn't exist
  try {
    await mkdir(publicImagesDir, { recursive: true });
  } catch (error) {
    // Directory might already exist
  }
  
  // Find all blog posts
  const posts = await findBlogPosts(distDir);
  
  if (posts.length === 0) {
    console.log('⚠️  No se encontraron posts para generar imágenes');
    return;
  }
  
  console.log(`📝 Encontrados ${posts.length} posts`);

  const postsToGenerate = [];
  for (const post of posts) {
    const imagePath = join(publicImagesDir, post.category, `${post.dateISO}.png`);
    const hashPath = join(publicImagesDir, post.category, `${post.dateISO}.hash`);

    try {
      const savedHash = (await readFile(hashPath, 'utf8')).trim();
      if (existsSync(imagePath) && savedHash === post.imageHash) {
        continue;
      }
    } catch {
      // A missing or unreadable hash means the image must be regenerated.
    }

    postsToGenerate.push({ ...post, imagePath, hashPath });
  }

  const unchangedCount = posts.length - postsToGenerate.length;
  console.log(`✓ ${unchangedCount} imágenes sin cambios`);
  console.log(`🖼️  ${postsToGenerate.length} imágenes por generar\n`);
  
  const failures = [];

  if (postsToGenerate.length > 0) {
    const puppeteerModule = await getPuppeteer();
    if (!puppeteerModule) {
      throw new Error('Puppeteer no está disponible. Instala con: bun add -d puppeteer');
    }

    // Start local HTTP server only when at least one image needs rendering.
    console.log('🌐 Iniciando servidor HTTP local...');
    const { server, port } = await createLocalServer(distDir);
    console.log(`✅ Servidor iniciado en puerto ${port}\n`);

    let browser;
    let page;

    try {
      browser = await puppeteerModule.default.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      page = await browser.newPage();
      await page.setViewport({
        width: 650,
        height: 1080,
        deviceScaleFactor: 2
      });

      for (let i = 0; i < postsToGenerate.length; i++) {
        const post = postsToGenerate[i];
        const imageDir = dirname(post.imagePath);

        try {
          await mkdir(imageDir, { recursive: true });

          console.log(`[${i + 1}/${postsToGenerate.length}] Generando imagen para ${post.category}/${post.dateISO}...`);

          await generateImageWithRetry(page, post, post.imagePath, port, distDir);
          await writeFile(post.hashPath, post.imageHash, 'utf8');

          console.log(`   ✅ Imagen generada: ${post.category}/${post.dateISO}.png`);
        } catch (error) {
          failures.push(`${post.category}/${post.dateISO}: ${error.message}`);
          console.error(`   ❌ Error generando imagen para ${post.dateISO}:`, error.message);
        }
      }
    } finally {
      await page?.close();
      await browser?.close();
      await new Promise((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
      });
      console.log('\n🌐 Servidor HTTP cerrado');
    }
  }

  if (failures.length > 0) {
    throw new Error(
      `No se pudieron generar ${failures.length} de ${postsToGenerate.length} imágenes:\n${failures.join('\n')}`,
    );
  }
  
  // Copy images to dist directory
  console.log('\n📁 Copiando imágenes a dist...');
  const distImagesDir = join(distDir, 'images');
  
  await mkdir(distImagesDir, { recursive: true });

  // Copy all images from public/images to dist/images
  async function copyImages(src, dest) {
    const entries = await readdir(src, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = join(src, entry.name);
      const destPath = join(dest, entry.name);

      if (entry.isDirectory()) {
        await mkdir(destPath, { recursive: true });
        await copyImages(srcPath, destPath);
      } else if (entry.name.endsWith('.png') || entry.name.endsWith('.hash')) {
        await copyFile(srcPath, destPath);
      }
    }
  }

  await copyImages(publicImagesDir, distImagesDir);
  console.log('✅ Imágenes copiadas a dist/images');
  
  console.log('\n🎉 ¡Generación de imágenes completada!');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
