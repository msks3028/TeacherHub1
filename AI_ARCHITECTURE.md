# AI architecture and current limits

## Existing flow

- Student and teacher requests use the existing Groq-compatible chat completion endpoint.
- Student prompts are bounded; conversation ownership is checked, history sent to the model is capped, and student course/lesson eligibility is checked in the database.
- Student performance facts and teacher course metrics are calculated server-side. The model is instructed not to invent those numbers.
- Teacher results are returned as drafts (`saved: false`); saving remains a teacher action.
- Provider requests have a timeout and errors returned to users are generic.

## Important limitation

There is no PDF/document extraction, cleaning, chunking, embedding, retrieval, or transcript pipeline in this codebase. Material rows point to files; titles and lesson descriptions are metadata, not the file contents. The student assistant now explicitly refuses to claim knowledge of lesson-specific details absent from its context. It can still answer general knowledge questions; those answers are not course-grounded.

Teacher lesson/homework/quiz/revision drafts can use a teacher prompt and limited course metadata, but not retrieved source content. AI summaries/attention/study plans receive deterministic aggregate metrics, not student names or all raw records.

## Next safe implementation step

Before adding extraction/retrieval, define supported MIME types, per-course ownership and student visibility at ingestion and retrieval, text-size/token limits, deletion behavior, and prompt-injection handling. Extract only authorized files, store derived text with provenance, chunk within explicit limits, retrieve only from the selected accessible course, and cite material/lesson names. Do not send original uploads or unrestricted course dumps to the provider. Add mocked provider/API tests and a retrieval authorization matrix before enabling this in production.
