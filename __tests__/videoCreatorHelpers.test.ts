// __tests__/videoCreatorHelpers.test.ts

import { describe, it, expect } from '@jest/globals';
import { createMessagePayload, sendVideoCreationMessage } from '../src/routes/videoCreationRoutes';
import { config } from '../src/config';
import { Storage } from '../src/utils/storage';
import { connectAmqp } from '../src/amqp/amqpClient';
import path from 'path';

describe('VideoCreator Helpers - Integration Tests (with real Kafka broker)', () => {
  describe('sendVideoCreationMessage', () => {
    it('should upload files to MinIO, update the payload, send a message to the Kafka topic and be consumed', async () => {
      // Initialize Storage instance
      const storage = await Storage.getInstance();

      // Paths to your local files
      const speechFilePath = ('/tmp/sample_data/speech.aac');
      const musicFilePath = ('/tmp/sample_data/emo.mp3');
      const imageFilePaths = [
        ('/tmp/sample_data/puppy_0.jpg'),
        ('/tmp/sample_data/puppy_1.jpg'),
        ('/tmp/sample_data/puppy_2.jpg'),
        ('/tmp/sample_data/puppy_4.jpg'),
        ('/tmp/sample_data/puppy_5.jpg'),
      ];

      // Upload files to MinIO
      const uploadedSpeechFile = await storage.uploadFile('speech.aac', speechFilePath);
      const uploadedMusicFile = await storage.uploadFile('emo.mp3', musicFilePath);

      const uploadedImageFileKeys: string[] = [];
      for (const imagePath of imageFilePaths) {
        const fileName = path.basename(imagePath);
        const uploadedImageFileKey = await storage.uploadFile(fileName, imagePath);
        uploadedImageFileKeys.push(uploadedImageFileKey);
      }

      // Build the updated payload using uploaded file names
      const payload = {
        correlationId: '0e872abb-f212-4b25-91cb-9a576e681cdd',
        speechFile: uploadedSpeechFile,
        musicFile: uploadedMusicFile,
        imageFiles: uploadedImageFileKeys,
        videoSize: [1920, 1080],
        duration: 15,
        textConfig: { font_color: 'white', background_color: 'black' },
        fps: 24,
        textData: [
          { word: 'Ladybird', start: 0, end: 0.44 },
          { word: 'là', start: 0.44, end: 0.66 },
          { word: 'một', start: 0.66, end: 0.82 },
          { word: 'trình', start: 0.82, end: 1 },
          { word: 'duyệt', start: 1, end: 1.26 },
          { word: 'web', start: 1.38, end: 1.48 },
          { word: 'độc', start: 1.48, end: 1.9 },
          { word: 'lập', start: 1.9, end: 2.08 },
          { word: 'và', start: 2.26, end: 2.42 },
          { word: 'mã', start: 2.42, end: 2.68 },
          { word: 'nguồn', start: 2.68, end: 2.94 },
          { word: 'mở', start: 2.94, end: 3.1 },
          { word: 'được', start: 3.78, end: 3.86 },
          { word: 'phát', start: 3.86, end: 4.08 },
          { word: 'triển', start: 4.12, end: 4.28 },
          { word: 'bởi', start: 4.28, end: 4.46 },
          { word: 'Ladybird', start: 4.46, end: 4.9 },
          { word: 'Browser', start: 4.9, end: 5.34 },
          { word: 'Initiative', start: 5.78, end: 5.88 }
        ]
      };

      // Send video creation message
      await sendVideoCreationMessage(payload);

      // Send to RabbitMQ for further processing
      const queueName = config.rabbitmq.taskQueue;
      const rabbitMQChannel = await connectAmqp();
      rabbitMQChannel.assertQueue(queueName, { durable: true });
      rabbitMQChannel.sendToQueue(queueName, Buffer.from(JSON.stringify(payload)), { persistent: true });
    }, 20000); // Extended timeout for Kafka operations
  });
});
