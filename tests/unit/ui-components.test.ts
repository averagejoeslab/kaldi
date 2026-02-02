/**
 * Unit tests for UI Components
 */

import { describe, it, expect } from 'vitest';
import {
  renderWelcome,
  renderCompactWelcome,
  type WelcomeConfig,
} from '../../src/ui/welcome.js';
import {
  formatToolTree,
  formatToolCall,
  formatToolSummary,
  formatGroupedToolTree,
  type ToolCall,
} from '../../src/ui/tool-tree.js';
import {
  renderStatusLine,
  renderCompactStatus,
  renderCompactionIndicator,
  renderPrompt,
  renderPromptHint,
  type StatusLineConfig,
} from '../../src/ui/statusline.js';

// Helper to strip ANSI codes for easier testing
function stripAnsi(str: string): string {
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

describe('Welcome Screen', () => {
  const baseConfig: WelcomeConfig = {
    version: '1.0.0',
    model: 'claude-opus',
    projectPath: '/home/user/projects/test',
  };

  describe('renderWelcome', () => {
    it('should render welcome with version', () => {
      const output = renderWelcome(baseConfig);
      const plain = stripAnsi(output);

      expect(plain).toContain('Kaldi v1.0.0');
    });

    it('should render user greeting', () => {
      const config = { ...baseConfig, userName: 'Chase' };
      const output = renderWelcome(config);
      const plain = stripAnsi(output);

      expect(plain).toContain('Welcome back Chase!');
    });

    it('should render model info', () => {
      const output = renderWelcome(baseConfig);
      const plain = stripAnsi(output);

      expect(plain).toContain('claude-opus');
    });

    it('should render project path', () => {
      const output = renderWelcome(baseConfig);
      const plain = stripAnsi(output);

      expect(plain).toContain('test');
    });

    it('should render tips section', () => {
      const output = renderWelcome(baseConfig);
      const plain = stripAnsi(output);

      expect(plain).toContain('Tips for getting started');
    });

    it('should render recent activity section', () => {
      const output = renderWelcome(baseConfig);
      const plain = stripAnsi(output);

      expect(plain).toContain('Recent activity');
    });

    it('should show no recent activity when empty', () => {
      const output = renderWelcome(baseConfig);
      const plain = stripAnsi(output);

      expect(plain).toContain('No recent activity');
    });

    it('should show recent activity items', () => {
      const config: WelcomeConfig = {
        ...baseConfig,
        recentActivity: [
          { type: 'session', description: 'Worked on feature X' },
        ],
      };
      const output = renderWelcome(config);
      const plain = stripAnsi(output);

      expect(plain).toContain('Worked on feature X');
    });
  });

  describe('renderCompactWelcome', () => {
    it('should render compact version', () => {
      const output = renderCompactWelcome(baseConfig);
      const plain = stripAnsi(output);

      expect(plain).toContain('Kaldi v1.0.0');
      expect(plain).toContain('Welcome!');
    });

    it('should include user name if provided', () => {
      const config = { ...baseConfig, userName: 'Chase' };
      const output = renderCompactWelcome(config);
      const plain = stripAnsi(output);

      expect(plain).toContain('Chase');
    });
  });
});

describe('Tool Tree', () => {
  const sampleTools: ToolCall[] = [
    {
      id: '1',
      name: 'read_file',
      args: { path: '/src/index.ts' },
      startTime: Date.now() - 100,
      endTime: Date.now(),
      resultLineCount: 150,
    },
    {
      id: '2',
      name: 'read_file',
      args: { path: '/src/utils.ts' },
      startTime: Date.now() - 50,
      endTime: Date.now(),
      resultLineCount: 80,
    },
    {
      id: '3',
      name: 'glob',
      args: { pattern: '**/*.ts' },
      startTime: Date.now() - 30,
      endTime: Date.now(),
    },
  ];

  describe('formatToolTree', () => {
    it('should format empty tool list', () => {
      const output = formatToolTree([]);
      expect(output).toBe('');
    });

    it('should format single tool', () => {
      const output = formatToolTree([sampleTools[0]]);
      const plain = stripAnsi(output);

      expect(plain).toContain('Read File');
      expect(plain).toContain('index.ts');
      expect(plain).toContain('150 lines');
    });

    it('should use tree connectors', () => {
      const output = formatToolTree(sampleTools.slice(0, 2));
      const plain = stripAnsi(output);

      expect(plain).toContain('├');
      expect(plain).toContain('└');
    });

    it('should collapse when exceeding maxVisible', () => {
      const manyTools = Array(10).fill(null).map((_, i) => ({
        id: String(i),
        name: 'read_file',
        args: { path: `/file${i}.ts` },
        startTime: Date.now(),
        endTime: Date.now(),
      }));

      const output = formatToolTree(manyTools, { maxVisible: 3 });
      const plain = stripAnsi(output);

      expect(plain).toContain('+7 more');
      expect(plain).toContain('ctrl+o to expand');
    });

    it('should show all tools in verbose mode', () => {
      const manyTools = Array(10).fill(null).map((_, i) => ({
        id: String(i),
        name: 'read_file',
        args: { path: `/file${i}.ts` },
        startTime: Date.now(),
        endTime: Date.now(),
      }));

      const output = formatToolTree(manyTools, { maxVisible: 3, verbose: true });
      const plain = stripAnsi(output);

      expect(plain).not.toContain('+7 more');
    });

    it('should show full paths when configured', () => {
      const output = formatToolTree([sampleTools[0]], { showFullPaths: true });
      const plain = stripAnsi(output);

      expect(plain).toContain('/src/index.ts');
    });
  });

  describe('formatToolCall', () => {
    it('should format read_file tool', () => {
      const output = formatToolCall(sampleTools[0]);
      const plain = stripAnsi(output);

      expect(plain).toContain('Read File');
      expect(plain).toContain('index.ts');
    });

    it('should show success indicator for completed tools', () => {
      const output = formatToolCall(sampleTools[0]);
      const plain = stripAnsi(output);

      expect(plain).toContain('✓');
    });

    it('should show error indicator for failed tools', () => {
      const errorTool: ToolCall = {
        ...sampleTools[0],
        isError: true,
      };
      const output = formatToolCall(errorTool);
      const plain = stripAnsi(output);

      expect(plain).toContain('✗');
    });

    it('should format glob tool', () => {
      const output = formatToolCall(sampleTools[2]);
      const plain = stripAnsi(output);

      expect(plain).toContain('Glob');
      expect(plain).toContain('**/*.ts');
    });
  });

  describe('formatToolSummary', () => {
    it('should return empty for no tools', () => {
      const output = formatToolSummary([]);
      expect(output).toBe('');
    });

    it('should summarize tool counts', () => {
      const output = formatToolSummary(sampleTools);
      const plain = stripAnsi(output);

      expect(plain).toContain('Read');
      expect(plain).toContain('2');
      expect(plain).toContain('Search');
      expect(plain).toContain('ctrl+o to expand');
    });
  });

  describe('formatGroupedToolTree', () => {
    it('should group tools by category', () => {
      const tools: ToolCall[] = [
        { id: '1', name: 'read_file', args: { path: '/a.ts' }, startTime: 0 },
        { id: '2', name: 'write_file', args: { path: '/b.ts' }, startTime: 0 },
        { id: '3', name: 'grep', args: { pattern: 'test' }, startTime: 0 },
      ];

      const output = formatGroupedToolTree(tools);
      const plain = stripAnsi(output);

      expect(plain).toContain('Read files');
      expect(plain).toContain('Write/Edit');
      expect(plain).toContain('Search');
    });
  });
});

describe('Status Line', () => {
  describe('renderStatusLine', () => {
    it('should render idle state', () => {
      const config: StatusLineConfig = { state: 'idle' };
      const output = renderStatusLine(config);

      expect(output).toBe('');
    });

    it('should render thinking state', () => {
      const config: StatusLineConfig = { state: 'thinking' };
      const output = renderStatusLine(config);
      const plain = stripAnsi(output);

      expect(plain).toContain('thinking');
    });

    it('should render flowing state', () => {
      const config: StatusLineConfig = { state: 'flowing' };
      const output = renderStatusLine(config);
      const plain = stripAnsi(output);

      expect(plain).toContain('Flowing');
    });

    it('should show duration', () => {
      const config: StatusLineConfig = {
        state: 'thinking',
        durationMs: 65000, // 1m 5s
      };
      const output = renderStatusLine(config);
      const plain = stripAnsi(output);

      expect(plain).toContain('1m');
    });

    it('should show token count', () => {
      const config: StatusLineConfig = {
        state: 'flowing',
        inputTokens: 13000,
      };
      const output = renderStatusLine(config);
      const plain = stripAnsi(output);

      expect(plain).toContain('13.0k');
      expect(plain).toContain('tokens');
    });

    it('should show image references', () => {
      const config: StatusLineConfig = {
        state: 'idle',
        images: [
          { id: 11 },
          { id: 12 },
          { id: 13, selected: true },
        ],
      };
      const output = renderStatusLine(config);
      const plain = stripAnsi(output);

      expect(plain).toContain('[Image #11]');
      expect(plain).toContain('[Image #12]');
      expect(plain).toContain('[Image #13]');
      expect(plain).toContain('↑ to select');
    });

    it('should show accept edits mode', () => {
      const config: StatusLineConfig = {
        state: 'idle',
        acceptEditsOn: true,
        showHints: true,
      };
      const output = renderStatusLine(config);
      const plain = stripAnsi(output);

      expect(plain).toContain('accept edits on');
      expect(plain).toContain('shift+tab to cycle');
    });

    it('should show interrupt hint when active', () => {
      const config: StatusLineConfig = {
        state: 'flowing',
        showHints: true,
      };
      const output = renderStatusLine(config);
      const plain = stripAnsi(output);

      expect(plain).toContain('esc to interrupt');
    });
  });

  describe('renderCompactStatus', () => {
    it('should render compact status', () => {
      const config: StatusLineConfig = {
        state: 'thinking',
        durationMs: 5000,
        inputTokens: 1000,
      };
      const output = renderCompactStatus(config);
      const plain = stripAnsi(output);

      expect(plain).toContain('+');
      expect(plain).toContain('5s');
      expect(plain).toContain('1.0k');
    });
  });

  describe('renderCompactionIndicator', () => {
    it('should render compaction message', () => {
      const output = renderCompactionIndicator();
      const plain = stripAnsi(output);

      expect(plain).toContain('Conversation compacted');
      expect(plain).toContain('ctrl+o');
      expect(plain).toContain('history');
    });

    it('should use custom expand hint', () => {
      const output = renderCompactionIndicator('ctrl+h');
      const plain = stripAnsi(output);

      expect(plain).toContain('ctrl+h');
    });
  });

  describe('renderPrompt', () => {
    it('should render prompt character', () => {
      const output = renderPrompt({ mode: 'chat' });
      const plain = stripAnsi(output);

      expect(plain).toContain('›');
    });
  });

  describe('renderPromptHint', () => {
    it('should render accept edits hint', () => {
      const output = renderPromptHint({ mode: 'auto', acceptEditsOn: true });
      const plain = stripAnsi(output);

      expect(plain).toContain('accept edits on');
      expect(plain).toContain('shift+tab');
    });

    it('should render plan mode hint', () => {
      const output = renderPromptHint({ mode: 'plan' });
      const plain = stripAnsi(output);

      expect(plain).toContain('plan mode');
    });

    it('should return empty for chat mode', () => {
      const output = renderPromptHint({ mode: 'chat' });
      expect(output).toBe('');
    });
  });
});
