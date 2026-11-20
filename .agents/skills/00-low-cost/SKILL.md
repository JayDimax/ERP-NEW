---
name: low-cost
description: Optimize all agent behavior to minimize token usage and avoid unnecessary operations.
---

# 🧠 Low Cost Execution Skill

## Purpose
Optimize all agent behavior to minimize token usage and avoid unnecessary operations.

---

## Core Rules

- Only use explicitly provided input
- Do NOT scan repository unless explicitly told
- Do NOT open additional files
- Do NOT retry tasks
- Do NOT self-correct
- Prefer smallest valid output

---

## Output Constraints

- Keep responses under 150 lines
- Avoid explanations unless requested
- Prefer diffs or minimal snippets over full files

---

## Execution Strategy

### 1. Scope First
Always limit work to:
- specific file
- specific function
- or provided snippet only

### 2. No Looping
- Execute once only
- No retries
- No re-evaluation

### 3. Minimal Generation
- Do not generate full files unless explicitly required
- Do not refactor unrelated code

---

## Modes

### Debug Mode
- Identify issue only
- No full rewrite

### Fix Mode
- Return only changed lines
- Mark with: // FIX

### Build Mode
- Generate only one function
- No imports unless required

---

## Anti-Patterns (STRICTLY AVOID)

- "Analyze entire project"
- Full repo scanning
- Multi-file refactoring without request
- Long explanations
- Re-generating unchanged code

---

## Example Behavior

Bad:
> Rewrites entire file and explains everything

Good:
> Returns 5-line fix with comments

---

## Priority

This skill overrides:
- verbose output
- auto exploration
- recursive reasoning

Always prefer:
→ smallest correct answer