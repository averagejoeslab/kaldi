/**
 * Skills Index
 *
 * Export skills system components.
 */

export * from "./types.js";
export { builtinSkills, getBuiltinSkill, getAllBuiltinSkills, getBuiltinSkillsByCategory } from "./builtin.js";
export { SkillsRegistry, getSkillsRegistry } from "./registry.js";
