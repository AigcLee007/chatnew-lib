---
name: citation-verifier
description: 适用于需要核查论文观点是否有给定文献支持，或检查参考文献列表中是否存在无法核验条目的学生。
user-invocable: true
disable-model-invocation: true
---

# Citation Verifier

Audit the relationship between claims, in-text citations, and references without fabricating bibliographic details.

## Rules

- Check the supplied source text before judging a claim.
- Never create a missing author, title, year, journal, page, URL, or DOI.
- Mark each result as supported, partially supported, contradicted, or not verifiable.
- Distinguish source errors from citation-style errors.
- Treat paraphrases and translations as requiring the same source support as quotations.

## Output

Return a table with: claim, citation, evidence location, verdict, problem, and recommended revision. Then list uncited claims, unused references, duplicate references, and fields that the student must verify manually. State clearly when a source file or page was not provided.
