/**
 * Syntax Highlighting for Code Blocks
 *
 * Provides syntax highlighting for code in responses.
 * Uses simple regex-based highlighting for common languages.
 */

import chalk from "chalk";

// ============================================================================
// TYPES
// ============================================================================

export interface HighlightTheme {
  keyword: (text: string) => string;
  string: (text: string) => string;
  number: (text: string) => string;
  comment: (text: string) => string;
  function: (text: string) => string;
  type: (text: string) => string;
  operator: (text: string) => string;
  punctuation: (text: string) => string;
  variable: (text: string) => string;
  constant: (text: string) => string;
  tag: (text: string) => string;
  attribute: (text: string) => string;
  plain: (text: string) => string;
}

export interface LanguageRules {
  keywords?: string[];
  types?: string[];
  constants?: string[];
  stringPatterns?: RegExp[];
  commentPatterns?: RegExp[];
  numberPattern?: RegExp;
  functionPattern?: RegExp;
  operatorPattern?: RegExp;
}

// ============================================================================
// THEMES
// ============================================================================

const coffeeTheme: HighlightTheme = {
  keyword: chalk.hex("#E5A54B"),     // Golden honey
  string: chalk.hex("#7CB342"),      // Green
  number: chalk.hex("#C9A66B"),      // Latte
  comment: chalk.hex("#6B5B4F"),     // Dark taupe
  function: chalk.hex("#87CEEB"),    // Sky blue
  type: chalk.hex("#DAA520"),        // Golden
  operator: chalk.hex("#E8DCC8"),    // Cream
  punctuation: chalk.hex("#A09080"), // Muted
  variable: chalk.hex("#F5F0E6"),    // Cream
  constant: chalk.hex("#CD5C5C"),    // Indian red
  tag: chalk.hex("#E5A54B"),         // Golden
  attribute: chalk.hex("#87CEEB"),   // Blue
  plain: chalk.hex("#E8DCC8"),       // Cream
};

const defaultTheme = coffeeTheme;

// ============================================================================
// LANGUAGE DEFINITIONS
// ============================================================================

const languages: Record<string, LanguageRules> = {
  javascript: {
    keywords: [
      "async", "await", "break", "case", "catch", "class", "const", "continue",
      "debugger", "default", "delete", "do", "else", "export", "extends", "finally",
      "for", "function", "if", "import", "in", "instanceof", "let", "new", "of",
      "return", "static", "super", "switch", "this", "throw", "try", "typeof",
      "var", "void", "while", "with", "yield", "from", "as",
    ],
    types: ["string", "number", "boolean", "object", "symbol", "undefined", "null", "any", "void", "never"],
    constants: ["true", "false", "null", "undefined", "NaN", "Infinity"],
    stringPatterns: [
      /`[^`]*`/g,          // Template strings
      /"(?:[^"\\]|\\.)*"/g, // Double quotes
      /'(?:[^'\\]|\\.)*'/g, // Single quotes
    ],
    commentPatterns: [
      /\/\/.*$/gm,         // Single line
      /\/\*[\s\S]*?\*\//g, // Multi line
    ],
    numberPattern: /\b\d+\.?\d*\b/g,
    functionPattern: /\b([a-zA-Z_$][\w$]*)\s*(?=\()/g,
    operatorPattern: /[+\-*/%=<>!&|^~?:]+/g,
  },

  typescript: {
    keywords: [
      "async", "await", "break", "case", "catch", "class", "const", "continue",
      "debugger", "default", "delete", "do", "else", "export", "extends", "finally",
      "for", "function", "if", "import", "in", "instanceof", "let", "new", "of",
      "return", "static", "super", "switch", "this", "throw", "try", "typeof",
      "var", "void", "while", "with", "yield", "from", "as", "implements",
      "interface", "type", "namespace", "abstract", "declare", "enum", "readonly",
      "private", "protected", "public", "override", "satisfies",
    ],
    types: [
      "string", "number", "boolean", "object", "symbol", "undefined", "null",
      "any", "void", "never", "unknown", "bigint",
    ],
    constants: ["true", "false", "null", "undefined", "NaN", "Infinity"],
    stringPatterns: [
      /`[^`]*`/g,
      /"(?:[^"\\]|\\.)*"/g,
      /'(?:[^'\\]|\\.)*'/g,
    ],
    commentPatterns: [
      /\/\/.*$/gm,
      /\/\*[\s\S]*?\*\//g,
    ],
    numberPattern: /\b\d+\.?\d*\b/g,
    functionPattern: /\b([a-zA-Z_$][\w$]*)\s*(?=\()/g,
    operatorPattern: /[+\-*/%=<>!&|^~?:]+/g,
  },

  python: {
    keywords: [
      "and", "as", "assert", "async", "await", "break", "class", "continue",
      "def", "del", "elif", "else", "except", "finally", "for", "from", "global",
      "if", "import", "in", "is", "lambda", "nonlocal", "not", "or", "pass",
      "raise", "return", "try", "while", "with", "yield", "match", "case",
    ],
    types: ["int", "float", "str", "bool", "list", "dict", "set", "tuple", "None"],
    constants: ["True", "False", "None"],
    stringPatterns: [
      /"""[\s\S]*?"""/g,   // Triple double quotes
      /'''[\s\S]*?'''/g,   // Triple single quotes
      /"(?:[^"\\]|\\.)*"/g,
      /'(?:[^'\\]|\\.)*'/g,
      /f"(?:[^"\\]|\\.)*"/g, // f-strings
      /f'(?:[^'\\]|\\.)*'/g,
    ],
    commentPatterns: [
      /#.*$/gm,
    ],
    numberPattern: /\b\d+\.?\d*\b/g,
    functionPattern: /\b([a-zA-Z_][\w]*)\s*(?=\()/g,
    operatorPattern: /[+\-*/%=<>!&|^~@]+/g,
  },

  rust: {
    keywords: [
      "as", "async", "await", "break", "const", "continue", "crate", "dyn",
      "else", "enum", "extern", "false", "fn", "for", "if", "impl", "in",
      "let", "loop", "match", "mod", "move", "mut", "pub", "ref", "return",
      "self", "Self", "static", "struct", "super", "trait", "true", "type",
      "unsafe", "use", "where", "while",
    ],
    types: [
      "i8", "i16", "i32", "i64", "i128", "isize",
      "u8", "u16", "u32", "u64", "u128", "usize",
      "f32", "f64", "bool", "char", "str", "String",
      "Vec", "Option", "Result", "Box", "Rc", "Arc",
    ],
    constants: ["true", "false", "None", "Some", "Ok", "Err"],
    stringPatterns: [
      /"(?:[^"\\]|\\.)*"/g,
      /r#*"[\s\S]*?"#*/g,  // Raw strings
    ],
    commentPatterns: [
      /\/\/.*$/gm,
      /\/\*[\s\S]*?\*\//g,
    ],
    numberPattern: /\b\d+\.?\d*(?:_\d+)*\b/g,
    functionPattern: /\b([a-zA-Z_][\w]*)\s*(?=\()/g,
    operatorPattern: /[+\-*/%=<>!&|^~?:]+/g,
  },

  go: {
    keywords: [
      "break", "case", "chan", "const", "continue", "default", "defer", "else",
      "fallthrough", "for", "func", "go", "goto", "if", "import", "interface",
      "map", "package", "range", "return", "select", "struct", "switch", "type",
      "var",
    ],
    types: [
      "bool", "byte", "complex64", "complex128", "error", "float32", "float64",
      "int", "int8", "int16", "int32", "int64", "rune", "string",
      "uint", "uint8", "uint16", "uint32", "uint64", "uintptr",
    ],
    constants: ["true", "false", "nil", "iota"],
    stringPatterns: [
      /`[^`]*`/g,
      /"(?:[^"\\]|\\.)*"/g,
    ],
    commentPatterns: [
      /\/\/.*$/gm,
      /\/\*[\s\S]*?\*\//g,
    ],
    numberPattern: /\b\d+\.?\d*\b/g,
    functionPattern: /\b([a-zA-Z_][\w]*)\s*(?=\()/g,
    operatorPattern: /[+\-*/%=<>!&|^~:]+/g,
  },

  bash: {
    keywords: [
      "if", "then", "else", "elif", "fi", "case", "esac", "for", "while", "until",
      "do", "done", "in", "function", "select", "time", "coproc", "return", "exit",
      "break", "continue", "declare", "local", "export", "readonly", "unset",
    ],
    constants: ["true", "false"],
    stringPatterns: [
      /"(?:[^"\\]|\\.)*"/g,
      /'[^']*'/g,
    ],
    commentPatterns: [
      /#.*$/gm,
    ],
    numberPattern: /\b\d+\b/g,
    functionPattern: /\b([a-zA-Z_][\w]*)\s*\(\)/g,
    operatorPattern: /[|&;<>]+/g,
  },

  json: {
    stringPatterns: [
      /"(?:[^"\\]|\\.)*"/g,
    ],
    numberPattern: /-?\b\d+\.?\d*(?:[eE][+-]?\d+)?\b/g,
    constants: ["true", "false", "null"],
  },

  yaml: {
    stringPatterns: [
      /"(?:[^"\\]|\\.)*"/g,
      /'(?:[^'\\]|\\.)*'/g,
    ],
    commentPatterns: [
      /#.*$/gm,
    ],
    numberPattern: /\b\d+\.?\d*\b/g,
    constants: ["true", "false", "null", "yes", "no"],
  },

  html: {
    stringPatterns: [
      /"[^"]*"/g,
      /'[^']*'/g,
    ],
    commentPatterns: [
      /<!--[\s\S]*?-->/g,
    ],
  },

  css: {
    keywords: [
      "import", "media", "keyframes", "font-face", "supports", "page",
    ],
    stringPatterns: [
      /"[^"]*"/g,
      /'[^']*'/g,
    ],
    commentPatterns: [
      /\/\*[\s\S]*?\*\//g,
    ],
    numberPattern: /\b\d+\.?\d*(px|em|rem|%|vh|vw|deg|s|ms)?\b/g,
  },

  sql: {
    keywords: [
      "SELECT", "FROM", "WHERE", "INSERT", "UPDATE", "DELETE", "CREATE", "DROP",
      "ALTER", "TABLE", "INDEX", "VIEW", "INTO", "VALUES", "SET", "AND", "OR",
      "NOT", "NULL", "IS", "IN", "BETWEEN", "LIKE", "ORDER", "BY", "ASC", "DESC",
      "GROUP", "HAVING", "JOIN", "LEFT", "RIGHT", "INNER", "OUTER", "ON", "AS",
      "DISTINCT", "LIMIT", "OFFSET", "UNION", "ALL", "EXISTS", "CASE", "WHEN",
      "THEN", "ELSE", "END", "PRIMARY", "KEY", "FOREIGN", "REFERENCES", "CASCADE",
      "select", "from", "where", "insert", "update", "delete", "create", "drop",
      "alter", "table", "index", "view", "into", "values", "set", "and", "or",
      "not", "null", "is", "in", "between", "like", "order", "by", "asc", "desc",
      "group", "having", "join", "left", "right", "inner", "outer", "on", "as",
    ],
    stringPatterns: [
      /'(?:[^'\\]|\\.)*'/g,
    ],
    commentPatterns: [
      /--.*$/gm,
      /\/\*[\s\S]*?\*\//g,
    ],
    numberPattern: /\b\d+\.?\d*\b/g,
  },

  markdown: {
    // Minimal highlighting for markdown
    stringPatterns: [
      /`[^`]+`/g,           // Inline code
      /```[\s\S]*?```/g,    // Code blocks
    ],
    commentPatterns: [
      /<!--[\s\S]*?-->/g,
    ],
  },
};

// Language aliases
const languageAliases: Record<string, string> = {
  js: "javascript",
  ts: "typescript",
  tsx: "typescript",
  jsx: "javascript",
  py: "python",
  rb: "ruby",
  sh: "bash",
  shell: "bash",
  zsh: "bash",
  yml: "yaml",
  htm: "html",
  md: "markdown",
};

// ============================================================================
// HIGHLIGHTING FUNCTIONS
// ============================================================================

/**
 * Highlight code with the given language
 */
export function highlight(code: string, language: string, theme: HighlightTheme = defaultTheme): string {
  const lang = languageAliases[language.toLowerCase()] || language.toLowerCase();
  const rules = languages[lang];

  if (!rules) {
    // No rules for this language, return with minimal highlighting
    return theme.plain(code);
  }

  // Apply highlighting
  let result = code;

  // First, protect strings and comments by replacing them with placeholders
  const protectedStrings: string[] = [];
  const protectedComments: string[] = [];

  // Protect comments
  if (rules.commentPatterns) {
    for (const pattern of rules.commentPatterns) {
      result = result.replace(pattern, (match) => {
        protectedComments.push(match);
        return `__COMMENT_${protectedComments.length - 1}__`;
      });
    }
  }

  // Protect strings
  if (rules.stringPatterns) {
    for (const pattern of rules.stringPatterns) {
      result = result.replace(pattern, (match) => {
        protectedStrings.push(match);
        return `__STRING_${protectedStrings.length - 1}__`;
      });
    }
  }

  // Highlight keywords
  if (rules.keywords) {
    const keywordPattern = new RegExp(`\\b(${rules.keywords.join("|")})\\b`, "g");
    result = result.replace(keywordPattern, (match) => theme.keyword(match));
  }

  // Highlight types
  if (rules.types) {
    const typePattern = new RegExp(`\\b(${rules.types.join("|")})\\b`, "g");
    result = result.replace(typePattern, (match) => theme.type(match));
  }

  // Highlight constants
  if (rules.constants) {
    const constPattern = new RegExp(`\\b(${rules.constants.join("|")})\\b`, "g");
    result = result.replace(constPattern, (match) => theme.constant(match));
  }

  // Highlight numbers
  if (rules.numberPattern) {
    result = result.replace(rules.numberPattern, (match) => theme.number(match));
  }

  // Highlight functions (before restoring strings)
  if (rules.functionPattern) {
    result = result.replace(rules.functionPattern, (match, name) => theme.function(name) + match.slice(name.length));
  }

  // Restore strings with highlighting
  for (let i = 0; i < protectedStrings.length; i++) {
    result = result.replace(`__STRING_${i}__`, theme.string(protectedStrings[i]));
  }

  // Restore comments with highlighting
  for (let i = 0; i < protectedComments.length; i++) {
    result = result.replace(`__COMMENT_${i}__`, theme.comment(protectedComments[i]));
  }

  return result;
}

/**
 * Detect language from code content
 */
export function detectLanguage(code: string): string | null {
  // Check for shebang
  const shebangMatch = code.match(/^#!.*\/(bash|sh|python|node|ruby)/);
  if (shebangMatch) {
    return shebangMatch[1];
  }

  // Heuristics based on content
  if (code.includes("import React") || code.includes("from 'react'")) return "javascript";
  if (code.includes("async def ") || code.match(/def \w+\(/)) return "python";
  if (code.includes("fn main()") || code.includes("let mut ")) return "rust";
  if (code.includes("func main()") || code.includes("package main")) return "go";
  if (code.match(/SELECT .* FROM/i)) return "sql";
  if (code.includes("<!DOCTYPE html") || code.match(/<html/i)) return "html";
  if (code.match(/^\s*\{[\s\S]*\}\s*$/)) return "json";
  if (code.match(/^\s*[\w-]+:/m)) return "yaml";

  return null;
}

/**
 * Format a code block with syntax highlighting
 */
export function formatCodeBlock(code: string, language: string, theme: HighlightTheme = defaultTheme): string {
  const highlighted = highlight(code, language, theme);
  const lines = highlighted.split("\n");
  const dim = chalk.hex("#6B5B4F");
  const border = chalk.hex("#5A5A5A");

  const header = language ? border(`─── ${language} `) + border("─".repeat(Math.max(0, 40 - language.length))) : border("─".repeat(44));

  const formattedLines = lines.map((line, i) => {
    const lineNum = dim((i + 1).toString().padStart(3));
    return `${lineNum} ${border("│")} ${line}`;
  });

  return [
    header,
    ...formattedLines,
    border("─".repeat(44)),
  ].join("\n");
}

/**
 * Process markdown-style code blocks in text
 */
export function highlightCodeBlocks(text: string, theme: HighlightTheme = defaultTheme): string {
  // Match ```language\ncode\n```
  return text.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    const language = lang || detectLanguage(code) || "text";
    return "\n" + formatCodeBlock(code.trim(), language, theme) + "\n";
  });
}

// ============================================================================
// EXPORTS
// ============================================================================

export { coffeeTheme, defaultTheme, languages, languageAliases };
