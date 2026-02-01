import type { ToolDefinition } from "./types.js";

export const webFetchTool: ToolDefinition = {
  name: "web_fetch",
  description:
    "Fetch content from a URL. Returns the text content of the page. Use for documentation, APIs, or reference material.",
  parameters: {
    url: {
      type: "string",
      description: "The URL to fetch",
      required: true,
    },
    extract: {
      type: "string",
      description: "What to extract: 'text' (default), 'html', or 'json'",
      required: false,
    },
  },
  async execute(args) {
    const url = args.url as string;
    const extract = (args.extract as string) || "text";

    try {
      // Validate URL
      const parsedUrl = new URL(url);
      if (!["http:", "https:"].includes(parsedUrl.protocol)) {
        return {
          success: false,
          output: "",
          error: "Only HTTP and HTTPS URLs are supported",
        };
      }

      const response = await fetch(url, {
        headers: {
          "User-Agent": "Kaldi/1.0 (coding assistant)",
          Accept: "text/html,application/json,text/plain,*/*",
        },
        signal: AbortSignal.timeout(30000),
      });

      if (!response.ok) {
        return {
          success: false,
          output: "",
          error: `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      const contentType = response.headers.get("content-type") || "";
      let content: string;

      if (extract === "json" || contentType.includes("application/json")) {
        const json = await response.json();
        content = JSON.stringify(json, null, 2);
      } else if (extract === "html") {
        content = await response.text();
      } else {
        // Extract text from HTML
        const html = await response.text();
        content = htmlToText(html);
      }

      // Truncate if too long
      if (content.length > 50000) {
        content = content.slice(0, 50000) + "\n\n... (truncated)";
      }

      return {
        success: true,
        output: content,
      };
    } catch (error) {
      return {
        success: false,
        output: "",
        error: `Failed to fetch URL: ${error instanceof Error ? error.message : error}`,
      };
    }
  },
};

// Simple HTML to text conversion
function htmlToText(html: string): string {
  // Remove scripts and styles
  let text = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
  text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "");

  // Convert common elements
  text = text.replace(/<br\s*\/?>/gi, "\n");
  text = text.replace(/<\/p>/gi, "\n\n");
  text = text.replace(/<\/div>/gi, "\n");
  text = text.replace(/<\/h[1-6]>/gi, "\n\n");
  text = text.replace(/<li>/gi, "• ");
  text = text.replace(/<\/li>/gi, "\n");

  // Remove all remaining tags
  text = text.replace(/<[^>]+>/g, "");

  // Decode HTML entities
  text = text.replace(/&nbsp;/g, " ");
  text = text.replace(/&amp;/g, "&");
  text = text.replace(/&lt;/g, "<");
  text = text.replace(/&gt;/g, ">");
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");

  // Clean up whitespace
  text = text.replace(/\n\s*\n\s*\n/g, "\n\n");
  text = text.trim();

  return text;
}
