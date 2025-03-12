// __tests__/videoCreatorHelpers.test.ts

import { createMessagePayload, sendVideoCreationMessage } from '../src/routes/videoCreationRoutes';
import { sendMessageToQueue } from '../src/utils/kafkaHelper';
import { config } from '../src/config';

// Mock sendMessageToQueue
jest.mock('../utils/kafkaHelper', () => ({
  sendMessageToQueue: jest.fn()
}));

describe('VideoCreator Helpers', () => {

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
    it('should call sendMessageToQueue with correct topic and payload', async () => {
      const payload = {
        correlationId: 'test-correlation-id',
        videoSize: [1280, 720],
        duration: 60,
        textConfig: { font: 'Verdana' },
        fps: 24,
        textData: [{ text: 'Test' }]
      };

      await sendVideoCreationMessage(payload);

      expect(sendMessageToQueue).toHaveBeenCalledWith(
        config.kafka.topics.request,
        payload
      );
    });
  });

});
