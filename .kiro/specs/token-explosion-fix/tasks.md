# Implementation Plan

- [x] 1. Modify BaseProvider.buildApiMessages to handle all attachment types

  - [x] 1.1 Update buildApiMessages to process text attachments


    - Add logic to extract text attachments (type !== 'image' && included !== false)
    - Concatenate text attachment content after message text using the format: `\n---\nFILE: {name}\nCONTENT:\n{content}\n---`
    - Handle case where message has both text and image attachments


    - _Requirements: 1.1, 1.3, 1.4_

  - [ ] 1.2 Write property test for text attachment concatenation
    - **Property 1: Text attachment concatenation**

    - **Validates: Requirements 1.1**
  - [ ] 1.3 Write property test for excluded attachment filtering
    - **Property 3: Excluded attachment filtering**
    - **Validates: Requirements 1.3**






- [ ] 2. Simplify GeminiProvider.streamChat
  - [ ] 2.1 Remove extractFileContent and injectFileContent calls
    - Delete the line: `const fileContent = this.extractFileContent(attachments);`
    - Delete the line: `this.injectFileContent(apiMessages, fileContent);`


    - Keep the debug logging for payload inspection
    - _Requirements: 3.1, 3.2, 3.3_
  - [x] 2.2 Write property test for no duplicate file content

    - **Property 4: No duplicate file content**





    - **Validates: Requirements 1.4, 2.2, 5.1**



- [x] 3. Simplify OpenAIProvider.streamChat (if applicable)



  - [ ] 3.1 Check if OpenAIProvider has similar extractFileContent/injectFileContent calls and remove them
    - Ensure consistency across all providers
    - _Requirements: 3.1, 3.2, 3.3_

- [ ] 4. Checkpoint - Ensure core logic is correct
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Verify multi-turn conversation behavior
  - [ ] 5.1 Write property test for correct file placement in history
    - **Property 5: Correct file placement in history**
    - **Validates: Requirements 2.1, 2.3, 5.3**
  - [ ] 5.2 Write property test for linear payload growth
    - **Property 8: Linear payload growth**
    - **Validates: Requirements 5.2**

- [ ] 6. Verify state management (manual verification)
  - [ ] 6.1 Document verification steps for state clearing
    - Verify that the calling component (ChatInterface or similar) clears attachments after send
    - This is UI-level behavior that should be verified manually
    - _Requirements: 4.1, 4.2, 4.3_

- [ ] 7. Final Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
