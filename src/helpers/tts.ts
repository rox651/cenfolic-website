import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

export async function generateAudioFile(
  text: string,
  outputPath: string
): Promise<string> {
  const openAiKey = import.meta.env.OPEN_AI_KEY;

  if (!openAiKey) {
    throw new Error('OPEN_AI_KEY no está configurada');
  }

  // Llamar a la API de OpenAI TTS
  const response = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openAiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'tts-1',
      input: text,
      voice: 'alloy', // Puedes cambiar a: alloy, echo, fable, onyx, nova, shimmer
      response_format: 'mp3',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Error al generar audio: ${errorText}`);
  }

  // Obtener el audio como buffer
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Crear el directorio si no existe
  const dir = join(process.cwd(), 'public', outputPath.split('/').slice(0, -1).join('/'));
  await mkdir(dir, { recursive: true });

  // Guardar el archivo
  const fullPath = join(process.cwd(), 'public', outputPath);
  await writeFile(fullPath, buffer);

  return `/${outputPath}`;
}

