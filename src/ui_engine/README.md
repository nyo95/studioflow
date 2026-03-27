# UI Engine

`src/ui_engine` is the presentation layer for the app.

Use this folder for shared frontend structure and visual primitives that control:

- page shells
- page headers
- shared card patterns
- layout rhythm and spacing rules

Keep feature-specific business logic in domain components under `src/components`.
The goal is similar to the "view" layer in MVP: pages consume the UI engine instead of redefining layout patterns locally.
