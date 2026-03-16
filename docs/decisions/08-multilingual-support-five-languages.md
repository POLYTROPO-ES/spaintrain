# ADR 08: Five-Language MVP

## Status
Accepted

## Context
Product must serve multilingual audience in phase 1.

## Decision
Support Spanish, English, French, Italian, and Portuguese.

## Technical Requirements
- Externalized translation dictionaries for all UI strings.
- Language switcher in menu.
- Persist language selection in local settings.
- Use fallback language if key missing.

## Consequences
- Translation maintenance overhead grows with feature set.
- QA matrix includes five locales.
