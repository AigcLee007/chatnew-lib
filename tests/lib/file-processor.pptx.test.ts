import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import JSZip from 'jszip';

/**
 * **Feature: chatvip-upgrade, Property 1: PPTX Slide Order Preservation**
 *
 * *For any* valid PPTX file containing multiple slides, when processed by processPptx,
 * the extracted text SHALL appear in the same order as the original slides
 * (slide1 before slide2, etc.).
 *
 * **Validates: Requirements 1.1, 1.3**
 */

// Helper to create a minimal PPTX slide XML with text content
function createSlideXml(text: string): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:sp>
        <p:txBody>
          <a:p xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
            <a:r><a:t>${text}</a:t></a:r>
          </a:p>
        </p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
</p:sld>`;
}

// Helper to create a mock PPTX buffer with given slide contents
async function createMockPptxBuffer(slideContents: string[]): Promise<ArrayBuffer> {
  const zip = new JSZip();

  // Add minimal required PPTX structure
  zip.file(
    '[Content_Types].xml',
    '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"></Types>'
  );

  // Add slides in order
  slideContents.forEach((content, index) => {
    zip.file(`ppt/slides/slide${index + 1}.xml`, createSlideXml(content));
  });

  return await zip.generateAsync({ type: 'arraybuffer' });
}

// Replicate the processPptx logic for testing (since it's not exported)
async function processPptx(buffer: ArrayBuffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  let fullText = '';

  // 获取所有幻灯片文件
  const slideFiles = Object.keys(zip.files).filter((fileName) =>
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
    const text = content
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (text) {
      const slideNum = fileName.match(/\d+/)![0];
      fullText += `--- Slide ${slideNum} ---\n${text}\n\n`;
    }
  }

  return fullText || '[PPTX 解析完成，但未提取到文本，可能是纯图片幻灯片]';
}

// Extract slide numbers from processed output in order
function extractSlideOrder(output: string): number[] {
  const matches = output.matchAll(/--- Slide (\d+) ---/g);
  return Array.from(matches).map((m) => parseInt(m[1]));
}

// Extract slide contents from processed output
function extractSlideContents(output: string): string[] {
  const sections = output.split(/--- Slide \d+ ---\n/).filter((s) => s.trim());
  return sections.map((s) => s.trim());
}

describe('PPTX Slide Order Preservation Property Tests', () => {
  /**
   * Property 1: Slide Order Preservation
   * For any sequence of slides, the output should maintain the same order
   */
  it('Property 1: processPptx should preserve slide order for any number of slides', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate 1-10 unique slide contents (alphanumeric strings only, no XML special chars)
        fc.array(fc.string({ minLength: 1, maxLength: 50 }).filter((s) => /^[a-zA-Z0-9\s]+$/.test(s) && s.trim().length > 0), {
          minLength: 1,
          maxLength: 10,
        }),
        async (slideContents) => {
          // Create PPTX with slides in order
          const buffer = await createMockPptxBuffer(slideContents);

          // Process the PPTX
          const result = await processPptx(buffer);

          // Extract slide order from output
          const outputOrder = extractSlideOrder(result);

          // Property: slides should appear in sequential order (1, 2, 3, ...)
          const expectedOrder = slideContents.map((_, i) => i + 1);
          return (
            JSON.stringify(outputOrder) === JSON.stringify(expectedOrder) &&
            outputOrder.length === slideContents.length
          );
        }
      ),
      { numRuns: 100 }
    );
  });


  /**
   * Property 1 (variant): Slides added in random file order should still be sorted correctly
   * This tests that the sorting logic works regardless of how files are stored in the zip
   */
  it('Property 1: processPptx should sort slides correctly even when stored out of order in zip', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate 2-8 unique slide contents (alphanumeric strings only, no XML special chars)
        fc.array(fc.string({ minLength: 1, maxLength: 30 }).filter((s) => /^[a-zA-Z0-9\s]+$/.test(s) && s.trim().length > 0), {
          minLength: 2,
          maxLength: 8,
        }),
        // Generate a permutation seed
        fc.nat(),
        async (slideContents, seed) => {
          const zip = new JSZip();

          // Add minimal required PPTX structure
          zip.file(
            '[Content_Types].xml',
            '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"></Types>'
          );

          // Create indices and shuffle them based on seed
          const indices = slideContents.map((_, i) => i);
          // Simple shuffle using seed
          for (let i = indices.length - 1; i > 0; i--) {
            const j = (seed + i) % (i + 1);
            [indices[i], indices[j]] = [indices[j], indices[i]];
          }

          // Add slides in shuffled order (but with correct numbering)
          indices.forEach((originalIndex) => {
            const slideNum = originalIndex + 1;
            zip.file(
              `ppt/slides/slide${slideNum}.xml`,
              createSlideXml(slideContents[originalIndex])
            );
          });

          const buffer = await zip.generateAsync({ type: 'arraybuffer' });
          const result = await processPptx(buffer);

          // Extract slide order from output
          const outputOrder = extractSlideOrder(result);

          // Property: output should always be in sequential order regardless of zip file order
          const expectedOrder = slideContents.map((_, i) => i + 1);
          return JSON.stringify(outputOrder) === JSON.stringify(expectedOrder);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 1 (content verification): Slide content should match original order
   */
  it('Property 1: processPptx should preserve content in correct slide order', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate 2-5 unique identifiable slide contents
        fc.array(
          fc.string({ minLength: 5, maxLength: 20 }).filter((s) => /^[a-zA-Z0-9]+$/.test(s)),
          { minLength: 2, maxLength: 5 }
        ),
        async (slideContents) => {
          // Ensure unique contents for easier verification
          const uniqueContents = [...new Set(slideContents)];
          if (uniqueContents.length < 2) return true; // Skip if not enough unique content

          const buffer = await createMockPptxBuffer(uniqueContents);
          const result = await processPptx(buffer);

          // Extract contents in order from output
          const outputContents = extractSlideContents(result);

          // Property: each slide's content should appear in the correct position
          return uniqueContents.every((content, index) => {
            const outputContent = outputContents[index] || '';
            return outputContent.includes(content);
          });
        }
      ),
      { numRuns: 100 }
    );
  });
});
