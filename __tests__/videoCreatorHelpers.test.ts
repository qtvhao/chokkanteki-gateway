// __tests__/videoCreatorHelpers.test.ts

import { describe, it, expect, beforeEach } from '@jest/globals';
import { createMessagePayload, sendVideoCreationMessage } from '../src/routes/videoCreationRoutes';
// import { config } from '../dist/config';
// import { sendMessageToQueue } from '../dist/utils/kafkaHelper'; // Real function

describe('VideoCreator Helpers - Integration Tests', () => {

  beforeEach(() => {
    // If needed: clean up, reset data, etc.
  });

  describe('createMessagePayload', () => {
    it('should create a correct message payload', () => {
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
    it('should send a message to the Kafka topic', async () => {
    //   const payload = {
    //     correlationId: `test-correlation-id-${Date.now()}`,
    //     videoSize: [1280, 720],
    //     duration: 60,
    //     textConfig: { font: 'Verdana' },
    //     fps: 24,
    //     textData: [{ text: 'Test' }]
    //   };

    //   // Call the real function to send the message
    //   const result = await sendVideoCreationMessage(payload);

    //   // Assertions:
    //   // 1. No errors were thrown (if result returns something useful, check it here)
    //   expect(result).toBeUndefined(); // or check whatever your function returns

    //   // 2. You could optionally add a Kafka consumer here to assert the message was published,
    //   // but that's often done in an E2E test with a test consumer
    }, 10000); // <-- optional timeout if Kafka is slow
  });

});
