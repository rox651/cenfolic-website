import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

export async function generateAudioFile(
  text: string,
  outputPath: string
): Promise<string> {
  const openAiKey = import.meta.env.OPEN_AI_KEY;

  if (!openAiKey) {
    console.error('OPEN_AI_KEY no encontrada en import.meta.env');
    console.error('Variables de entorno disponibles:', Object.keys(import.meta.env).filter(k => k.includes('OPEN')));
    throw new Error('OPEN_AI_KEY no está configurada');
  }

  console.log(`Generando audio para: ${outputPath} (texto length: ${text.length})`);

  const response = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openAiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'tts-1',
      input: text,
      voice: 'alloy',
      response_format: 'mp3',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = `Error al generar audio`;
    
    try {
      const errorJson = JSON.parse(errorText);
      if (errorJson.error?.message) {
        errorMessage = `Error de OpenAI: ${errorJson.error.message}`;
        
        if (errorJson.error.message.includes('insufficient permissions') || 
            errorJson.error.message.includes('Missing scopes')) {
          errorMessage = `Error de permisos: Tu API key de OpenAI no tiene los permisos necesarios. Necesita el scope 'model.request'. Verifica la configuración de tu API key en https://platform.openai.com/api-keys`;
        }
      }
    } catch {
      errorMessage = `Error al generar audio: ${errorText}`;
    }
    
    throw new Error(errorMessage);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const dir = join(process.cwd(), 'public', outputPath.split('/').slice(0, -1).join('/'));
  await mkdir(dir, { recursive: true });

  const fullPath = join(process.cwd(), 'public', outputPath);
  await writeFile(fullPath, buffer);

  return `/${outputPath}`;
}

