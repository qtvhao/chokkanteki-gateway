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
    parentTaskId: string;

    constructor({
        speechFile,
        musicFile,
        videoSize,
        duration,
        imageFiles,
        textConfig,
        outputFile,
        fps,
        parentTaskId
    }: {
        speechFile?: string;
        musicFile?: string;
        videoSize: [number, number];
        duration: number;
        imageFiles: string[];
        textConfig: any;
        outputFile: string;
        fps: number;
        parentTaskId: string;
    }) {
        this.speechFile = speechFile;
        this.musicFile = musicFile;
        this.videoSize = videoSize;
        this.duration = duration;
        this.imageFiles = imageFiles;
        this.textConfig = textConfig;
        this.outputFile = outputFile;
        this.fps = fps;
        this.parentTaskId = parentTaskId;
    }

    createVideo(textData: any) {
        console.log(`🎬 Creating video with ${JSON.stringify(this)}`);
        fs.writeFileSync(this.outputFile, 'Video content placeholder');
    }
}

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

// Helpers
interface ClaimCheck {
    speechFile?: string;
    musicFile?: string;
    imageFiles: string[];
}

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
        const duration = req.body.duration !== undefined ? parseFloat(req.body.duration) : undefined;

        const startTime = req.body.start_time !== undefined ? parseFloat(req.body.start_time) : undefined;
        const endTime = req.body.end_time !== undefined ? parseFloat(req.body.end_time) : undefined;

        const parentTaskId = req.body.parent_task_id;
        if (!parentTaskId || typeof parentTaskId !== 'string' || parentTaskId.trim() === '') {
            return { error: 'Missing or invalid parent_task_id. It must be a non-empty string.' };
        }

        if (!Array.isArray(videoSize) || videoSize.length !== 2) {
            return { error: 'Invalid or missing video_size. Provide as [width, height]' };
        }
        if (!textConfig) {
            return { error: 'Missing or invalid text_config' };
        }
        if (isNaN(fps)) {
            return { error: 'Invalid or missing fps. Provide a valid integer' };
        }

        if (duration === undefined || isNaN(duration)) {
            if (startTime === undefined || isNaN(startTime)) {
                return { error: 'Missing duration. If duration is not provided, start_time is required.' };
            }
            if (endTime === undefined || isNaN(endTime)) {
                return { error: 'Missing duration. If duration is not provided, end_time is required.' };
            }
        }

        return {
            textData,
            videoSize,
            textConfig,
            fps,
            duration,
            startTime,
            endTime,
            parentTaskId
        };
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

export function createMessagePayload(correlationId: string, claimCheck: ClaimCheck, requestParams: any) {
    const {
        videoSize,
        duration,
        textConfig,
        fps,
        textData,
        startTime,
        endTime,
        parentTaskId
    } = requestParams;

    return {
        correlationId,
        ...claimCheck,
        videoSize,
        duration,
        textConfig,
        fps,
        textData,
        startTime,
        endTime,
        parentTaskId
    };
}

export async function sendVideoCreationMessage(payload: any) {
    await sendMessageToQueue(config.kafka.topics.request, payload);
}

async function handleFileUploads(req: Request, storage: Storage): Promise<ClaimCheck> {
    const filePaths = saveUploadedFiles(req);
    const claimCheck: ClaimCheck = { imageFiles: [] };

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

    if (imageClaims.length === 0) {
        throw new Error('At least one image file is required for video creation.');
    }

    return claimCheck;
}

async function processVideoCreationRequest(req: Request, correlationId: string) {
    const storage = await Storage.getInstance();

    try {
        const requestParams = validateAndParseRequest(req);
        const claimCheck = await handleFileUploads(req, storage);
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
    '/video-creation/',
    upload.fields([
        { name: 'speech_file', maxCount: 1 },
        { name: 'music_file', maxCount: 1 },
        { name: 'image_files', maxCount: 20 }
    ]),
    async (req: Request, res: Response) => {
        const correlationId = uuidv4();
        console.log(`🔄 Received video creation request: ${correlationId}`);

        const requestResponseService = App.getInstance().requestResponseService;
        requestResponseService.addRequest(correlationId).then(console.log).catch(console.log);

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

router.get('/video-creation/:correlationId', async (req: Request, res: Response) => {
    const { correlationId } = req.params;
    const requestResponseService = App.getInstance().requestResponseService;
    console.log(`📦 Fetching video response for correlation_id: ${correlationId}`);

    const response = requestResponseService.getResponse(correlationId);

    if (!response) {
        console.warn(`⚠️ No status found for correlation_id: ${correlationId}`);
        res.status(404).json({
            error: 'Request not found',
            correlation_id: correlationId
        });
        return;
    }

    if (response.status === 'processing') {
        console.log(`⏳ Video is still processing. Progress: ${response.progress || 0}%`);
        res.status(200).json({
            hostname: response.hostname,
            correlation_id: correlationId,
            status: response.status,
            progress: response.progress || 0
        });
        return;
    }

    if (!response.videoFile) {
        console.warn(`⚠️ Video file missing, still processing: ${correlationId}`);
        res.status(202).json({
            correlation_id: correlationId,
            status: response.status,
            message: 'Video is still processing'
        });
        return;
    }

    try {
        const storage = await Storage.getInstance();
        const stream = await storage.getFileStream(response.videoFile);

        res.setHeader('Content-Type', 'video/mp4');
        res.setHeader('Content-Disposition', `attachment; filename="${response.videoFile}"`);

        console.log(`✅ Streaming video file '${response.videoFile}' for correlation_id: ${correlationId}`);
        stream.pipe(res);
    } catch (error) {
        console.error(`❌ Error streaming video file '${response.videoFile}':`, error);
        res.status(500).json({
            error: 'Failed to stream video file',
            correlation_id: correlationId
        });
    }
});

export default router;
