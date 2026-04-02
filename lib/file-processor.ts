import { Attachment } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { countTokens } from './token';

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

      return {
          id,
          name,
          type: 'text',
          content: `[System: Context from file "${name}"]\n\n${extractedText}\n`,
          tokenCount: countTokens(extractedText)
      };

  } catch (error: unknown) {
      const err = error as Error;
      console.error("File processing failed:", error);
      throw new Error(`文件解析失败: ${err.message}`);
  }
};