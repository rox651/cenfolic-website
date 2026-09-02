import { writeFile, mkdir, readFile, access } from 'fs/promises';
import { dirname, join } from 'path';
import { createHash } from 'crypto';
import { OpenAI } from 'openai';

function calculateLegacyAudioHash(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

export type AudioGenerationStatus = 'unchanged' | 'migrated' | 'generated';

export interface AudioFileResult {
  url: string;
  status: AudioGenerationStatus;
}

export interface AudioFilePlan {
  status: AudioGenerationStatus | 'pending';
  outputPath: string;
  processedText: string;
  fullPath: string;
}

function transformBibleReferences(text: string): string {
  let processed = text;
  
  const bibleReferences: Array<[RegExp, string]> = [
    [/1\s+Samuel/gi, 'Primera de Samuel'],
    [/2\s+Samuel/gi, 'Segunda de Samuel'],
    [/1\s+Reyes/gi, 'Primera de Reyes'],
    [/2\s+Reyes/gi, 'Segunda de Reyes'],
    [/1\s+Crónicas/gi, 'Primera de Crónicas'],
    [/2\s+Crónicas/gi, 'Segunda de Crónicas'],
    [/1\s+Corintios/gi, 'Primera de Corintios'],
    [/2\s+Corintios/gi, 'Segunda de Corintios'],
    [/1\s+Tesalonicenses/gi, 'Primera de Tesalonicenses'],
    [/2\s+Tesalonicenses/gi, 'Segunda de Tesalonicenses'],
    [/1\s+Timoteo/gi, 'Primera de Timoteo'],
    [/2\s+Timoteo/gi, 'Segunda de Timoteo'],
    [/1\s+Pedro/gi, 'Primera de Pedro'],
    [/2\s+Pedro/gi, 'Segunda de Pedro'],
    [/1\s+Juan/gi, 'Primera de Juan'],
    [/2\s+Juan/gi, 'Segunda de Juan'],
    [/3\s+Juan/gi, 'Tercera de Juan'],
  ];
  
  for (const [regex, replacement] of bibleReferences) {
    processed = processed.replace(regex, replacement);
  }
  
  return processed;
}

function preprocessTextForTTS(text: string): string {
  let processed = text;
  
  processed = transformBibleReferences(processed);
  
  processed = processed.replace(/\.\s*\bpunto y seguido\b/gi, '.');
  processed = processed.replace(/\bpunto y seguido\b/gi, '. ');
  
  processed = processed.replace(/\.\s*\bpunto y aparte\b/gi, '.');
  processed = processed.replace(/\bpunto y aparte\b/gi, '.\n\n');
  
  processed = processed.replace(/\n{3,}/g, '\n\n');
  processed = processed.replace(/[ \t]+/g, ' ');
  processed = processed.replace(/\.\s*\./g, '.');
  
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

export async function planAudioFile(
  text: string,
  outputPath: string,
  contentHash: string,
  contentHashPath: string,
): Promise<AudioFilePlan> {
  const processedText = preprocessTextForTTS(text);
  const legacyAudioHash = calculateLegacyAudioHash(processedText);
  const legacyHashPath = outputPath.replace('.mp3', '.hash');
  
  const dir = join(process.cwd(), 'public', outputPath.split('/').slice(0, -1).join('/'));
  await mkdir(dir, { recursive: true });

  const fullPath = join(process.cwd(), 'public', outputPath);
  const legacyHashFilePath = join(process.cwd(), 'public', legacyHashPath);
  const hashFilePath = join(process.cwd(), 'public', contentHashPath);
  await mkdir(dirname(hashFilePath), { recursive: true });

  const audioExists = await fileExists(fullPath);
  const hashExists = await fileExists(hashFilePath);
  const legacyHashExists = await fileExists(legacyHashFilePath);

  const createPlan = (status: AudioFilePlan['status']): AudioFilePlan => ({
    status,
    outputPath,
    processedText,
    fullPath,
  });

  async function migrateLegacyHash(): Promise<AudioFilePlan | null> {
    if (!audioExists || !legacyHashExists) return null;

    const legacySavedHash = (await readFile(legacyHashFilePath, 'utf8')).trim();
    if (legacySavedHash !== legacyAudioHash) return null;

    await writeFile(hashFilePath, contentHash, 'utf8');
    return createPlan('migrated');
  }

  if (audioExists && hashExists) {
    try {
      const savedHash = (await readFile(hashFilePath, 'utf-8')).trim();
      
      if (savedHash === contentHash) return createPlan('unchanged');

      // Migrate hashes created before HTML normalization. The legacy audio
      // hash confirms that the underlying post text has not changed.
      const migrated = await migrateLegacyHash();
      if (migrated) return migrated;
    } catch (error) {
      console.warn(`⚠️  Error leyendo hash para ${outputPath}; se marcará como pendiente`);
    }
  } else if (audioExists && legacyHashExists) {
    const migrated = await migrateLegacyHash();
    if (migrated) return migrated;
  }

  return createPlan('pending');
}

export async function generateAudioFile(
  plan: AudioFilePlan,
): Promise<AudioFileResult> {
  if (plan.status !== 'pending') {
    return { url: `/${plan.outputPath}`, status: plan.status };
  }

  const openAiKey = import.meta.env.OPEN_AI_KEY;

  if (!openAiKey) {
    console.error('OPEN_AI_KEY no encontrada en import.meta.env');
    throw new Error('OPEN_AI_KEY no está configurada');
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
      input: plan.processedText,
      response_format: 'mp3',
      instructions: voiceInstructions,
    });

    const buffer = Buffer.from(await mp3.arrayBuffer());

    await writeFile(plan.fullPath, buffer);
    // The shared content hash is persisted after the PNG is also generated.
    return { url: `/${plan.outputPath}`, status: 'generated' };
  } catch (error) {
    console.error('Error generando audio con OpenAI SDK:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Error al generar audio: ${errorMessage}`);
  }
}
