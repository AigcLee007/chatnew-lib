import { Attachment, AttachmentChunk } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { countTokens } from './token';
import { getDocumentChunks, saveDocumentRecord } from './db';

// --- 根本性改变：直接引入本地依赖，不再依赖不稳定的外部 CDN ---
import * as pdfjsLib from 'pdfjs-dist';
import JSZip from 'jszip';
// Vite 会自动处理这个 ?url 引用，把它指向构建后的本地资源
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.js?url';
import * as mammoth from 'mammoth';
import * as XLSX from 'xlsx';

// 配置 PDF.js Worker 为本地路径
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

// 使用国内镜像源加载 PDF 字体映射 (CMaps)，防止中文 PDF 乱码
const CMAP_URL = 'https://npmmirror.com/package/pdfjs-dist/v/3.11.174/files/cmaps/';

// ------------------------------------------------------------------
// 本地解析逻辑 (主线程运行)
// ------------------------------------------------------------------

async function processPdf(buffer: ArrayBuffer): Promise<string> {
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(buffer),
    cMapUrl: CMAP_URL,
    cMapPacked: true,
  });

  const pdf = await loadingTask.promise;
  let fullText = '';
  const maxPages = Math.min(pdf.numPages, 50); // 限制页数

  for (let i = 1; i <= maxPages; i++) {
    try {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: { str: string }) => item.str).join(' ');
        
        if (pageText.trim()) {
          fullText += `--- Page ${i} ---\n${pageText}\n\n`;
        }
    } catch (err) {
        console.warn(`Page ${i} parsing error:`, err);
    }
  }
  
  if (fullText.length < 50 && pdf.numPages > 0) {
      return "[System Hint: This PDF seems to be a scanned image. Please convert it to images and upload for best results.]";
  }
  
  return fullText;
}

async function processDocx(buffer: ArrayBuffer): Promise<string> {
  const { value } = await mammoth.extractRawText({ arrayBuffer: buffer });
  return value.trim();
}

async function processExcel(buffer: ArrayBuffer): Promise<string> {
  const workbook = XLSX.read(buffer, { type: 'array' });
  let fullText = '';
  
  workbook.SheetNames.forEach(sheetName => {
    const worksheet = workbook.Sheets[sheetName];
    const csv = XLSX.utils.sheet_to_csv(worksheet);
    if (csv.trim()) {
      fullText += `--- Sheet: ${sheetName} ---\n${csv}\n\n`;
    }
  });
  return fullText;
}

async function processPptx(buffer: ArrayBuffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  let fullText = '';

  // 获取所有幻灯片文件
  const slideFiles = Object.keys(zip.files).filter(fileName => 
    fileName.match(/^ppt\/slides\/slide\d+\.xml$/)
  );

  // 按数字顺序排序
  slideFiles.sort((a, b) => {
    const numA = parseInt(a.match(/\d+/)![0]);
    const numB = parseInt(b.match(/\d+/)![0]);
    return numA - numB;
  });

  for (const fileName of slideFiles) {
    const content = await zip.files[fileName].async('string');
    // 简单 XML 解析：移除标签，保留文本
    const text = content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (text) {
      const slideNum = fileName.match(/\d+/)![0];
      fullText += `--- Slide ${slideNum} ---\n${text}\n\n`;
    }
  }

  return fullText || "[PPTX 解析完成，但未提取到文本，可能是纯图片幻灯片]";
}

// ------------------------------------------------------------------
// 主入口
// ------------------------------------------------------------------

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const MINERU_DOCUMENT_EXTENSIONS = [
  '.pdf',
  '.doc',
  '.docx',
  '.ppt',
  '.pptx',
  '.xls',
  '.xlsx',
];

const isMineruDocument = (file: File): boolean => {
  const lowerName = file.name.toLowerCase();
  return MINERU_DOCUMENT_EXTENSIONS.some((ext) => lowerName.endsWith(ext));
};

const CHUNK_TOKEN_TARGET = 1100;
const CHUNK_TOKEN_HARD_LIMIT = 1500;
const DEFAULT_RETRIEVAL_BUDGET = 14000;

function normalizeForSearch(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ');
}

function queryTerms(query: string): string[] {
  const normalized = normalizeForSearch(query);
  const terms = normalized.match(/[\p{L}\p{N}_-]{2,}/gu) || [];
  return Array.from(new Set(terms)).slice(0, 80);
}

function chunkTextByTokens(text: string, targetTokens = CHUNK_TOKEN_TARGET): string[] {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let current = '';
  let currentTokens = 0;

  for (const paragraph of paragraphs) {
    const paragraphTokens = countTokens(paragraph);

    if (paragraphTokens > CHUNK_TOKEN_HARD_LIMIT) {
      if (current.trim()) {
        chunks.push(current.trim());
        current = '';
        currentTokens = 0;
      }

      const sentences = paragraph.split(/(?<=[.!?。！？；;])\s*/).filter(Boolean);
      let sentenceChunk = '';
      let sentenceTokens = 0;
      for (const sentence of sentences) {
        const sentenceTokenCount = countTokens(sentence);
        if (sentenceChunk && sentenceTokens + sentenceTokenCount > targetTokens) {
          chunks.push(sentenceChunk.trim());
          sentenceChunk = '';
          sentenceTokens = 0;
        }
        sentenceChunk += `${sentence}\n`;
        sentenceTokens += sentenceTokenCount;
      }
      if (sentenceChunk.trim()) chunks.push(sentenceChunk.trim());
      continue;
    }

    if (current && currentTokens + paragraphTokens > targetTokens) {
      chunks.push(current.trim());
      current = '';
      currentTokens = 0;
    }

    current += `${paragraph}\n\n`;
    currentTokens += paragraphTokens;
  }

  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

function extractChunkTitle(content: string, fallback: string): string {
  const heading = content.match(/^#{1,6}\s+(.+)$/m)?.[1];
  if (heading) return heading.slice(0, 120);
  const page = content.match(/---\s*(Page|Slide|Sheet)[:\s-]+(.+?)\s*---/i);
  if (page) return `${page[1]} ${page[2]}`.slice(0, 120);
  return fallback;
}

async function buildDocumentAttachment(id: string, name: string, markdown: string, included = true): Promise<Attachment> {
  const rawChunks = chunkTextByTokens(markdown);
  const chunks: AttachmentChunk[] = rawChunks.map((content, index) => ({
    id: `${id}-chunk-${index + 1}`,
    index,
    title: extractChunkTitle(content, `Chunk ${index + 1}`),
    content,
    tokenCount: countTokens(content),
  }));

  const fullTokenCount = countTokens(markdown);
  const tableOfContents = chunks
    .slice(0, 80)
    .map((chunk) => `${chunk.index + 1}. ${chunk.title}`)
    .join('\n');

  const overview = [
    `[System: Parsed document "${name}" is stored as ${chunks.length} searchable chunks.]`,
    `Full document tokens: ${fullTokenCount}.`,
    'Do not assume the whole document is present unless selected chunks are included below.',
    tableOfContents ? `\nDocument chunk index:\n${tableOfContents}` : '',
  ].filter(Boolean).join('\n');

  await saveDocumentRecord(
    {
      id,
      name,
      type: 'text',
      overview,
      tokenCount: countTokens(overview),
      fullTokenCount,
      chunkCount: chunks.length,
      createdAt: Date.now(),
    },
    chunks.map((chunk) => ({
      ...chunk,
      documentId: id,
    }))
  );

  return {
    id,
    name: `${name}.md`,
    type: 'text',
    content: overview,
    tokenCount: countTokens(overview),
    fullTokenCount,
    documentId: id,
    chunkCount: chunks.length,
    included,
  };
}

function scoreChunk(chunk: AttachmentChunk, terms: string[], query: string): number {
  const haystack = normalizeForSearch(`${chunk.title}\n${chunk.content}`);
  const title = normalizeForSearch(chunk.title);
  let score = 0;

  for (const term of terms) {
    if (haystack.includes(term)) score += 8;
    if (title.includes(term)) score += 6;
  }

  if (/摘要|总结|概括|overview|summary|全文|整篇|论文/i.test(query)) {
    score += Math.max(0, 12 - chunk.index);
  }

  if (/方法|method|实验|experiment/i.test(query) && /method|方法|实验|experiment/i.test(haystack)) score += 18;
  if (/结果|result|发现|finding/i.test(query) && /result|结果|发现|finding/i.test(haystack)) score += 18;
  if (/结论|conclusion|讨论|discussion/i.test(query) && /conclusion|结论|讨论|discussion/i.test(haystack)) score += 18;
  if (/参考文献|citation|reference/i.test(query) && /reference|参考文献|citation/i.test(haystack)) score += 18;

  return score;
}

export function prepareAttachmentForPrompt(
  att: Attachment,
  query: string,
  tokenBudget = DEFAULT_RETRIEVAL_BUDGET
): Attachment {
  if (!att.chunks?.length) return att;

  const terms = queryTerms(query);
  const ranked = att.chunks
    .map((chunk) => ({ chunk, score: scoreChunk(chunk, terms, query) }))
    .sort((a, b) => b.score - a.score || a.chunk.index - b.chunk.index);

  const selected: AttachmentChunk[] = [];
  let used = 0;
  for (const { chunk } of ranked) {
    if (selected.some((item) => item.id === chunk.id)) continue;
    if (used + chunk.tokenCount > tokenBudget && selected.length > 0) continue;
    selected.push(chunk);
    used += chunk.tokenCount;
    if (used >= tokenBudget) break;
  }

  if (selected.length === 0) {
    selected.push(...att.chunks.slice(0, 6));
  }

  selected.sort((a, b) => a.index - b.index);
  const content = [
    `[System: Selected relevant chunks from "${att.name}".]`,
    `Selected ${selected.length}/${att.chunks.length} chunks. Full document tokens: ${att.fullTokenCount || 'unknown'}.`,
    'If the answer needs unavailable sections, say which section/page should be retrieved next.',
    ...selected.map((chunk) => `\n--- CHUNK ${chunk.index + 1}: ${chunk.title} ---\n${chunk.content}\n--- END CHUNK ${chunk.index + 1} ---`),
  ].join('\n');

  return {
    ...att,
    content,
    tokenCount: countTokens(content),
    chunks: undefined,
  };
}

export async function prepareAttachmentForPromptAsync(
  att: Attachment,
  query: string,
  tokenBudget = DEFAULT_RETRIEVAL_BUDGET
): Promise<Attachment> {
  if (!att.documentId) return prepareAttachmentForPrompt(att, query, tokenBudget);
  const chunks = await getDocumentChunks(att.documentId);
  if (!chunks.length) return att;
  return prepareAttachmentForPrompt({ ...att, chunks }, query, tokenBudget);
}

export async function parseAttachmentWithMinerU(att: Attachment): Promise<Attachment> {
  if (!att.content || !att.content.startsWith('data:')) {
    throw new Error('附件不是可提交给 MinerU 的 base64 data URL');
  }

  const response = await fetch('/api/mineru/parse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fileName: att.name,
      mimeType: att.content.match(/^data:([^;]+);base64,/)?.[1] || '',
      dataUrl: att.content,
    }),
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.detail || data?.message || `MinerU 解析失败 (${response.status})`);
  }

  const markdown = String(data?.markdown || '').trim();
  if (!markdown) {
    throw new Error('MinerU 未返回有效 Markdown 内容');
  }

  return buildDocumentAttachment(att.id, att.name, markdown, att.included);
}

async function parseFileWithMinerU(file: File): Promise<Attachment> {
  const dataUrl = await readFileAsBase64(file);
  return parseAttachmentWithMinerU({
    id: uuidv4(),
    name: file.name,
    type: file.type || 'application/octet-stream',
    content: dataUrl,
    included: true,
  });
}

export const processFile = async (file: File): Promise<Attachment> => {
  const id = uuidv4();
  const type = file.type;
  const name = file.name;

  // 1. 图片处理 (保持不变，最快速度)
  if (type.startsWith('image/')) {
    const base64 = await readFileAsBase64(file);
    return {
        id,
        name,
        type: 'image',
        content: base64,
        preview: base64,
        tokenCount: 800
    };
  }

  if (isMineruDocument(file)) {
      try {
          return await parseFileWithMinerU(file);
      } catch (error) {
          console.warn('MinerU parsing failed, falling back to local parser:', error);
      }
  }

  // 2. 文档处理 (直接在本地解析，不再派发给 Worker)
  try {
      const buffer = await file.arrayBuffer();
      let extractedText = '';

      if (type === 'application/pdf') {
          extractedText = await processPdf(buffer);
      } else if (name.endsWith('.docx')) {
          extractedText = await processDocx(buffer);
      } else if (name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.csv')) {
          extractedText = await processExcel(buffer);
      } else if (name.endsWith('.pptx') || name.endsWith('.ppt')) {
          extractedText = await processPptx(buffer);
      } else {
          // 纯文本回退
          const decoder = new TextDecoder('utf-8');
          extractedText = decoder.decode(buffer);
      }

      if (!extractedText.trim()) {
          throw new Error("解析结果为空，可能是文件已加密或格式不支持");
      }

      return buildDocumentAttachment(id, name, extractedText, true);

  } catch (error: unknown) {
      const err = error as Error;
      console.error("File processing failed:", error);
      throw new Error(`文件解析失败: ${err.message}`);
  }
};
