import { S3Event, S3Handler } from 'aws-lambda';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { spawn } from 'child_process';
import { createWriteStream, createReadStream, unlinkSync } from 'fs';
import { pipeline } from 'stream/promises';

const s3 = new S3Client({});

export const handler: S3Handler = async (event: S3Event) => {
  console.log('Audio converter triggered:', JSON.stringify(event, null, 2));
  
  for (const record of event.Records) {
    const bucket = record.s3.bucket.name;
    const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));
    
    console.log(`Processing file: ${key} from bucket: ${bucket}`);
    
    // Skip if already WAV
    if (key.toLowerCase().endsWith('.wav')) {
      console.log(`Skipping ${key} - already WAV format`);
      continue;
    }
    
    // Only process audio files
    const audioExtensions = ['.webm', '.mp3', '.m4a', '.ogg', '.flac'];
    if (!audioExtensions.some(ext => key.toLowerCase().endsWith(ext))) {
      console.log(`Skipping ${key} - not an audio file`);
      continue;
    }
    
    try {
      console.log(`Converting ${key} to WAV format`);
      await convertToWav(bucket, key);
      console.log(`Successfully converted ${key}`);
    } catch (error) {
      console.error(`Failed to convert ${key}:`, error);
      throw error; // Re-throw to mark Lambda as failed
    }
  }
};

async function convertToWav(bucket: string, key: string): Promise<void> {
  const inputPath = `/tmp/input_${Date.now()}`;
  const outputPath = `/tmp/output_${Date.now()}.wav`;
  const outputKey = key.replace(/\.[^.]+$/, '.wav');
  
  console.log(`Converting ${key} to ${outputKey}`);
  
  try {
    // Download file
    console.log(`Downloading ${key} from S3`);
    const getCommand = new GetObjectCommand({ Bucket: bucket, Key: key });
    const response = await s3.send(getCommand);
    await pipeline(response.Body as NodeJS.ReadableStream, createWriteStream(inputPath));
    console.log(`Downloaded ${key} to ${inputPath}`);
    
    // Convert using ffmpeg
    console.log(`Starting ffmpeg conversion`);
    await new Promise<void>((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', [
        '-i', inputPath,
        '-ar', '8000',      // 8kHz sample rate for telephony
        '-ac', '1',         // Mono
        '-f', 'wav',
        outputPath
      ]);
      
      ffmpeg.stderr.on('data', (data) => {
        console.log(`ffmpeg stderr: ${data}`);
      });
      
      ffmpeg.on('close', (code) => {
        console.log(`ffmpeg exited with code: ${code}`);
        code === 0 ? resolve() : reject(new Error(`ffmpeg exit code: ${code}`));
      });
    });
    
    // Upload converted file
    console.log(`Uploading converted file to ${outputKey}`);
    const putCommand = new PutObjectCommand({
      Bucket: bucket,
      Key: outputKey,
      Body: createReadStream(outputPath),
      ContentType: 'audio/wav'
    });
    await s3.send(putCommand);
    console.log(`Successfully uploaded ${outputKey}`);
    
  } finally {
    // Cleanup
    [inputPath, outputPath].forEach(path => {
      try { 
        unlinkSync(path); 
        console.log(`Cleaned up ${path}`);
      } catch (e) {
        console.log(`Failed to cleanup ${path}:`, e);
      }
    });
  }
}
