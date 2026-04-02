# Requirements Document

## Introduction

This document specifies the requirements for fixing the Token Explosion Bug in the LLM chat system. The bug causes token consumption to grow exponentially due to improper handling of file attachments across conversation rounds. The fix ensures that file content is properly associated with its originating message and sent exactly once per message, preventing duplicate injection.

## Glossary

- **Token**: A unit of text processed by the LLM, directly affecting API costs
- **Attachment**: A file (text, PDF, image) attached to a message by the user
- **Message**: A single conversation turn containing content and optional attachments
- **BaseProvider**: Abstract class providing shared message-building logic for all LLM providers
- **GeminiProvider**: Concrete provider implementation for Google Gemini models
- **API Message**: The formatted message object sent to the LLM API
- **File Content Injection**: The process of embedding file text content into message content

## Requirements

### Requirement 1

**User Story:** As a user, I want my uploaded files to be correctly associated with the message I sent them with, so that the AI can reference them without causing excessive token usage.

#### Acceptance Criteria

1. WHEN a user sends a message with text file attachments (PDF, DOCX, TXT) THEN the BaseProvider SHALL concatenate the attachment content directly after the message text within that same message object
2. WHEN a user sends a message with image attachments THEN the BaseProvider SHALL include the image data in the message's content parts array
3. WHEN an attachment has `included` set to `false` THEN the BaseProvider SHALL exclude that attachment from the API message
4. WHEN building API messages THEN the BaseProvider SHALL process each message's attachments exactly once within that message's context

### Requirement 2

**User Story:** As a user, I want to have multi-turn conversations with file context, so that the AI remembers my uploaded files without me re-uploading them.

#### Acceptance Criteria

1. WHEN a second conversation turn occurs after a file was uploaded THEN the system SHALL include the file content in the historical message where it was originally attached
2. WHEN multiple conversation turns occur THEN the system SHALL NOT duplicate file content across messages
3. WHEN the API request is built THEN the system SHALL include file content only in the message where the user originally attached it

### Requirement 3

**User Story:** As a developer, I want the provider logic to be simplified, so that there is a single source of truth for file content handling.

#### Acceptance Criteria

1. WHEN GeminiProvider builds a chat request THEN the GeminiProvider SHALL NOT call extractFileContent or injectFileContent methods
2. WHEN any provider builds API messages THEN the provider SHALL rely solely on buildApiMessages for all attachment processing
3. WHEN file content is processed THEN the system SHALL have exactly one code path for text file injection

### Requirement 4

**User Story:** As a user, I want my input attachments to be cleared after sending, so that I don't accidentally send the same files multiple times.

#### Acceptance Criteria

1. WHEN a message with attachments is successfully sent THEN the system SHALL clear the input attachment state
2. WHEN the next message is composed THEN the system SHALL start with an empty attachment list
3. WHEN attachments are cleared THEN the historical messages SHALL retain their original attachments unchanged

### Requirement 5

**User Story:** As a user, I want predictable token usage, so that I can manage my API costs effectively.

#### Acceptance Criteria

1. WHEN a file is attached to a message THEN the system SHALL include that file's content exactly once in the API request
2. WHEN multiple conversation turns occur with the same file THEN the token count for that file SHALL remain constant per turn (not grow exponentially)
3. WHEN the API payload is constructed THEN the system SHALL produce a payload where each file appears only in its originating message
