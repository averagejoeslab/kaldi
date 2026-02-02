/**
 * JSON Export
 */

import type { Session } from "../store.js";
import type { ExportOptions, ExportResult } from "./types.js";

export function exportToJson(
  session: Session,
  options: ExportOptions = {}
): ExportResult {
  const { includeMetadata = true, includeToolCalls = true } = options;

  let data: unknown;

  if (includeMetadata) {
    if (includeToolCalls) {
      data = session;
    } else {
      data = {
        ...session,
        messages: session.messages.map((msg) => ({
          role: msg.role,
          content:
            typeof msg.content === "string"
              ? msg.content
              : msg.content
                  .filter((b) => b.type === "text")
                  .map((b) => (b as { text: string }).text)
                  .join("\n"),
        })),
      };
    }
  } else {
    data = {
      messages: session.messages.map((msg) => ({
        role: msg.role,
        content:
          typeof msg.content === "string"
            ? msg.content
            : includeToolCalls
              ? msg.content
              : msg.content
                  .filter((b) => b.type === "text")
                  .map((b) => (b as { text: string }).text)
                  .join("\n"),
      })),
    };
  }

  return {
    content: JSON.stringify(data, null, 2),
    format: "json",
    filename: `kaldi-${session.metadata.id}.json`,
  };
}
