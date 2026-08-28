import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import fs from 'fs/promises';
import fsSync from 'fs';
import https from 'https';
import path from 'path';
import { fileURLToPath } from 'url';
import JSZip from 'jszip';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, '../announcement.json');
const ADMIN_KEY = process.env.ADMIN_KEY || 'sk-K9OJf52OughwT8vizrDKJpvMebzutpbKVXxxhYe8EZFF0nm7';
const DIST_DIR = path.join(__dirname, '../dist');

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: '275mb' }));

const MINERU_API_BASE = 'https://mineru.net/api/v4';
const MINERU_TOKEN = process.env.MINERU_TOKEN || '';
const MINERU_PARSE_TIMEOUT_MS = 5 * 60 * 1000;
const MINERU_POLL_INTERVAL_MS = 3000;
const AITTCO_REQUEST_TIMEOUT_MS = 5 * 60 * 1000;
const IMAGE_GENERATION_REQUEST_TIMEOUT_MS = 2 * 60 * 1000;
const IMAGE_TASK_POLL_TIMEOUT_MS = 20 * 1000;
const IMAGE_TASK_TOTAL_TIMEOUT_MS = 2 * 60 * 1000;
const GPT_IMAGE2_SIZE_PATTERN = /^\s*(\d+)\s*[xX×]\s*(\d+)\s*$/;
const GPT_IMAGE2_RATIO_PATTERN = /^\s*(\d+(?:\.\d+)?)\s*[:xX×]\s*(\d+(?:\.\d+)?)\s*$/;
const GPT_IMAGE2_SIZE_MULTIPLE = 16;
const GPT_IMAGE2_MAX_EDGE = 3840;
const GPT_IMAGE2_MAX_ASPECT_RATIO = 3;
const GPT_IMAGE2_MIN_PIXELS = 655360;
const GPT_IMAGE2_MAX_PIXELS = 8294400;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const fetchWithTimeout = async (url, options, timeoutMs, timeoutMessage) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
        return await fetch(url, { ...options, signal: controller.signal });
    } catch (error) {
        if (controller.signal.aborted) {
            throw new Error(timeoutMessage || `上游请求超时（>${Math.round(timeoutMs / 1000)}s）`);
        }
        throw error;
    } finally {
        clearTimeout(timer);
    }
};

const roundGptImage2ToMultiple = (value, multiple = GPT_IMAGE2_SIZE_MULTIPLE) =>
    Math.max(multiple, Math.round(Number(value || 0) / multiple) * multiple);

const floorGptImage2ToMultiple = (value, multiple = GPT_IMAGE2_SIZE_MULTIPLE) =>
    Math.max(multiple, Math.floor(Number(value || 0) / multiple) * multiple);

const ceilGptImage2ToMultiple = (value, multiple = GPT_IMAGE2_SIZE_MULTIPLE) =>
    Math.max(multiple, Math.ceil(Number(value || 0) / multiple) * multiple);

const parseGptImage2Ratio = (ratio) => {
    const match = String(ratio || '').trim().match(GPT_IMAGE2_RATIO_PATTERN);
    if (!match) return { width: 1, height: 1 };
    const width = Number(match[1]);
    const height = Number(match[2]);
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
        return { width: 1, height: 1 };
    }
    return { width, height };
};

const normalizeGptImage2Dimensions = (width, height) => {
    let normalizedWidth = roundGptImage2ToMultiple(width);
    let normalizedHeight = roundGptImage2ToMultiple(height);
    const scaleToFit = (scale) => {
        normalizedWidth = floorGptImage2ToMultiple(normalizedWidth * scale);
        normalizedHeight = floorGptImage2ToMultiple(normalizedHeight * scale);
    };
    const scaleToFill = (scale) => {
        normalizedWidth = ceilGptImage2ToMultiple(normalizedWidth * scale);
        normalizedHeight = ceilGptImage2ToMultiple(normalizedHeight * scale);
    };

    for (let i = 0; i < 4; i += 1) {
        const maxEdge = Math.max(normalizedWidth, normalizedHeight);
        if (maxEdge > GPT_IMAGE2_MAX_EDGE) {
            scaleToFit(GPT_IMAGE2_MAX_EDGE / maxEdge);
        }

        if (normalizedWidth / normalizedHeight > GPT_IMAGE2_MAX_ASPECT_RATIO) {
            normalizedWidth = floorGptImage2ToMultiple(normalizedHeight * GPT_IMAGE2_MAX_ASPECT_RATIO);
        } else if (normalizedHeight / normalizedWidth > GPT_IMAGE2_MAX_ASPECT_RATIO) {
            normalizedHeight = floorGptImage2ToMultiple(normalizedWidth * GPT_IMAGE2_MAX_ASPECT_RATIO);
        }

        const pixels = normalizedWidth * normalizedHeight;
        if (pixels > GPT_IMAGE2_MAX_PIXELS) {
            scaleToFit(Math.sqrt(GPT_IMAGE2_MAX_PIXELS / pixels));
        } else if (pixels < GPT_IMAGE2_MIN_PIXELS) {
            scaleToFill(Math.sqrt(GPT_IMAGE2_MIN_PIXELS / pixels));
        }
    }

    return { width: normalizedWidth, height: normalizedHeight };
};

const normalizeGptImage2RequestSize = (size, ratio = '1:1') => {
    const normalizedSize = String(size || 'auto').trim().toLowerCase();
    if (!normalizedSize || normalizedSize === 'auto') return 'auto';

    const explicitMatch = normalizedSize.match(GPT_IMAGE2_SIZE_PATTERN);
    if (explicitMatch) {
        const normalized = normalizeGptImage2Dimensions(Number(explicitMatch[1]), Number(explicitMatch[2]));
        return `${normalized.width}x${normalized.height}`;
    }

    const tier = normalizedSize === '4k' ? '4k' : normalizedSize === '2k' ? '2k' : '1k';
    const parsedRatio = parseGptImage2Ratio(ratio);
    const ratioWidth = parsedRatio.width;
    const ratioHeight = parsedRatio.height;
    let width;
    let height;

    if (ratioWidth === ratioHeight) {
        const side = tier === '1k' ? 1024 : tier === '2k' ? 2048 : 3840;
        width = side;
        height = side;
    } else if (tier === '1k') {
        const shortSide = 1024;
        width = ratioWidth > ratioHeight
            ? roundGptImage2ToMultiple((shortSide * ratioWidth) / ratioHeight)
            : shortSide;
        height = ratioWidth > ratioHeight
            ? shortSide
            : roundGptImage2ToMultiple((shortSide * ratioHeight) / ratioWidth);
    } else {
        const longSide = tier === '2k' ? 2048 : 3840;
        width = ratioWidth > ratioHeight
            ? longSide
            : roundGptImage2ToMultiple((longSide * ratioWidth) / ratioHeight);
        height = ratioWidth > ratioHeight
            ? roundGptImage2ToMultiple((longSide * ratioHeight) / ratioWidth)
            : longSide;
    }

    const normalized = normalizeGptImage2Dimensions(width, height);
    return `${normalized.width}x${normalized.height}`;
};

const inferAspectRatioFromPrompt = (prompt = '') => {
    const text = String(prompt || '');
    const explicit = text.match(/(\d+(?:\.\d+)?)\s*[:：xX×]\s*(\d+(?:\.\d+)?)/);
    if (explicit) return `${explicit[1]}:${explicit[2]}`;
    if (/竖图|竖版|portrait|vertical/i.test(text)) return '9:16';
    if (/横图|横版|landscape|wide/i.test(text)) return '16:9';
    return '1:1';
};

const extractImageResults = (data) => {
    const list = [];
    const pushIfString = (value) => {
        if (typeof value === 'string' && value.trim()) {
            list.push(value.trim());
        }
    };

    if (Array.isArray(data?.data)) {
        for (const item of data.data) {
            pushIfString(item?.b64_json);
            pushIfString(item?.url);
            pushIfString(item?.image_url);
            pushIfString(item?.image);
        }
    }

    if (Array.isArray(data?.results)) {
        for (const item of data.results) {
            pushIfString(item?.b64_json);
            pushIfString(item?.url);
            pushIfString(item?.image_url);
            pushIfString(item?.image);
            pushIfString(item);
        }
    }

    if (Array.isArray(data?.images)) {
        for (const item of data.images) {
            pushIfString(item?.b64_json);
            pushIfString(item?.url);
            pushIfString(item?.image_url);
            pushIfString(item?.image);
            pushIfString(item);
        }
    }

    pushIfString(data?.b64_json);
    pushIfString(data?.url);
    pushIfString(data?.image_url);
    pushIfString(data?.image);

    return Array.from(new Set(list));
};
const extractImageResult = (data) => extractImageResults(data)[0] || null;

const extractImageTaskId = (data) => (
    data?.id ||
    data?.task_id ||
    data?.taskId ||
    data?.data?.id ||
    data?.data?.task_id ||
    null
);

const buildUpstreamError = async (response, fallback) => {
    const text = await response.text().catch(() => '');
    if (!text) return fallback;
    try {
        const json = JSON.parse(text);
        return json?.error?.message || json?.message || JSON.stringify(json).slice(0, 300);
    } catch {
        return text.slice(0, 300);
    }
};

const requestAittcoJson = ({ path, method = 'GET', apiKey, headers = {}, body = null, timeoutMs = AITTCO_REQUEST_TIMEOUT_MS }) =>
    new Promise((resolve, reject) => {
        const url = new URL(`${AITTCO_BASE}${path}`);
        const payload = body == null
            ? null
            : typeof body === 'string'
            ? body
            : JSON.stringify(body);

        const request = https.request(
            {
                protocol: url.protocol,
                hostname: url.hostname,
                port: url.port || 443,
                path: `${url.pathname}${url.search}`,
                method,
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    Accept: 'application/json',
                    'Accept-Encoding': 'identity',
                    Connection: 'close',
                    ...(payload
                        ? {
                              'Content-Type': 'application/json',
                              'Content-Length': Buffer.byteLength(payload),
                          }
                        : {}),
                    ...headers,
                },
            },
            (response) => {
                const chunks = [];

                response.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
                response.on('end', () => {
                    const text = Buffer.concat(chunks).toString('utf8');
                    let json = null;
                    try {
                        json = text ? JSON.parse(text) : null;
                    } catch {
                        json = null;
                    }

                    resolve({
                        ok: (response.statusCode || 500) >= 200 && (response.statusCode || 500) < 300,
                        status: response.statusCode || 500,
                        headers: response.headers,
                        rawText: text,
                        rawJson: json,
                        text: async () => text,
                        json: async () => json,
                    });
                });
            }
        );

        request.setTimeout(timeoutMs, () => {
            request.destroy(new Error(`图片接口请求超时（>${Math.round(timeoutMs / 1000)}s）`));
        });

        request.on('error', (error) => {
            reject(error);
        });

        if (payload) {
            request.write(payload);
        }

        request.end();
    });

const readAittcoError = (result, fallback) => {
    if (!result?.rawText) return fallback;
    if (result?.rawJson) {
        return (
            result.rawJson?.error?.message ||
            result.rawJson?.message ||
            JSON.stringify(result.rawJson).slice(0, 300)
        );
    }
    return String(result.rawText).slice(0, 300);
};

const pollGptImageTask = async ({ apiKey, taskId }) => {
    const encodedTaskId = encodeURIComponent(taskId);
    for (let attempt = 0; attempt < 45; attempt += 1) {
        await sleep(attempt === 0 ? 1000 : 2000);
        const response = await fetch(`${AITTCO_BASE}/v1/images/tasks/${encodedTaskId}`, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            throw new Error(await buildUpstreamError(response, `图片任务查询失败 (${response.status})`));
        }

        if (typeof response.json !== 'function') {
            const parsedJson = response.json;
            const parsedText = response.text || '';
            response.json = async () => parsedJson;
            response.text = async () => parsedText;
        }

        const data = await response.json().catch(() => null);
        const image = extractImageResult(data);
        if (image) return image;

        const status = String(data?.status || data?.state || '').trim().toLowerCase();
        if (['failure', 'failed', 'error', 'cancelled', 'canceled'].includes(status)) {
            throw new Error(data?.error || data?.failure_reason || '图片生成任务失败');
        }
        if (['success', 'succeeded', 'completed'].includes(status)) {
            throw new Error('图片生成任务已完成，但未返回图片数据');
        }
    }

    throw new Error('图片生成任务超时，请稍后重试');
};

const parseDataUrl = (dataUrl) => {
    const match = /^data:([^;]+);base64,(.+)$/s.exec(dataUrl || '');
    if (!match) return null;
    return {
        mimeType: match[1],
        buffer: Buffer.from(match[2], 'base64'),
    };
};

const parseDataUrlToBlob = (dataUrl, fallbackName = 'image') => {
    const parsed = parseDataUrl(dataUrl);
    if (!parsed) return null;
    const extension = parsed.mimeType.includes('jpeg')
        ? 'jpg'
        : parsed.mimeType.includes('webp')
        ? 'webp'
        : parsed.mimeType.includes('gif')
        ? 'gif'
        : 'png';
    return {
        blob: new Blob([parsed.buffer], { type: parsed.mimeType }),
        filename: `${fallbackName}.${extension}`,
    };
};

const pollGptImageTaskResult = async ({ apiKey, taskId }) => {
    const encodedTaskId = encodeURIComponent(taskId);
    const deadline = Date.now() + IMAGE_TASK_TOTAL_TIMEOUT_MS;
    for (let attempt = 0; attempt < 45; attempt += 1) {
        await sleep(attempt === 0 ? 1000 : 2000);
        const remainingMs = deadline - Date.now();
        if (remainingMs <= 0) break;
        const response = await fetchWithTimeout(`${AITTCO_BASE}/v1/images/tasks/${encodedTaskId}`, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
        }, Math.min(IMAGE_TASK_POLL_TIMEOUT_MS, remainingMs), '图片任务状态查询超时');

        if (!response.ok) {
            throw new Error(await buildUpstreamError(response, `图片任务查询失败 (${response.status})`));
        }

        const data = await response.json().catch(() => null);
        const images = extractImageResults(data);
        if (images.length > 0) {
            return {
                images,
                revisedPrompt: data?.data?.[0]?.revised_prompt || data?.revised_prompt || null,
            };
        }

        const status = String(data?.status || data?.state || '').trim().toLowerCase();
        if (['failure', 'failed', 'error', 'cancelled', 'canceled'].includes(status)) {
            throw new Error(data?.error || data?.failure_reason || '图片生成任务失败');
        }
        if (['success', 'succeeded', 'completed'].includes(status)) {
            throw new Error('图片生成任务已完成，但未返回图片数据');
        }
    }

    throw new Error('图片生成任务超时，请稍后重试');
};

const inferMineruOptions = (fileName, mimeType) => {
    const lower = String(fileName || '').toLowerCase();
    const isImage = String(mimeType || '').startsWith('image/') ||
        /\.(png|jpe?g|webp|gif|bmp|jp2)$/i.test(lower);

    return {
        language: 'ch',
        enable_table: true,
        enable_formula: true,
        is_ocr: isImage || lower.endsWith('.pdf'),
    };
};

const extractMarkdownFromZip = async (zipBuffer) => {
    const zip = await JSZip.loadAsync(zipBuffer);
    const files = Object.values(zip.files).filter((file) => !file.dir);
    const fullMd = files.find((file) => /(^|\/)full\.md$/i.test(file.name));
    const anyMd = files.find((file) => file.name.toLowerCase().endsWith('.md'));
    const target = fullMd || anyMd;
    if (!target) {
        throw new Error('MinerU result zip does not contain markdown');
    }
    return target.async('string');
};

const submitMineruFileTask = async ({ fileName, mimeType, buffer }) => {
    if (!MINERU_TOKEN) {
        throw new Error('MINERU_TOKEN is not configured on server');
    }

    const dataId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const createResp = await fetch(`${MINERU_API_BASE}/file-urls/batch`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${MINERU_TOKEN}`,
        },
        body: JSON.stringify({
            files: [{
                name: fileName,
                data_id: dataId,
                is_ocr: inferMineruOptions(fileName, mimeType).is_ocr,
            }],
            model_version: process.env.MINERU_MODEL_VERSION || 'vlm',
            ...inferMineruOptions(fileName, mimeType),
        }),
    });

    const createJson = await createResp.json().catch(() => null);
    if (!createResp.ok || createJson?.code !== 0) {
        throw new Error(createJson?.msg || `MinerU task create failed (${createResp.status})`);
    }

    const batchId = createJson.data?.batch_id;
    const fileUrl = createJson.data?.file_urls?.[0];
    if (!batchId || !fileUrl) {
        throw new Error('MinerU did not return batch_id or file upload url');
    }

    const uploadResp = await fetch(fileUrl, {
        method: 'PUT',
        body: buffer,
    });
    if (!uploadResp.ok) {
        throw new Error(`MinerU file upload failed (${uploadResp.status})`);
    }

    const start = Date.now();
    while (Date.now() - start < MINERU_PARSE_TIMEOUT_MS) {
        const statusResp = await fetch(`${MINERU_API_BASE}/extract-results/batch/${batchId}`, {
            headers: {
                Authorization: `Bearer ${MINERU_TOKEN}`,
                Accept: '*/*',
            },
        });
        const statusJson = await statusResp.json().catch(() => null);
        if (!statusResp.ok || statusJson?.code !== 0) {
            throw new Error(statusJson?.msg || `MinerU status query failed (${statusResp.status})`);
        }

        const result = statusJson.data?.extract_result?.find((item) => item.data_id === dataId) ||
            statusJson.data?.extract_result?.[0];
        if (!result) {
            await sleep(MINERU_POLL_INTERVAL_MS);
            continue;
        }

        if (result.state === 'done') {
            if (!result.full_zip_url) {
                throw new Error('MinerU task completed without full_zip_url');
            }
            const zipResp = await fetch(result.full_zip_url);
            if (!zipResp.ok) {
                throw new Error(`MinerU result zip download failed (${zipResp.status})`);
            }
            return {
                taskId: batchId,
                markdown: await extractMarkdownFromZip(await zipResp.arrayBuffer()),
            };
        }

        if (result.state === 'failed') {
            throw new Error(result.err_msg || 'MinerU parse failed');
        }

        await sleep(MINERU_POLL_INTERVAL_MS);
    }

    throw new Error(`MinerU parse timed out. batch_id=${batchId}`);
};

const AITTCO_BASE = 'https://api.aittco.com';

// --- Middleware: Auth ---
const adminAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader === `Bearer ${ADMIN_KEY}`) {
        return next();
    }
    return res.status(401).json({ message: '管理员 API Key 无效' });
};

// --- Helpers ---
const readData = async () => {
    try {
        const content = await fs.readFile(DATA_FILE, 'utf-8');
        return JSON.parse(content || '[]');
    } catch (err) {
        return [];
    }
};

const writeData = async (data) => {
    await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
};

const extractRateLimit = (headers) => {
    const pick = (name) => headers.get(name) || headers.get(name.toLowerCase()) || null;
    return {
        limitRequests: pick('x-ratelimit-limit-requests'),
        remainingRequests: pick('x-ratelimit-remaining-requests'),
        limitTokens: pick('x-ratelimit-limit-tokens'),
        remainingTokens: pick('x-ratelimit-remaining-tokens'),
        resetRequests: pick('x-ratelimit-reset-requests'),
        resetTokens: pick('x-ratelimit-reset-tokens'),
    };
};

const collectNumericCandidates = (obj, targetKeys, collector = []) => {
    if (!obj || typeof obj !== 'object') return collector;

    for (const [k, v] of Object.entries(obj)) {
        if (targetKeys.includes(k) && (typeof v === 'number' || typeof v === 'string')) {
            collector.push(v);
        }
        if (v && typeof v === 'object') {
            collectNumericCandidates(v, targetKeys, collector);
        }
    }
    return collector;
};

const pickFirstNumber = (values) => {
    for (const v of values) {
        const n = Number(v);
        if (!Number.isNaN(n)) return n;
    }
    return null;
};

const normalizeQuotaPayload = (payload) => {
    if (!payload || typeof payload !== 'object') return null;

    const totalCandidates = collectNumericCandidates(payload, [
        'quota',
        'total_quota',
        'total_available',
        'total_granted',
        'grant_amount',
        'hard_limit_usd',
        'hard_limit',
        'quota_total',
        'balance_total',
    ]);
    const usedCandidates = collectNumericCandidates(payload, [
        'used',
        'used_quota',
        'total_used',
        'used_amount',
        'quota_used',
        'balance_used',
        'consumed_amount',
    ]);
    const remainingCandidates = collectNumericCandidates(payload, [
        'remain',
        'remain_quota',
        'residual_quota',
        'available_quota',
        'remaining_amount',
        'quota_remaining',
        'balance_remaining',
        'available_amount',
        'total_available',
    ]);
    const expireCandidates = collectNumericCandidates(payload, [
        'expires_at',
        'expire_at',
        'access_until',
        'expired_at',
    ]);

    let total = pickFirstNumber(totalCandidates);
    const used = pickFirstNumber(usedCandidates);
    let remaining = pickFirstNumber(remainingCandidates);
    let expiresAt = pickFirstNumber(expireCandidates);

    if (total == null && remaining != null && used != null) {
        total = remaining + used;
    }
    if (remaining == null && total != null && used != null) {
        remaining = total - used;
    }
    if (expiresAt != null && expiresAt <= 0) {
        expiresAt = null;
    }

    if (total == null && used == null && remaining == null && expiresAt == null) return null;

    return {
        total,
        used,
        remaining,
        expiresAt,
    };
};

const mergeQuota = (base, next) => {
    if (!next) return base;
    if (!base) return { ...next };
    return {
        total: base.total ?? next.total ?? null,
        used: base.used ?? next.used ?? null,
        remaining: base.remaining ?? next.remaining ?? null,
        expiresAt: base.expiresAt ?? next.expiresAt ?? null,
    };
};

const requestWithKey = async (apiKey, path) => {
    const res = await fetch(`${AITTCO_BASE}${path}`, {
        method: 'GET',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
    });

    const text = await res.text();
    let json = null;
    try {
        json = text ? JSON.parse(text) : null;
    } catch {
        json = null;
    }

    return {
        ok: res.ok,
        status: res.status,
        json,
        text,
        rateLimit: extractRateLimit(res.headers),
    };
};

// --- Endpoints ---

app.post('/api/mineru/parse', async (req, res) => {
    try {
        const { fileName, mimeType, dataUrl } = req.body || {};
        if (!fileName || typeof fileName !== 'string') {
            return res.status(400).json({ message: 'fileName is required' });
        }

        const parsed = parseDataUrl(dataUrl);
        if (!parsed) {
            return res.status(400).json({ message: 'dataUrl must be a valid base64 data URL' });
        }

        // MinerU Precision API supports files up to 200 MB.
        if (parsed.buffer.length > 200 * 1024 * 1024) {
            return res.status(413).json({ message: '文件超过 MinerU Token 版精准解析 API 200MB 限制，请拆分后再上传。' });
        }

        const result = await submitMineruFileTask({
            fileName,
            mimeType: mimeType || parsed.mimeType,
            buffer: parsed.buffer,
        });

        return res.json({
            taskId: result.taskId,
            markdown: result.markdown,
        });
    } catch (error) {
        return res.status(502).json({
            message: 'MinerU 解析失败',
            detail: error instanceof Error ? error.message : String(error),
        });
    }
});

app.post('/api/image/generate-v2', async (req, res) => {
    try {
        const {
            apiKey,
            prompt,
            model = 'gpt-image-2',
            attachments = [],
            size = 'auto',
            aspectRatio = 'auto',
            quality = 'auto',
            outputFormat = 'png',
            outputCompression = null,
            moderation = 'auto',
            n = 1,
        } = req.body || {};

        if (!apiKey || typeof apiKey !== 'string' || !apiKey.startsWith('sk-')) {
            return res.status(400).json({ message: 'API Key 格式错误' });
        }
        if (!prompt || typeof prompt !== 'string') {
            return res.status(400).json({ message: 'prompt is required' });
        }
        if (model !== 'gpt-image-2') {
            return res.status(400).json({ message: 'Only gpt-image-2 is supported by this endpoint' });
        }

        const inputImages = Array.isArray(attachments)
            ? attachments
                .filter((item) => item && item.type === 'image' && typeof item.content === 'string')
                .map((item) => item.content)
                .filter(Boolean)
            : [];
        const resolvedRatio = !aspectRatio || aspectRatio === 'auto'
            ? inferAspectRatioFromPrompt(prompt)
            : aspectRatio;
        const normalizedSize = normalizeGptImage2RequestSize(size, resolvedRatio);
        const normalizedCount = 1;
        const normalizedCompression = typeof outputCompression === 'number'
            ? Math.max(0, Math.min(outputCompression, 100))
            : null;
        const upstreamModel = model;

        let response;
        if (inputImages.length > 0) {
            const formData = new FormData();
            formData.append('model', upstreamModel);
            formData.append('prompt', prompt);
            formData.append('size', normalizedSize);
            formData.append('quality', quality);
            formData.append('output_format', outputFormat);
            formData.append('moderation', moderation);
            formData.append('n', String(normalizedCount));

            if (outputFormat !== 'png' && normalizedCompression !== null) {
                formData.append('output_compression', String(normalizedCompression));
            }

            inputImages.forEach((dataUrl, index) => {
                const parsed = parseDataUrlToBlob(dataUrl, `reference-${index + 1}`);
                if (parsed) {
                    formData.append('image', parsed.blob, parsed.filename);
                }
            });

            response = await fetchWithTimeout(`${AITTCO_BASE}/v1/images/edits`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                },
                body: formData,
            }, IMAGE_GENERATION_REQUEST_TIMEOUT_MS, '图片编辑请求超时，请稍后重试');
        } else {
            const payload = {
                model: upstreamModel,
                prompt,
                size: normalizedSize,
                quality,
                output_format: outputFormat,
                moderation,
                n: normalizedCount,
                ...(outputFormat !== 'png' && normalizedCompression !== null
                    ? { output_compression: normalizedCompression }
                    : {}),
            };

            response = await requestAittcoJson({
                path: '/v1/images/generations',
                method: 'POST',
                apiKey,
                body: payload,
                timeoutMs: IMAGE_GENERATION_REQUEST_TIMEOUT_MS,
            });
        }

        if (!response.ok) {
            throw new Error(await buildUpstreamError(response, `图片生成请求失败 (${response.status})`));
        }

        const data = await response.json().catch(() => null);
        let images = extractImageResults(data);
        let revisedPrompt = data?.data?.[0]?.revised_prompt || data?.revised_prompt || null;

        if (images.length === 0) {
            const taskId = extractImageTaskId(data);
            if (!taskId) {
                throw new Error('生图接口返回异常，未找到图片或任务 ID');
            }
            const polled = await pollGptImageTaskResult({ apiKey, taskId });
            images = polled.images;
            revisedPrompt = polled.revisedPrompt;
        }

        return res.json({
            images,
            revisedPrompt,
            size: normalizedSize,
            aspectRatio: resolvedRatio,
            upstreamModel,
            mode: inputImages.length > 0 ? 'edit' : 'generate',
        });
    } catch (error) {
        console.error('[image/generate-v2] failed:', error);
        return res.status(502).json({
            message: '图片生成失败',
            detail:
                error instanceof Error
                    ? error.cause instanceof Error
                        ? `${error.message}: ${error.cause.message}`
                        : error.message
                    : String(error),
        });
    }
});

app.post('/api/image/generate', async (req, res) => {
    try {
        const {
            apiKey,
            prompt,
            model = 'gpt-image-2',
            size = '1k',
            aspectRatio,
            quality = 'auto',
            outputFormat = 'png',
            moderation = 'auto',
        } = req.body || {};

        if (!apiKey || typeof apiKey !== 'string' || !apiKey.startsWith('sk-')) {
            return res.status(400).json({ message: 'API Key 格式错误' });
        }
        if (!prompt || typeof prompt !== 'string') {
            return res.status(400).json({ message: 'prompt is required' });
        }
        if (model !== 'gpt-image-2') {
            return res.status(400).json({ message: 'Only gpt-image-2 is supported by this endpoint' });
        }

        const ratio = aspectRatio || inferAspectRatioFromPrompt(prompt);
        const normalizedSize = normalizeGptImage2RequestSize(size, ratio);
        const payload = {
            model,
            prompt,
            size: normalizedSize,
            quality,
            output_format: outputFormat,
            moderation,
        };

        const response = await fetch(`${AITTCO_BASE}/v1/images/generations`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            throw new Error(await buildUpstreamError(response, `图片生成请求失败 (${response.status})`));
        }

        const data = await response.json().catch(() => null);
        let image = extractImageResult(data);
        if (!image) {
            const taskId = extractImageTaskId(data);
            if (!taskId) {
                throw new Error('生图接口返回异常，未找到图片或任务 ID');
            }
            image = await pollGptImageTask({ apiKey, taskId });
        }

        return res.json({
            image,
            size: normalizedSize,
            aspectRatio: ratio,
        });
    } catch (error) {
        return res.status(502).json({
            message: '图片生成失败',
            detail: error instanceof Error ? error.message : String(error),
        });
    }
});

// 0. POST /api/key-info (quota/balance lookup)
app.post('/api/key-info', async (req, res) => {
    const { apiKey } = req.body || {};
    if (!apiKey || typeof apiKey !== 'string' || !apiKey.startsWith('sk-')) {
        return res.status(400).json({ message: 'API Key 格式错误' });
    }

    try {
        // Try common billing/token endpoints first (some relay keys cannot access /v1/models).
        const today = new Date();
        const startDate = new Date(today.getTime() - 180 * 24 * 60 * 60 * 1000)
            .toISOString()
            .slice(0, 10);
        const endDate = today.toISOString().slice(0, 10);

        const candidates = [
            '/api/token/self',
            '/api/user/self',
            '/api/user/token',
            '/v1/dashboard/billing/credit_grants',
            '/dashboard/billing/credit_grants',
            '/v1/billing/credit_grants',
            '/v1/dashboard/billing/subscription',
            '/dashboard/billing/subscription',
            '/v1/billing/subscription',
            `/v1/dashboard/billing/usage?start_date=${startDate}&end_date=${endDate}`,
            `/dashboard/billing/usage?start_date=${startDate}&end_date=${endDate}`,
            '/api/key/balance',
        ];

        let quota = null;
        const rawBilling = [];
        let validByBillingEndpoint = false;
        for (const path of candidates) {
            const billingResp = await requestWithKey(apiKey, path);
            if (billingResp.ok && billingResp.json) {
                validByBillingEndpoint = true;
                const normalized = normalizeQuotaPayload(billingResp.json);
                rawBilling.push({ path, status: billingResp.status, body: billingResp.json });
                if (normalized) {
                    quota = mergeQuota(quota, normalized);
                }
            }
        }

        // Try to complete missing fields by arithmetic.
        if (quota) {
            const totalNum = Number(quota.total);
            const usedNum = Number(quota.used);
            const remainNum = Number(quota.remaining);

            if (Number.isFinite(totalNum) && Number.isFinite(remainNum) && !Number.isFinite(usedNum)) {
                quota.used = totalNum - remainNum;
            }
            if (Number.isFinite(totalNum) && Number.isFinite(usedNum) && !Number.isFinite(remainNum)) {
                quota.remaining = totalNum - usedNum;
            }
            if (!Number.isFinite(totalNum) && Number.isFinite(usedNum) && Number.isFinite(remainNum)) {
                quota.total = usedNum + remainNum;
            }
        }

        // Optional model probe for validity/rate-limit headers.
        const modelsResp = await requestWithKey(apiKey, '/v1/models');
        const valid = validByBillingEndpoint || modelsResp.ok;

        if (!valid) {
            return res.status(modelsResp.status || 401).json({
                message: '密钥无效或暂不可用',
                detail: modelsResp.json || modelsResp.text || null,
            });
        }

        return res.json({
            valid,
            quota,
            rateLimit: modelsResp.ok ? modelsResp.rateLimit : null,
            billingRaw: rawBilling.length > 0 ? rawBilling : null,
        });
    } catch (error) {
        return res.status(500).json({
            message: '查询失败，请稍后重试',
            detail: error instanceof Error ? error.message : String(error),
        });
    }
});

// 1. GET /api/announcements (List)
app.get('/api/announcements', async (req, res) => {
    const { page = 1, pageSize = 10, search = '', all = '0' } = req.query;
    
    // Auth check if all=1
    if (all === '1') {
        const authHeader = req.headers.authorization;
        if (authHeader !== `Bearer ${ADMIN_KEY}`) {
            return res.status(401).json({ message: '管理员 API Key 无效' });
        }
    }

    let data = await readData();

    // Filter by active status (unless all=1)
    if (all !== '1') {
        data = data.filter(n => n.active);
    }

    // Search
    if (search) {
        const s = search.toLowerCase();
        data = data.filter(n => 
            n.title.toLowerCase().includes(s) || 
            n.content.toLowerCase().includes(s)
        );
    }

    // Sorting: Pinned first, then Date desc
    data.sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return new Date(b.date) - new Date(a.date);
    });

    // Pagination
    const total = data.length;
    const startIndex = (page - 1) * pageSize;
    const items = data.slice(startIndex, startIndex + parseInt(pageSize));

    res.json({
        total,
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        items
    });
});

// 2. GET /api/announcement (Top single)
app.get('/api/announcement', async (req, res) => {
    const data = await readData();
    const active = data.filter(n => n.active);
    
    if (active.length === 0) return res.json(null);

    // Sort: Pinned first, then Date desc
    active.sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return new Date(b.date) - new Date(a.date);
    });

    res.json(active[0]);
});

// 3. POST /api/announcement (Create)
app.post('/api/announcement', adminAuth, async (req, res) => {
    const { title, content, active = true, pinned = false } = req.body;
    const data = await readData();
    
    const newNotice = {
        id: Date.now().toString(),
        title,
        content,
        active,
        pinned,
        date: new Date().toISOString()
    };

    data.unshift(newNotice);
    await writeData(data);
    res.status(201).json(newNotice);
});

// 4. PATCH /api/announcement/:id (Update)
app.patch('/api/announcement/:id', adminAuth, async (req, res) => {
    const { id } = req.params;
    const updates = req.body;
    const data = await readData();
    
    const index = data.findIndex(n => n.id === id);
    if (index === -1) return res.status(404).json({ message: '公告不存在' });

    data[index] = { ...data[index], ...updates };
    await writeData(data);
    res.json(data[index]);
});

// 5. DELETE /api/announcement/:id (Delete)
app.delete('/api/announcement/:id', adminAuth, async (req, res) => {
    const { id } = req.params;
    const data = await readData();
    
    const filtered = data.filter(n => n.id !== id);
    if (filtered.length === data.length) return res.status(404).json({ message: '公告不存在' });

    await writeData(filtered);
    res.json({ success: true });
});

// Serve built frontend in production containers.
if (fsSync.existsSync(DIST_DIR)) {
    app.use(express.static(DIST_DIR));
    app.get(/^(?!\/api\/).*/, (req, res, next) => {
        if (req.path.startsWith('/api/')) return next();
        return res.sendFile(path.join(DIST_DIR, 'index.html'));
    });
}

const PORT = Number(process.env.PORT || 3001);
app.listen(PORT, () => {
    console.log(`Aittco server running on http://localhost:${PORT}`);
});
