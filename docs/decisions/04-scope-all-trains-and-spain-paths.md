# ADR 04: Scope Includes All Trains In Feed

## Status
Accepted

## Context
Product scope should not be limited to one subset of lines if feed includes additional services.

## Decision
Render all trains available in the JSON feed and all applicable train paths inside Spain.

## Technical Requirements
- Do not hard-filter by line prefix by default.
- Include route prefixes such as C*, R*, and any new values in feed.
- Add optional UI filters for line groups, but default is all visible.
- Ensure map and clustering handle nationwide spread.

## Consequences
- Larger marker population in dense metro areas.
- Need robust clustering and efficient marker updates.
