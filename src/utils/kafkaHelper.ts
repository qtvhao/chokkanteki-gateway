import { getKafkaConnection } from '../kafka/kafkaClient';

const kafka = getKafkaConnection();
const producer = kafka.producer();
const admin = kafka.admin();
let existingTopics = new Set<string>();

let isConnected = false;

const lazyConnect = async () => {
    if (!isConnected) {
        await producer.connect();
        await admin.connect();
        // existingTopics = new Set(await admin.listTopics());
        await refreshTopics()
        isConnected = true;
    }
};

const refreshTopics = async () => {
    existingTopics = new Set(await admin.listTopics());
};

const ensureTopicExists = async (topic: string) => {
    if (!existingTopics.has(topic)) {
        console.log(`Topic '${topic}' does not exist. Creating...`);
        await admin.createTopics({
            topics: [{ topic }],
        });
        console.log(`Topic '${topic}' created successfully.`);
        existingTopics.add(topic);
    }
};

export const sendMessageToQueue = async (topic: string, message: Record<string, unknown>): Promise<void> => {
    try {
        await lazyConnect();
        console.log(`Sending message to queue topic '${topic}':`, message);
        
        await ensureTopicExists(topic);
        
        await producer.send({
            topic,
            messages: [{ value: JSON.stringify({...message}) }],
        });
        
        console.log('Message sent to queue successfully');
    } catch (error) {
        console.error('Error sending message to queue:', error);
        throw error;
    }
};

// const refreshInterval = setInterval(refreshTopics, 60000);

const shutdown = async () => {
    // clearInterval(refreshInterval); // <--- This clears the interval!
    console.log('Disconnecting Kafka producer...');
    await producer.disconnect();
    await admin.disconnect();
    console.log('Kafka producer disconnected');
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
