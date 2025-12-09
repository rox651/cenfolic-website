import { writeFile, mkdir, readFile, access } from 'fs/promises';
import { join } from 'path';
import { createHash } from 'crypto';
import { OpenAI } from 'openai';

function calculateContentHash(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

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

  const contentHash = calculateContentHash(text);
  const hashPath = outputPath.replace('.mp3', '.hash');
  
  const dir = join(process.cwd(), 'public', outputPath.split('/').slice(0, -1).join('/'));
  await mkdir(dir, { recursive: true });

  const fullPath = join(process.cwd(), 'public', outputPath);
  const hashFilePath = join(process.cwd(), 'public', hashPath);

  let shouldGenerate = true;
  const audioExists = await fileExists(fullPath);
  const hashExists = await fileExists(hashFilePath);

  if (audioExists && hashExists) {
    try {
      const savedHash = (await readFile(hashFilePath, 'utf-8')).trim();
      
      if (savedHash === contentHash) {
        console.log(`✓ Audio ya existe y el contenido no ha cambiado: ${outputPath}`);
        shouldGenerate = false;
      } else {
        console.log(`🔄 Contenido ha cambiado, regenerando audio: ${outputPath}`);
        shouldGenerate = true;
      }
    } catch (error) {
      console.log(`⚠️  Error leyendo hash, regenerando audio: ${outputPath}`);
      shouldGenerate = true;
    }
  } else {
    console.log(`📝 Generando nuevo audio: ${outputPath} (texto length: ${text.length})`);
    shouldGenerate = true;
  }

  if (!shouldGenerate) {
    return `/${outputPath}`;
  }

  const client = new OpenAI({
    apiKey: openAiKey,
  });

  try {
    const mp3 = await client.audio.speech.create({
      model: 'gpt-4o-mini-tts',
      voice: 'alloy',
      input: text,
      response_format: 'mp3',
    });

    const buffer = Buffer.from(await mp3.arrayBuffer());

    await writeFile(fullPath, buffer);
    await writeFile(hashFilePath, contentHash, 'utf-8');

    return `/${outputPath}`;
  } catch (error) {
    console.error('Error generando audio con OpenAI SDK:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Error al generar audio: ${errorMessage}`);
  }
}

