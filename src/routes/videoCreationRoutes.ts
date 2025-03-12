import express, { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

class VideoCreator {
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
const videoMap: Record<string, string> = {};
const lock: { isLocked: boolean } = { isLocked: false };

// Helpers
function saveUploadedFiles(req: Request) {
    console.log('📂 Saving uploaded files...');
    const speech = req.files && 'speech_file' in req.files
        ? (req.files['speech_file'] as Express.Multer.File[])[0].path
        : undefined;
    const music = req.files && 'music_file' in req.files
        ? (req.files['music_file'] as Express.Multer.File[])[0].path
        : undefined;
    const images = req.files && 'image_files' in req.files
        ? (req.files['image_files'] as Express.Multer.File[]).map(file => file.path)
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

function createVideoFile(
    correlationId: string,
    speechPath: string | undefined,
    musicPath: string | undefined,
    imagePaths: string[],
    videoSize: [number, number],
    duration: number,
    textConfig: any,
    fps: number,
    textData: any
) {
    if (lock.isLocked) {
        console.log('🔒 Video creation already in progress');
        return;
    }

    lock.isLocked = true;
    console.log(`⏳ Processing video for correlation_id: ${correlationId}...`);

    const outputFile = path.join('outputs', `output_video_${correlationId}.mp4`);
    const videoCreator = new VideoCreator({
        speechFile: speechPath,
        musicFile: musicPath,
        videoSize,
        duration,
        imageFiles: imagePaths,
        textConfig,
        outputFile,
        fps
    });

    videoCreator.createVideo(textData);
    videoMap[correlationId] = outputFile;

    console.log(`✅ Video creation completed: ${outputFile}`);
    lock.isLocked = false;
}

// Routes
router.post(
    '/api/v1/video-creation/',
    upload.fields([
        { name: 'speech_file', maxCount: 1 },
        { name: 'music_file', maxCount: 1 },
        { name: 'image_files', maxCount: 20 }
    ]),
    (req: Request, res: Response) => {
        const correlationId = uuidv4();
        console.log(`🔄 Received video creation request: ${correlationId}`);

        const filePaths = saveUploadedFiles(req);
        const {
            textData,
            videoSize,
            textConfig,
            fps,
            duration,
            error
        } = parseRequestData(req);

        if (error) {
            console.error(`❌ Error in request: ${error}`);
            res.status(400).json({ error });
            return;
        }

        // Start video creation asynchronously
        setImmediate(() => {
            if (videoSize) {
                createVideoFile(
                    correlationId,
                    filePaths.speech,
                    filePaths.music,
                    filePaths.images,
                    videoSize,
                    duration,
                    textConfig,
                    fps,
                    textData
                );
            }
        });

        console.log(`✅ Video processing started: ${correlationId}`);
        res.status(202).json({
            correlation_id: correlationId,
            message: `Video processing started. Use GET /api/v1/video-creation/${correlationId} to download.`
        });
    }
);

router.get('/api/v1/video-creation/:correlationId', (req: Request, res: Response) => {
    const { correlationId } = req.params;
    console.log(`📦 Fetching video for correlation_id: ${correlationId}`);

    const outputFile = videoMap[correlationId];
    if (!outputFile || !fs.existsSync(outputFile)) {
        console.warn(`⚠️ Video not found or still processing: ${correlationId}`);
        res.status(404).json({
            error: 'Video not found or still processing',
            correlation_id: correlationId
        });

        return;
    }

    console.log(`✅ Video ready for download: ${correlationId}`);
    res.download(outputFile, 'output_video.mp4');
});

export default router;
