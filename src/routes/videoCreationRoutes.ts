import express, { Request, Response } from 'express';
import multer from 'multer';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { sendMessageToQueue } from '../utils/kafkaHelper.js';
import { config } from '../config.js';
import { Storage } from '../utils/storage.js';
import { App } from '../app.js';

export class VideoCreator {
    speechFile?: string;
    musicFile?: string;
    videoSize: [number, number];
    duration: number;
    imageFiles: string[];
    textConfig: any;
    outputFile: string;
    fps: number;

    constructor({
        speechFile,
        musicFile,
        videoSize,
        duration,
        imageFiles,
        textConfig,
        outputFile,
        fps
    }: {
        speechFile?: string;
        musicFile?: string;
        videoSize: [number, number];
        duration: number;
        imageFiles: string[];
        textConfig: any;
        outputFile: string;
        fps: number;
    }) {
        this.speechFile = speechFile;
        this.musicFile = musicFile;
        this.videoSize = videoSize;
        this.duration = duration;
        this.imageFiles = imageFiles;
        this.textConfig = textConfig;
        this.outputFile = outputFile;
        this.fps = fps;
    }

    createVideo(textData: any) {
        console.log(`🎬 Creating video with ${JSON.stringify(this)}`);
        fs.writeFileSync(this.outputFile, 'Video content placeholder');
    }
}

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

// Helpers
function saveUploadedFiles(req: Request) {
    console.log('📂 Saving uploaded files...');
    const speech = req.files && 'speech_file' in req.files
        ? (req.files['speech_file'] as Express.Multer.File[])[0]
        : undefined;
    const music = req.files && 'music_file' in req.files
        ? (req.files['music_file'] as Express.Multer.File[])[0]
        : undefined;
    const images = req.files && 'image_files' in req.files
        ? (req.files['image_files'] as Express.Multer.File[])
        : [];

    return { speech, music, images };
}

function parseRequestData(req: Request) {
    try {
        console.log('📥 Parsing request data...');
        const textData = JSON.parse(req.body.text_data || '[]');
        const videoSize: [number, number] = req.body.video_size ? JSON.parse(req.body.video_size) : [120, 120];
        const textConfig = JSON.parse(req.body.text_config || '{}');
        const fps = parseInt(req.body.fps);
        const duration = parseFloat(req.body.duration);

        if (!Array.isArray(videoSize) || videoSize.length !== 2) {
            return { error: 'Invalid or missing video_size. Provide as [width, height]' };
        }
        if (!textConfig) {
            return { error: 'Missing or invalid text_config' };
        }
        if (isNaN(fps)) {
            return { error: 'Invalid or missing fps. Provide a valid integer' };
        }
        if (isNaN(duration)) {
            return { error: 'Invalid or missing duration. Provide a valid numeric' };
        }

        return { textData, videoSize, textConfig, fps, duration };
    } catch (error) {
        console.error('❌ Invalid JSON format in request fields');
        return { error: 'Invalid JSON format in request fields' };
    }
}

function validateAndParseRequest(req: Request) {
    const parsed = parseRequestData(req);
    if (parsed.error) {
        throw new Error(parsed.error);
    }
    return parsed;
}

async function buildClaimCheck(req: Request, storage: Storage) {
    return await handleFileUploads(req, storage);
}

export function createMessagePayload(correlationId: string, claimCheck: Record<string, any>, requestParams: any) {
    const { videoSize, duration, textConfig, fps, textData } = requestParams;

    return {
        correlationId,
        ...claimCheck,
        videoSize,
        duration,
        textConfig,
        fps,
        textData
    };
}

export async function sendVideoCreationMessage(payload: any) {
    await sendMessageToQueue(config.kafka.topics.request, payload);
}

async function handleFileUploads(req: Request, storage: Storage) {
    const filePaths = saveUploadedFiles(req);
    const claimCheck: Record<string, string[] | string> = {};

    if (filePaths.speech) {
        claimCheck.speechFile = await storage.uploadAudioFile(filePaths.speech);
    }

    if (filePaths.music) {
        claimCheck.musicFile = await storage.uploadAudioFile(filePaths.music);
    }

    const imageClaims: string[] = [];
    for (const image of filePaths.images) {
        const imageClaim = await storage.uploadAudioFile(image);
        imageClaims.push(imageClaim);
    }

    claimCheck.imageFiles = imageClaims;

    return claimCheck;
}

async function processVideoCreationRequest(req: Request, correlationId: string) {
    const storage = await Storage.getInstance();

    try {
        const requestParams = validateAndParseRequest(req);
        const claimCheck = await buildClaimCheck(req, storage);
        const messagePayload = createMessagePayload(correlationId, claimCheck, requestParams);

        await sendVideoCreationMessage(messagePayload);

        return { success: true };
    } catch (error: any) {
        console.error(`❌ Error in processVideoCreationRequest: ${error.message}`);
        return { error: error.message };
    }
}

// Routes
router.post(
    '/v1/video-creation/',
    upload.fields([
        { name: 'speech_file', maxCount: 1 },
        { name: 'music_file', maxCount: 1 },
        { name: 'image_files', maxCount: 20 }
    ]),
    async (req: Request, res: Response) => {
        const correlationId = uuidv4();
        console.log(`🔄 Received video creation request: ${correlationId}`);

        const requestResponseService = App.getInstance().requestResponseService;
        requestResponseService.addRequest(correlationId).then(console.log);

        try {
            const result = await processVideoCreationRequest(req, correlationId);

            if (result.error) {
                console.error(`❌ Error in request: ${result.error}`);
                res.status(400).json({ error: result.error });

                return;
            }

            console.log(`✅ Kafka message sent for video creation request: ${correlationId}`);

            res.status(202).json({
                correlation_id: correlationId,
                message: `Video processing started. Use GET /v1/video-creation/${correlationId} to check status or download when ready.`
            });
        } catch (error) {
            console.error(`❌ Failed to process video creation request:`, error);
            res.status(500).json({
                error: 'Failed to process video creation request',
                correlation_id: correlationId
            });
        }
    }
);

router.get('/v1/video-creation/:correlationId', (req: Request, res: Response) => {
    const { correlationId } = req.params;
    const requestResponseService = App.getInstance().requestResponseService;
    console.log(`📦 Fetching video response for correlation_id: ${correlationId}`);

    const response = requestResponseService.getResponse(correlationId);

    if (!response) {
        console.warn(`⚠️ Video not found or still processing: ${correlationId}`);
        res.status(404).json({
            error: 'Video not found or still processing',
            correlation_id: correlationId
        });
        return;
    }

    console.log(`✅ Video processing completed for correlation_id: ${correlationId}`);
    res.status(200).json({
        correlation_id: correlationId,
        response
    });
});

export default router;
