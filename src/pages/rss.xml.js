import rss from '@astrojs/rss';
import { getAllPosts } from '../helpers/wordpress';
import { extractTextFromHTML } from '../helpers/html';
import { stat } from 'fs/promises';
import { join } from 'path';
import { fileExists } from '../helpers/tts';

export const prerender = true;

export async function GET(context) {
  const posts = await getAllPosts();
  
  // Obtener todos los posts con sus audios
  const items = await Promise.all(
    posts.map(async (post) => {
      const title = extractTextFromHTML(post.title.rendered);
      const description = extractTextFromHTML(post.excerpt?.rendered || '');
      const contentText = extractTextFromHTML(post.content.rendered);
      
      // Construir la URL del post
      const postUrl = new URL(`/${post.categorySlug}/${post.dateISO}`, context.site).toString();
      
      // Construir la URL del audio
      const audioPath = `audio/${post.categorySlug}/${post.dateISO}.mp3`;
      const audioUrl = new URL(audioPath, context.site).toString();
      
      // Verificar si el archivo de audio existe y obtener su tamaño
      let audioLength = 0;
      const audioFilePath = join(process.cwd(), 'public', audioPath);
      const exists = await fileExists(audioFilePath);
      
      if (exists) {
        try {
          const stats = await stat(audioFilePath);
          audioLength = stats.size;
        } catch (error) {
          console.warn(`No se pudo obtener el tamaño del audio para ${post.dateISO}:`, error);
        }
      }
      
      // Solo incluir items que tengan audio disponible
      if (!exists || audioLength === 0) {
        return null;
      }
      
      // Construir el contenido del item
      const fullContent = description 
        ? `<p><strong>${description}</strong></p><p>${contentText.substring(0, 500)}${contentText.length > 500 ? '...' : ''}</p>`
        : `<p>${contentText.substring(0, 500)}${contentText.length > 500 ? '...' : ''}</p>`;
      
      // Estimar duración aproximada (MP3 a 128kbps promedio)
      // Duración aproximada = (tamaño en bytes * 8) / (bitrate en bps)
      const estimatedDurationSeconds = Math.floor((audioLength * 8) / (128 * 1000));
      const hours = Math.floor(estimatedDurationSeconds / 3600);
      const minutes = Math.floor((estimatedDurationSeconds % 3600) / 60);
      const seconds = estimatedDurationSeconds % 60;
      const durationString = hours > 0 
        ? `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
        : `${minutes}:${seconds.toString().padStart(2, '0')}`;
      
      return {
        title,
        pubDate: new Date(post.date),
        description: description || contentText.substring(0, 200),
        link: postUrl,
        content: fullContent,
        // Elementos específicos para podcast
        customData: `
          <enclosure url="${audioUrl}" length="${audioLength}" type="audio/mpeg"/>
          <itunes:author>Iglesias CENFOLIC</itunes:author>
          <itunes:subtitle>${(description || title).substring(0, 255)}</itunes:subtitle>
          <itunes:summary><![CDATA[${description || contentText.substring(0, 4000)}]]></itunes:summary>
          <itunes:duration>${durationString}</itunes:duration>
          <itunes:explicit>no</itunes:explicit>
          <itunes:episodeType>full</itunes:episodeType>
        `,
      };
    })
  );
  
  // Filtrar items nulos y ordenar por fecha (más recientes primero)
  const validItems = items.filter(item => item !== null);
  validItems.sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime());
  
  // URL del feed RSS
  const feedUrl = new URL('rss.xml', context.site).toString();
  
  // Convertir context.site a string para generar el GUID
  const siteString = context.site?.toString() || context.site?.href || 'cenfolic.com';
  const siteHost = siteString.replace(/https?:\/\//, '').replace(/\/$/, '');
  
  return rss({
    title: 'Devocionales CENFOLIC',
    description: 'Devocionales y mensajes de Iglesias CENFOLIC para acompañar tu tiempo con Dios',
    site: context.site,
    items: validItems,
    // Metadatos adicionales para podcast
    customData: `
      <language>es</language>
      <copyright>Copyright ${new Date().getFullYear()} Iglesias CENFOLIC</copyright>
      <managingEditor>medios@cenfolic.com (Iglesias CENFOLIC)</managingEditor>
      <webMaster>medios@cenfolic.com (Iglesias CENFOLIC)</webMaster>
      <atom:link href="${feedUrl}" rel="self" type="application/rss+xml" />
      <itunes:author>Iglesias CENFOLIC</itunes:author>
      <itunes:summary>Devocionales y mensajes de Iglesias CENFOLIC para acompañar tu tiempo con Dios</itunes:summary>
      <itunes:owner>
        <itunes:name>Iglesias CENFOLIC</itunes:name>
        <itunes:email>medios@cenfolic.com</itunes:email>
      </itunes:owner>
      <itunes:explicit>no</itunes:explicit>
      <itunes:category text="Religion &amp; Spirituality">
        <itunes:category text="Christianity"/>
      </itunes:category>
      <itunes:image href="${new URL('/Podcast Iglesias CENFOLIC2.png', context.site).toString()}"/>
      <podcast:locked>yes</podcast:locked>
      <podcast:guid>cenfolic-podcast-${siteHost}</podcast:guid>
    `,
    xmlns: {
      itunes: 'http://www.itunes.com/dtds/podcast-1.0.dtd',
      atom: 'http://www.w3.org/2005/Atom',
      podcast: 'https://podcastindex.org/namespace/1.0',
    },
  });
}

