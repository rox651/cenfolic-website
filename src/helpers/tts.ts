import { writeFile, mkdir, readFile, access } from 'fs/promises';
import { join } from 'path';
import { createHash } from 'crypto';
import { OpenAI } from 'openai';

function calculateContentHash(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

/**
 * Preprocesa el texto para mejorar la pronunciación en TTS,
 * especialmente para instrucciones de puntuación en español.
 */
function preprocessTextForTTS(text: string): string {
  let processed = text;
  
  // Reemplazar "punto y seguido" con un punto seguido de una pausa corta
  // Maneja casos donde ya hay un punto antes o después
  processed = processed.replace(/\.\s*\bpunto y seguido\b/gi, '.');
  processed = processed.replace(/\bpunto y seguido\b/gi, '. ');
  
  // Reemplazar "punto y aparte" con un punto seguido de una pausa más larga
  // Maneja casos donde ya hay un punto antes o después
  processed = processed.replace(/\.\s*\bpunto y aparte\b/gi, '.');
  processed = processed.replace(/\bpunto y aparte\b/gi, '.\n\n');
  
  // Normalizar espacios múltiples y saltos de línea
  processed = processed.replace(/\n{3,}/g, '\n\n'); // Máximo 2 saltos de línea consecutivos
  processed = processed.replace(/[ \t]+/g, ' '); // Normalizar espacios
  processed = processed.replace(/\.\s*\./g, '.'); // Eliminar puntos duplicados
  
  return processed.trim();
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

  const processedText = preprocessTextForTTS(text);
  const contentHash = calculateContentHash(processedText);
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

  const voiceInstructions = `Use a warm, fresh, upbeat, and expressive delivery that feels like a close friend giving heartfelt advice. Keep a hopeful, motivating tone with a subtle spiritual warmth—never preachy. Use dynamic intonation, clear articulation, and a lively pace (medium-fast) with short intentional pauses for emphasis. Maintain consistent loudness and distance from the mic; avoid volume swings, mumbling, or monotone delivery. Speak in neutral Latin American Spanish.
Bible references: when a book starts with a number, pronounce it as an ordinal in Spanish (e.g., "1 Reyes 3:15–17" → "Primera de Reyes, tres, quince al diecisiete"). For chapter:verse, say the chapter number, brief pause, then the verse(s); for ranges use "al". Do not read any meta-instructions aloud.`;

  try {
    const mp3 = await client.audio.speech.create({
      model: 'gpt-4o-mini-tts-2025-03-20',
      voice: 'alloy',
      input: processedText,
      response_format: 'mp3',
      instructions: voiceInstructions,
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

