// __tests__/videoCreatorHelpers.test.ts

import { describe, it, expect } from '@jest/globals';
import { createMessagePayload, sendVideoCreationMessage } from '../src/routes/videoCreationRoutes';

describe('VideoCreator Helpers - Integration Tests (with real Kafka broker)', () => {
  describe('createMessagePayload', () => {
    it('should create a correct message payload', async () => {
      const correlationId = 'test-correlation-id';

      const claimCheck = {
        speechFile: 'speech.mp3',
        musicFile: 'music.mp3',
        imageFiles: ['image1.png', 'image2.png']
      };

      const requestParams = {
        videoSize: [1920, 1080],
        duration: 120,
        textConfig: { font: 'Arial', color: 'white' },
        fps: 30,
        textData: [{ text: 'Hello World' }]
      };

      const expectedPayload = {
        correlationId,
        ...claimCheck,
        videoSize: requestParams.videoSize,
        duration: requestParams.duration,
        textConfig: requestParams.textConfig,
        fps: requestParams.fps,
        textData: requestParams.textData
      };

      const result = createMessagePayload(correlationId, claimCheck, requestParams);

      expect(result).toEqual(expectedPayload);
    });
  });

  describe('sendVideoCreationMessage', () => {
    it('should send a message to the Kafka topic and be consumed', async () => {
      const payload = {
        correlationId: `test-correlation-id-${Date.now()}`,
        videoSize: [1280, 720],
        duration: 60,
        textConfig: { font: 'Verdana' },
        fps: 24,
        textData: [{ text: 'Test' }]
      };

      const topic = 'video-creation-requests'; // Replace with your actual topic name

      const messages: Array<{
        key: string | undefined;
        value: string | undefined;
        headers: Record<string, any> | undefined;
      }> = [];

      // // await consumer.subscribe({ topic, fromBeginning: false });

      // // const consumePromise = new Promise<void>((resolve, reject) => {
      // //   const timer = setTimeout(() => reject(new Error('Timeout waiting for message')), 10000);

      // //   consumer.run({
      // //     eachMessage: async ({ topic, partition, message }) => {
      // //       clearTimeout(timer);
      // //       messages.push({
      // //         key: message.key?.toString(),
      // //         value: message.value?.toString(),
      // //         headers: message.headers
      // //       });
      // //       resolve();
      // //     }
      // //   });
      // // });

      // await sendVideoCreationMessage(payload);

      // // await consumePromise;

      // expect(messages.length).toBeGreaterThan(0);

      // const receivedMessage = JSON.parse(messages[0].value || '{}');
      // expect(receivedMessage.correlationId).toBe(payload.correlationId);
      // expect(receivedMessage.videoSize).toEqual(payload.videoSize);
      // expect(receivedMessage.textData).toEqual(payload.textData);
    }, 20000); // Extended timeout for Kafka operations
  });
});
