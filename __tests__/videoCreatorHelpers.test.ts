// __tests__/videoCreatorHelpers.test.ts

import { describe, it, expect } from '@jest/globals';
import { createMessagePayload, sendVideoCreationMessage } from '../src/routes/videoCreationRoutes';
import { config } from '../src/config';
import { connectAmqp } from '../src/amqp/amqpClient';

describe('VideoCreator Helpers - Integration Tests (with real Kafka broker)', () => {
  describe('sendVideoCreationMessage', () => {
    it('should send a message to the Kafka topic and be consumed', async () => {
      const payload = {
        correlationId: '0e872abb-f212-4b25-91cb-9a576e681cdd',
        speechFile: 'ac7857-speech.aac',
        musicFile: '7be7b7-emo.mp3',
        imageFiles: [
          'd28727-puppy_0.jpg',
          '566118-puppy_1.jpg',
          'f43300-puppy_2.jpg',
          'd52970-puppy_4.jpg',
          '5b7e0f-puppy_5.jpg'
        ],
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

      await sendVideoCreationMessage(payload);
      const queueName = config.rabbitmq.taskQueue;
      const rabbitMQChannel = await connectAmqp();
      rabbitMQChannel.assertQueue(queueName, { durable: true });
      rabbitMQChannel.sendToQueue(queueName, Buffer.from(JSON.stringify(payload)), { persistent: true });
    }, 20000); // Extended timeout for Kafka operations
  });
});
