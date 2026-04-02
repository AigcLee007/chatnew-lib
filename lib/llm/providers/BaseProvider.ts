/**
 * Base Provider - Abstract base class for LLM providers
 * Contains shared logic for message building and streaming
 */

import { Message, Attachment } from '../../../types';
import {
  ILLMProvider,
  ChatOptions,
  ImageGenerationOptions,
  ApiMessage,
  ContentPart,
  TextContentPart,
} from '../types';
import { buildCoreSystemIdentity } from '../utils';

/**
 * Abstract base class for LLM providers.
 * Provides common functionality for message building.
 */
export abstract class BaseProvider implements ILLMProvider {
  abstract readonly name: string;

  abstract supportsModel(modelId: string): boolean;
  abstract streamChat(options: ChatOptions): Promise<void>;

  generateImage?(options: ImageGenerationOptions): Promise<string>;

  /**
   * Build system context with user prompt and model identity
   */
  protected buildSystemContext(userSystemPrompt: string, modelId?: string): string {
    const now = new Date().toLocaleString('zh-CN', { hour12: false });
    const coreIdentity = buildCoreSystemIdentity(modelId || 'AI-Assistant');

    return `
${coreIdentity}

${userSystemPrompt ? `\n[User Specific Instructions]\n${userSystemPrompt}` : ''}

[System Context]
Current Date & Time: ${now}
Knowledge Cutoff: None (Real-time access enabled)
`.trim();
  }

  /**
   * Extract file content for injection into messages
   */
  protected extractFileContent(attachments: Attachment[]): string {
    let systemInjection = '';
    attachments
      .filter((att) => att.included !== false)
      .forEach((att) => {
        if (att.type !== 'image') {
          systemInjection += `\n---\nFILE: ${att.name}\nCONTENT:\n${att.content}\n---\n`;
        }
      });
    return systemInjection;
  }

  /**
   * Build API messages from application messages
   * Handles ALL attachment types: text files are concatenated, images are added as content parts
   */
  protected buildApiMessages(
    messages: Message[],
    systemContext: string
  ): ApiMessage[] {
    const apiMessages: ApiMessage[] = [{ role: 'system', content: systemContext }];

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
        const contentParts: ContentPart[] = [{ type: 'text', text: textContent || ' ' }];

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

  /**
   * Inject file content into the last user message
   */
  protected injectFileContent(apiMessages: ApiMessage[], fileContent: string): void {
    if (!fileContent) return;

    let lastUserIdx = -1;
    for (let i = apiMessages.length - 1; i >= 0; i--) {
      if (apiMessages[i].role === 'user') {
        lastUserIdx = i;
        break;
      }
    }

    if (lastUserIdx !== -1) {
      const originalContent = apiMessages[lastUserIdx].content;
      if (Array.isArray(originalContent)) {
        const textPart = originalContent.find((p): p is TextContentPart => p.type === 'text');
        if (textPart) {
          textPart.text = `${fileContent}\n\n${textPart.text}`;
        } else {
          originalContent.unshift({ type: 'text', text: fileContent });
        }
      } else {
        apiMessages[lastUserIdx].content = `${fileContent}\n\n${originalContent}`;
      }
    }
  }
}
