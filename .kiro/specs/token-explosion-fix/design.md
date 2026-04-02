# Design Document: Token Explosion Fix

## Overview

This design addresses the Token Explosion Bug where file attachments are incorrectly handled across conversation turns, causing exponential token growth. The fix consolidates all attachment processing into `buildApiMessages`, ensuring each file appears exactly once in its originating message.

## Architecture

The fix follows a single-responsibility principle where `BaseProvider.buildApiMessages()` becomes the sole handler for all attachment types:

```
┌─────────────────────────────────────────────────────────────────┐
│                        Before (Buggy)                           │
├─────────────────────────────────────────────────────────────────┤
│  messages[] ──► buildApiMessages() ──► apiMessages[]            │
│       │              (images only)           │                  │
│       │                                      │                  │
│  attachments[] ──► extractFileContent() ──► injectFileContent() │
│  (current only)         (text files)        (duplicate!)        │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                        After (Fixed)                            │
├─────────────────────────────────────────────────────────────────┤
│  messages[] ──► buildApiMessages() ──► apiMessages[]            │
│  (with attachments)  (ALL types)      (complete, no duplicates) │
└─────────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. BaseProvider.buildApiMessages() - Modified

**Current Signature (unchanged):**
```typescript
protected buildApiMessages(
  messages: Message[],
  systemContext: string
): ApiMessage[]
```

**New Behavior:**
- Process ALL attachment types (text AND image) within each message
- For text attachments: concatenate content after message text
- For image attachments: add to content parts array (existing behavior)
- Filter out attachments where `included === false`

**Processing Logic:**
```typescript
for each message in messages:
  textAttachments = message.attachments.filter(a => a.type !== 'image' && a.included !== false)
  imageAttachments = message.attachments.filter(a => a.type === 'image' && a.included !== false)
  
  if (hasImageAttachments):
    // Build multimodal content parts
    contentParts = [{ type: 'text', text: messageText + textFileContent }]
    for each image:
      contentParts.push({ type: 'image_url', image_url: { url: image.content } })
    apiMessage.content = contentParts
  else if (hasTextAttachments):
    // Simple string concatenation
    apiMessage.content = messageText + textFileContent
  else:
    // No attachments
    apiMessage.content = messageText
```

### 2. GeminiProvider.streamChat() - Simplified

**Changes:**
- Remove call to `this.extractFileContent(attachments)`
- Remove call to `this.injectFileContent(apiMessages, fileContent)`
- The `attachments` parameter in `ChatOptions` becomes unused for text processing

### 3. OpenAIProvider.streamChat() - Simplified (if applicable)

Same changes as GeminiProvider for consistency.

### 4. State Management - useLLMStream.ts

**Ensure:**
- The `messages` array passed to `streamChatCompletion` includes the current user message with its attachments
- After successful send, the calling component clears the input attachment state

## Data Models

### Message with Attachments (unchanged)
```typescript
interface Message {
  id: string;
  sessionId: string;
  role: Role;
  content: string;
  timestamp: number;
  attachments?: Attachment[];  // Persisted with the message
  model?: ModelId;
}
```

### Attachment (unchanged)
```typescript
interface Attachment {
  id: string;
  name: string;
  type: string;           // 'image' | 'text' | 'pdf' | etc.
  content: string;        // Base64 for images, extracted text for documents
  included?: boolean;     // false = exclude from API
}
```

### ApiMessage Output Examples

**User message with text file:**
```json
{
  "role": "user",
  "content": "Please analyze this file.\n\n---\nFILE: report.pdf\nCONTENT:\n[extracted text here]\n---"
}
```

**User message with image:**
```json
{
  "role": "user",
  "content": [
    { "type": "text", "text": "What's in this image?" },
    { "type": "image_url", "image_url": { "url": "data:image/png;base64,..." } }
  ]
}
```

**User message with both text file and image:**
```json
{
  "role": "user",
  "content": [
    { "type": "text", "text": "Compare this document with the image.\n\n---\nFILE: doc.txt\nCONTENT:\n[text]\n---" },
    { "type": "image_url", "image_url": { "url": "data:image/png;base64,..." } }
  ]
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Text attachment concatenation
*For any* message with text attachments (type !== 'image') where included !== false, the resulting API message content SHALL contain the attachment's content concatenated after the original message text.
**Validates: Requirements 1.1**

### Property 2: Image attachment inclusion
*For any* message with image attachments where included !== false, the resulting API message content SHALL be an array containing the image data in an image_url content part.
**Validates: Requirements 1.2**

### Property 3: Excluded attachment filtering
*For any* attachment with included === false, the resulting API message SHALL NOT contain that attachment's content.
**Validates: Requirements 1.3**

### Property 4: No duplicate file content
*For any* conversation with N messages where M messages have attachments, the total occurrences of each unique attachment content in the full API payload SHALL equal exactly 1 (appearing only in its originating message).
**Validates: Requirements 1.4, 2.2, 5.1**

### Property 5: Correct file placement in history
*For any* multi-turn conversation, when building API messages, each attachment's content SHALL appear within the API message corresponding to the original message where it was attached, not in any other message.
**Validates: Requirements 2.1, 2.3, 5.3**

### Property 6: State clearing after send
*For any* successful message send operation, the input attachment state SHALL be empty immediately after the operation completes.
**Validates: Requirements 4.1, 4.2**

### Property 7: Historical message immutability
*For any* state clearing operation, the attachments stored in historical messages SHALL remain unchanged.
**Validates: Requirements 4.3**

### Property 8: Linear payload growth
*For any* sequence of N conversation turns with the same file attached in turn 1, the API payload size SHALL grow linearly with N (proportional to new message content), not exponentially.
**Validates: Requirements 5.2**

## Error Handling

1. **Missing attachment content**: If `attachment.content` is undefined or empty, skip that attachment silently (don't crash)
2. **Invalid image format**: If image doesn't start with `data:image`, skip it with a console warning
3. **Empty messages array**: Return only the system message

## Testing Strategy

### Unit Tests
- Test `buildApiMessages` with various attachment combinations
- Test filtering of `included === false` attachments
- Test edge cases: empty attachments, missing content, mixed types

### Property-Based Tests

The following properties will be tested using a property-based testing library (e.g., fast-check):

1. **Property 1 (Text concatenation)**: Generate random messages with text attachments, verify content appears in output
2. **Property 3 (Filtering)**: Generate attachments with random `included` values, verify filtering works
3. **Property 4 (No duplicates)**: Generate multi-message conversations, count attachment occurrences
4. **Property 8 (Linear growth)**: Generate N-turn conversations, measure payload size growth

Each property-based test MUST:
- Run a minimum of 100 iterations
- Be tagged with a comment referencing the correctness property: `**Feature: token-explosion-fix, Property {number}: {property_text}**`
