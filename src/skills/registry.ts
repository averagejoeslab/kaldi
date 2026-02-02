/**
 * Skills Registry
 *
 * Manages skill registration and lookup.
 */

import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import type { Skill, SkillContext, SkillResult } from "./types.js";
import { builtinSkills, getBuiltinSkill } from "./builtin.js";

/**
 * Custom skills configuration
 */
interface SkillsConfig {
  skills: Skill[];
}

/**
 * Skills Registry
 */
export class SkillsRegistry {
  private customSkills: Skill[] = [];
  private configPath: string;

  constructor(configPath?: string) {
    this.configPath = configPath || join(homedir(), ".kaldi", "skills.json");
    this.loadCustomSkills();
  }

  /**
   * Load custom skills from config
   */
  loadCustomSkills(): void {
    if (!existsSync(this.configPath)) {
      this.customSkills = [];
      return;
    }

    try {
      const content = readFileSync(this.configPath, "utf-8");
      const config = JSON.parse(content) as SkillsConfig;
      this.customSkills = config.skills || [];
    } catch {
      this.customSkills = [];
    }
  }

  /**
   * Save custom skills to config
   */
  saveCustomSkills(): void {
    const config: SkillsConfig = { skills: this.customSkills };
    writeFileSync(this.configPath, JSON.stringify(config, null, 2), "utf-8");
  }

  /**
   * Get a skill by name
   */
  getSkill(name: string): Skill | undefined {
    // Check custom skills first (allows overriding builtins)
    const custom = this.customSkills.find(
      (s) => s.name === name || s.aliases?.includes(name)
    );
    if (custom) return custom;

    // Check built-in skills
    return getBuiltinSkill(name);
  }

  /**
   * Check if a skill exists
   */
  hasSkill(name: string): boolean {
    return this.getSkill(name) !== undefined;
  }

  /**
   * Get all skills
   */
  getAllSkills(): Skill[] {
    // Combine custom and builtin, with custom overriding builtin
    const customNames = new Set(this.customSkills.map((s) => s.name));
    const filtered = builtinSkills.filter((s) => !customNames.has(s.name));
    return [...this.customSkills, ...filtered];
  }

  /**
   * Add a custom skill
   */
  addSkill(skill: Skill): void {
    // Remove existing skill with same name
    this.customSkills = this.customSkills.filter((s) => s.name !== skill.name);
    this.customSkills.push({ ...skill, builtin: false });
    this.saveCustomSkills();
  }

  /**
   * Remove a custom skill
   */
  removeSkill(name: string): boolean {
    const initialLength = this.customSkills.length;
    this.customSkills = this.customSkills.filter((s) => s.name !== name);

    if (this.customSkills.length < initialLength) {
      this.saveCustomSkills();
      return true;
    }

    return false;
  }

  /**
   * Execute a skill
   */
  executeSkill(name: string, args: string, context: SkillContext): SkillResult | null {
    const skill = this.getSkill(name);
    if (!skill) return null;

    // Replace {args} placeholder with actual arguments
    let prompt = skill.prompt.replace("{args}", args);

    // Check for required arguments
    if (skill.requiredArgs?.length && !args.trim()) {
      return {
        prompt: `Missing required argument(s): ${skill.requiredArgs.join(", ")}\n\nUsage: /${name} <${skill.requiredArgs.join("> <")}>`,
      };
    }

    return { prompt };
  }

  /**
   * Get skill help text
   */
  getSkillHelp(name: string): string | null {
    const skill = this.getSkill(name);
    if (!skill) return null;

    const lines: string[] = [];
    lines.push(`/${skill.name}`);

    if (skill.aliases?.length) {
      lines.push(`  Aliases: ${skill.aliases.map((a) => `/${a}`).join(", ")}`);
    }

    lines.push(`  ${skill.description}`);

    if (skill.requiredArgs?.length) {
      lines.push(`  Required: ${skill.requiredArgs.join(", ")}`);
    }

    if (skill.optionalArgs?.length) {
      lines.push(`  Optional: ${skill.optionalArgs.join(", ")}`);
    }

    return lines.join("\n");
  }
}

// Singleton instance
let registryInstance: SkillsRegistry | null = null;

/**
 * Get the skills registry singleton
 */
export function getSkillsRegistry(): SkillsRegistry {
  if (!registryInstance) {
    registryInstance = new SkillsRegistry();
  }
  return registryInstance;
}
