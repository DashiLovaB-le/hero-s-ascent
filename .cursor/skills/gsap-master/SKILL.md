---
name: gsap-master
description: >-
  Builds production GSAP animations for animated sites and landings using the
  gsap-master MCP (bruzethegreat-gsap-master-mcp-server). Use when creating or
  debugging hero/scroll/text/UI motion, ScrollTrigger, SplitText, timelines,
  performance (60fps/mobile), or when the user asks for GSAP / sites animados.
---

# GSAP Master (animated sites)

## Workflow

1. Call MCP server **`gsap-master`** before inventing animation code from scratch.
2. Pick the tool that matches the ask:

| Need | Tool |
|------|------|
| Describe motion in Portuguese/English → code | `understand_and_create_animation` |
| API / plugin details | `get_gsap_api_expert` |
| New project/framework wiring | `generate_complete_setup` (React) |
| Lag, Safari, ScrollTrigger bugs | `debug_animation_issue` |
| Smoothness / battery / leaks | `optimize_for_performance` |
| Hero, scroll system, text, page transition | `create_production_pattern` |

3. Rewrite the MCP output to match this repo:
   - React hook + `gsap.context` scoped to a root ref
   - `data-*` selectors
   - `prefers-reduced-motion` via `matchMedia`
   - Existing styles / design system — no purple-glow generic AI look

## Reference in-repo

Canonical pattern: `src/components/landing/useLandingGsap.ts` (hero timeline, parallax scrub, section reveals, staggers, count-up, desktop pin).

## Quality bar

- 60fps intent; animate transform/opacity (`autoAlpha`) when possible
- Mobile-safe defaults; avoid heavy pins on small screens
- Few strong motions > many competing effects
