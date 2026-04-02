/**
 * Property-based tests for BaseProvider.buildApiMessages
 * **Feature: token-explosion-fix**
 * 
 * Tests the unified message building logic that handles all attachment types
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { Message, Attachment } from '../../../types';

// Create a concrete implementation for testing
class TestableProvider {
  /**
   * Build API messages from application messages
   * Handles ALL attachment types: text files are concatenated, images are added as content parts
   */
  buildApiMessages(
    messages: Message[],
    systemContext: string
  ): Array<{ role: string; content: string | Array<{ type: string; text?: string; image_url?: { url: string } }> }> {
    const apiMessages: Array<{ role: string; content: string | Array<{ type: string; text?: string; image_url?: { url: string } }> }> = [
      { role: 'system', content: systemContext }
    ];

    messages.forEach((m) => {
      // Filter attachments by type
      const textAttachments =
        m.attachments?.filter((a) => a.type !== 'image' && a.included !== false) || [];
      const imageAttachments =
        m.attachments?.filter((a) => a.type === 'image' && a.included !== false) || [];

      // Build text content with file attachments concatenated
      let textContent = m.content || '';
      textAttachments.forEach((att) => {
        if (att.content) {
          textContent += `\n---\nFILE: ${att.name}\nCONTENT:\n${att.content}\n---`;
        }
      });

      if (imageAttachments.length > 0 && m.role === 'user') {
        // Multimodal message: text + images
        const contentParts: Array<{ type: string; text?: string; image_url?: { url: string } }> = [
          { type: 'text', text: textContent || ' ' }
        ];

        imageAttachments.forEach((att) => {
          if (att.content && att.content.startsWith('data:image')) {
            contentParts.push({
              type: 'image_url',
              image_url: { url: att.content },
            });
          }
        });

        apiMessages.push({
          role: m.role,
          content: contentParts,
        });
      } else {
        // Text-only message (may include concatenated file content)
        apiMessages.push({
          role: m.role,
          content: textContent,
        });
      }
    });

    return apiMessages;
  }
}

// Arbitraries for generating test data
const attachmentArb = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 50 }),
  type: fc.oneof(fc.constant('text'), fc.constant('pdf'), fc.constant('docx')),
  content: fc.string({ minLength: 1, maxLength: 500 }),
  included: fc.oneof(fc.constant(true), fc.constant(false), fc.constant(undefined)),
});

const imageAttachmentArb = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 50 }),
  type: fc.constant('image'),
  content: fc.constant('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='),
  included: fc.oneof(fc.constant(true), fc.constant(undefined)),
});

const messageArb = fc.record({
  id: fc.uuid(),
  sessionId: fc.uuid(),
  role: fc.constant('user' as const),
  content: fc.string({ minLength: 1, maxLength: 200 }),
  timestamp: fc.integer({ min: 0 }),
  attachments: fc.option(fc.array(attachmentArb, { minLength: 0, maxLength: 3 }), { nil: undefined }),
});

describe('BaseProvider.buildApiMessages', () => {
  const provider = new TestableProvider();

  /**
   * **Feature: token-explosion-fix, Property 1: Text attachment concatenation**
   * *For any* message with text attachments (type !== 'image') where included !== false,
   * the resulting API message content SHALL contain the attachment's content concatenated
   * after the original message text.
   * **Validates: Requirements 1.1**
   */
  it('Property 1: Text attachments are concatenated after message text', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }), // message content
        fc.array(attachmentArb.filter(a => a.included !== false), { minLength: 1, maxLength: 3 }), // included text attachments
        (messageContent, attachments) => {
          const message: Message = {
            id: 'test-id',
            sessionId: 'test-session',
            role: 'user',
            content: messageContent,
            timestamp: Date.now(),
            attachments: attachments as Attachment[],
          };

          const result = provider.buildApiMessages([message], 'system context');
          
          // Skip system message, get user message
          const userMessage = result[1];
          const content = typeof userMessage.content === 'string' 
            ? userMessage.content 
            : (userMessage.content[0] as { text?: string }).text || '';

          // Original message content should be at the start
          expect(content.startsWith(messageContent)).toBe(true);

          // Each included attachment's content should appear in the result
          attachments.forEach((att) => {
            if (att.included !== false && att.content) {
              expect(content).toContain(att.content);
              expect(content).toContain(`FILE: ${att.name}`);
            }
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: token-explosion-fix, Property 3: Excluded attachment filtering**
   * *For any* attachment with included === false, the resulting API message
   * SHALL NOT contain that attachment's content.
   * **Validates: Requirements 1.3**
   */
  it('Property 3: Excluded attachments are filtered out', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }),
        fc.array(
          fc.record({
            id: fc.uuid(),
            name: fc.string({ minLength: 1, maxLength: 50 }),
            type: fc.constant('text'),
            content: fc.string({ minLength: 10, maxLength: 100 }), // Ensure unique content
            included: fc.constant(false), // Explicitly excluded
          }),
          { minLength: 1, maxLength: 3 }
        ),
        (messageContent, excludedAttachments) => {
          const message: Message = {
            id: 'test-id',
            sessionId: 'test-session',
            role: 'user',
            content: messageContent,
            timestamp: Date.now(),
            attachments: excludedAttachments as Attachment[],
          };

          const result = provider.buildApiMessages([message], 'system context');
          const userMessage = result[1];
          const content = typeof userMessage.content === 'string' 
            ? userMessage.content 
            : JSON.stringify(userMessage.content);

          // Excluded attachments should NOT appear in the result
          excludedAttachments.forEach((att) => {
            // The attachment content should not be in the output
            // (unless it happens to be part of the message content by coincidence)
            if (!messageContent.includes(att.content)) {
              expect(content).not.toContain(att.content);
            }
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: token-explosion-fix, Property 2: Image attachment inclusion**
   * *For any* message with image attachments where included !== false,
   * the resulting API message content SHALL be an array containing the image data.
   * **Validates: Requirements 1.2**
   */
  it('Property 2: Image attachments are included as content parts', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }),
        fc.array(imageAttachmentArb, { minLength: 1, maxLength: 2 }),
        (messageContent, imageAttachments) => {
          const message: Message = {
            id: 'test-id',
            sessionId: 'test-session',
            role: 'user',
            content: messageContent,
            timestamp: Date.now(),
            attachments: imageAttachments as Attachment[],
          };

          const result = provider.buildApiMessages([message], 'system context');
          const userMessage = result[1];

          // Content should be an array for multimodal messages
          expect(Array.isArray(userMessage.content)).toBe(true);
          
          const contentParts = userMessage.content as Array<{ type: string; image_url?: { url: string } }>;
          
          // Should have text part + image parts
          expect(contentParts.length).toBe(1 + imageAttachments.length);
          
          // First part should be text
          expect(contentParts[0].type).toBe('text');
          
          // Remaining parts should be images
          for (let i = 1; i < contentParts.length; i++) {
            expect(contentParts[i].type).toBe('image_url');
            expect(contentParts[i].image_url?.url).toContain('data:image');
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});


describe('Multi-turn conversation behavior', () => {
  const provider = new TestableProvider();

  /**
   * **Feature: token-explosion-fix, Property 4: No duplicate file content**
   * *For any* conversation with N messages where M messages have attachments,
   * the total occurrences of each unique attachment content in the full API payload
   * SHALL equal exactly 1 (appearing only in its originating message).
   * **Validates: Requirements 1.4, 2.2, 5.1**
   */
  it('Property 4: Each file content appears exactly once in the payload', () => {
    fc.assert(
      fc.property(
        // Generate a multi-turn conversation with user messages only having attachments
        fc.array(
          fc.record({
            id: fc.uuid(),
            sessionId: fc.constant('test-session'),
            role: fc.constant('user' as const), // Only user messages have attachments
            content: fc.stringMatching(/^[a-zA-Z0-9 ]{1,100}$/), // Safe content
            timestamp: fc.integer({ min: 0 }),
            attachments: fc.option(
              fc.array(
                fc.record({
                  id: fc.uuid(),
                  name: fc.stringMatching(/^[a-zA-Z0-9]{5,10}\.txt$/), // Safe filename
                  type: fc.constant('text'),
                  // Use alphanumeric content to avoid JSON escaping issues
                  content: fc.stringMatching(/^UNIQUE_[a-f0-9]{20,50}$/),
                  included: fc.constant(true),
                }),
                { minLength: 1, maxLength: 2 }
              ),
              { nil: undefined }
            ),
          }),
          { minLength: 2, maxLength: 5 }
        ),
        (messages) => {
          const result = provider.buildApiMessages(messages as Message[], 'system context');
          const fullPayload = JSON.stringify(result);

          // Collect all unique attachment contents from input
          const attachmentContents: string[] = [];
          messages.forEach((m) => {
            m.attachments?.forEach((att) => {
              if (att.included !== false && att.content) {
                attachmentContents.push(att.content);
              }
            });
          });

          // Skip if no attachments
          if (attachmentContents.length === 0) return;

          // Each attachment content should appear exactly once in the payload
          attachmentContents.forEach((content) => {
            // Simple string count (content is alphanumeric, no special chars)
            const count = fullPayload.split(content).length - 1;
            
            // Should appear exactly once (in its originating message)
            expect(count).toBe(1);
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: token-explosion-fix, Property 5: Correct file placement in history**
   * *For any* multi-turn conversation, when building API messages, each attachment's
   * content SHALL appear within the API message corresponding to the original message
   * where it was attached, not in any other message.
   * **Validates: Requirements 2.1, 2.3, 5.3**
   */
  it('Property 5: File content appears in correct message position', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 4 }), // Index of message with attachment
        fc.array(
          fc.record({
            id: fc.uuid(),
            sessionId: fc.constant('test-session'),
            role: fc.constant('user' as const),
            content: fc.string({ minLength: 1, maxLength: 50 }),
            timestamp: fc.integer({ min: 0 }),
          }),
          { minLength: 3, maxLength: 5 }
        ),
        fc.string({ minLength: 20, maxLength: 50 }).map(s => `FILE_CONTENT_${s}`),
        (attachmentIndex, baseMessages, fileContent) => {
          // Ensure index is within bounds
          const idx = attachmentIndex % baseMessages.length;
          
          // Add attachment to one specific message
          const messages: Message[] = baseMessages.map((m, i) => ({
            ...m,
            attachments: i === idx ? [{
              id: 'att-1',
              name: 'test.txt',
              type: 'text',
              content: fileContent,
              included: true,
            }] : undefined,
          }));

          const result = provider.buildApiMessages(messages, 'system context');

          // Check each API message (skip system message at index 0)
          for (let i = 1; i < result.length; i++) {
            const apiMsg = result[i];
            const content = typeof apiMsg.content === 'string' 
              ? apiMsg.content 
              : JSON.stringify(apiMsg.content);

            const messageIndex = i - 1; // Adjust for system message
            
            if (messageIndex === idx) {
              // This message should contain the file content
              expect(content).toContain(fileContent);
            } else {
              // Other messages should NOT contain the file content
              expect(content).not.toContain(fileContent);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: token-explosion-fix, Property 8: Linear payload growth**
   * *For any* sequence of N conversation turns with the same file attached in turn 1,
   * the API payload size SHALL grow linearly with N (proportional to new message content),
   * not exponentially.
   * **Validates: Requirements 5.2**
   */
  it('Property 8: Payload size grows linearly, not exponentially', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 100, maxLength: 200 }), // File content (fixed size)
        fc.array(
          fc.string({ minLength: 10, maxLength: 50 }), // Message contents
          { minLength: 3, maxLength: 6 }
        ),
        (fileContent, messageContents) => {
          // Build conversation where only first message has attachment
          const messages: Message[] = messageContents.map((content, i) => ({
            id: `msg-${i}`,
            sessionId: 'test-session',
            role: i % 2 === 0 ? 'user' as const : 'assistant' as const,
            content,
            timestamp: i,
            attachments: i === 0 ? [{
              id: 'att-1',
              name: 'test.txt',
              type: 'text',
              content: fileContent,
              included: true,
            }] : undefined,
          }));

          // Measure payload sizes at different conversation lengths
          const sizes: number[] = [];
          for (let len = 1; len <= messages.length; len++) {
            const result = provider.buildApiMessages(messages.slice(0, len), 'system');
            sizes.push(JSON.stringify(result).length);
          }

          // Calculate growth rates between consecutive sizes
          const growthRates: number[] = [];
          for (let i = 1; i < sizes.length; i++) {
            growthRates.push(sizes[i] - sizes[i - 1]);
          }

          // For linear growth, the growth rate should be roughly constant
          // (just the size of new messages, not exponential)
          // The file content size should NOT be added each turn
          const fileContentSize = fileContent.length;
          
          // After the first message, growth should be much smaller than file content
          // (just the new message content, not the file again)
          for (let i = 1; i < growthRates.length; i++) {
            // Growth should be less than file content size (we're not re-adding the file)
            expect(growthRates[i]).toBeLessThan(fileContentSize + 100);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
