/**
 * Script post-build para generar imágenes PNG de los posts del blog
 * Se ejecuta después de que Astro haya generado los archivos HTML
 * 
 * Uso: node scripts/generate-images.mjs
 */

import { readdir, readFile, mkdir, writeFile, copyFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

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

async function generateImageFromHtml(htmlFilePath, outputPath, width = 650) {
  const puppeteerModule = await getPuppeteer();
  if (!puppeteerModule) {
    return false;
  }

  const browser = await puppeteerModule.default.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();

    await page.setViewport({
      width: width,
      height: 1080,
      deviceScaleFactor: 1
    });

    const fileUrl = `file:///${htmlFilePath.replace(/\\/g, '/')}`;
    await page.goto(fileUrl, {
      waitUntil: 'networkidle0'
    });

    await page.waitForSelector('.blog-post-content', { timeout: 10000 });

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

    return true;
  } finally {
    await browser.close();
  }
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
            await readFile(htmlPath);
            posts.push({
              category: category || 'blog',
              dateISO: entry.name,
              htmlPath
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
  return posts;
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
  
  console.log(`📝 Encontrados ${posts.length} posts\n`);
  
  const puppeteerModule = await getPuppeteer();
  if (!puppeteerModule) {
    console.log('⚠️  Puppeteer no está disponible. Instala con: bun add -d puppeteer');
    return;
  }
  
  // Generate images for each post
  for (let i = 0; i < posts.length; i++) {
    const post = posts[i];
    const imagePath = join(publicImagesDir, post.category, `${post.dateISO}.png`);
    const imageDir = join(publicImagesDir, post.category);
    
    try {
      await mkdir(imageDir, { recursive: true });
      
      console.log(`[${i + 1}/${posts.length}] Generando imagen para ${post.category}/${post.dateISO}...`);
      
      await generateImageFromHtml(post.htmlPath, imagePath, 650);
      
      console.log(`   ✅ Imagen generada: ${post.category}/${post.dateISO}.png`);
    } catch (error) {
      console.error(`   ❌ Error generando imagen para ${post.dateISO}:`, error.message);
    }
  }
  
  // Copy images to dist directory
  console.log('\n📁 Copiando imágenes a dist...');
  const distImagesDir = join(distDir, 'images');
  
  try {
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
        } else if (entry.name.endsWith('.png')) {
          await copyFile(srcPath, destPath);
        }
      }
    }
    
    await copyImages(publicImagesDir, distImagesDir);
    console.log('✅ Imágenes copiadas a dist/images');
  } catch (error) {
    console.warn('⚠️  Error copiando imágenes a dist:', error.message);
  }
  
  console.log('\n🎉 ¡Generación de imágenes completada!');
}

main().catch(console.error);

