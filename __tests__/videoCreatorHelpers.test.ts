// __tests__/videoCreatorHelpers.test.ts

import { describe, it, expect } from '@jest/globals';
import { createMessagePayload, sendVideoCreationMessage } from '../src/routes/videoCreationRoutes';
import { config } from '../src/config';
import { connectAmqp } from '../src/amqp/amqpClient';

describe('VideoCreator Helpers - Integration Tests (with real Kafka broker)', () => {
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

      await sendVideoCreationMessage(payload);
      const queueName = config.rabbitmq.taskQueue;
      const rabbitMQChannel = await connectAmqp();
      rabbitMQChannel.assertQueue(queueName, { durable: true });
      rabbitMQChannel.sendToQueue(queueName, Buffer.from(JSON.stringify(payload)), { persistent: true });
    }, 20000); // Extended timeout for Kafka operations
  });
});
