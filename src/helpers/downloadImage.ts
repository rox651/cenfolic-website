/**
 * Downloads the pre-generated PNG image for the current blog post
 * The image should be generated during build using Puppeteer
 */
export async function downloadImage(): Promise<void> {
  const pathname = window.location.pathname;
  const pathParts = pathname.split('/').filter(Boolean);
  
  if (pathParts.length < 2) {
    alert('⚠️ No se pudo determinar la ruta del post');
    return;
  }

  const category = pathParts[0];
  const dateISO = pathParts[1];
  const imagePath = `/images/${category}/${dateISO}.png`;
  const imageUrl = new URL(imagePath, window.location.origin).toString();

  try {
    const response = await fetch(imageUrl, { method: 'HEAD' });

    if (response.ok) {
      const blob = await fetch(imageUrl).then(r => r.blob());
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${dateISO}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } else {
      alert('⚠️ Imagen PNG no encontrada.\n\n' +
            'La imagen debería generarse durante el build.\n' +
            'Si estás en desarrollo, ejecuta el script de generación de imágenes.');
    }
  } catch (error) {
    console.error('Error al descargar imagen:', error);
    alert('Error al descargar la imagen. Verifica que el archivo PNG existe.');
  }
}

