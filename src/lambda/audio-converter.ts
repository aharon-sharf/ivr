import { S3Event, S3Handler } from 'aws-lambda';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { spawn } from 'child_process';
import { createWriteStream, createReadStream, unlinkSync } from 'fs';
import { pipeline } from 'stream/promises';

const s3 = new S3Client({});

export const handler: S3Handler = async (event: S3Event) => {
  for (const record of event.Records) {
    const bucket = record.s3.bucket.name;
    const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));
    
    // Skip if already WAV
    if (key.toLowerCase().endsWith('.wav')) continue;
    
    // Only process audio files
    const audioExtensions = ['.webm', '.mp3', '.m4a', '.ogg', '.flac'];
    if (!audioExtensions.some(ext => key.toLowerCase().endsWith(ext))) continue;
    
    try {
      await convertToWav(bucket, key);
    } catch (error) {
      console.error(`Failed to convert ${key}:`, error);
    }
  }
};

async function convertToWav(bucket: string, key: string): Promise<void> {
  const inputPath = `/tmp/input_${Date.now()}`;
  const outputPath = `/tmp/output_${Date.now()}.wav`;
  const outputKey = key.replace(/\.[^.]+$/, '.wav');
  
  try {
    // Download file
    const getCommand = new GetObjectCommand({ Bucket: bucket, Key: key });
    const response = await s3.send(getCommand);
    await pipeline(response.Body as NodeJS.ReadableStream, createWriteStream(inputPath));
    
    // Convert using ffmpeg
    await new Promise<void>((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', [
        '-i', inputPath,
        '-ar', '8000',      // 8kHz sample rate for telephony
        '-ac', '1',         // Mono
        '-f', 'wav',
        outputPath
      ]);
      
      ffmpeg.on('close', (code) => {
        code === 0 ? resolve() : reject(new Error(`ffmpeg exit code: ${code}`));
      });
    });
    
    // Upload converted file
    const putCommand = new PutObjectCommand({
      Bucket: bucket,
      Key: outputKey,
      Body: createReadStream(outputPath),
      ContentType: 'audio/wav'
    });
    await s3.send(putCommand);
    
  } finally {
    // Cleanup
    [inputPath, outputPath].forEach(path => {
      try { unlinkSync(path); } catch {}
    });
  }
}
