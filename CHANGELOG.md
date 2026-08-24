# Changelog

All notable changes to this fork are documented here. This project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.0] - 2026-08-24

### Added

- **`no-return-text-nodes` now recognises text-returning calls,** and takes the
  `textReturningFunctions` option to name them. `() => t("key")` — the commonest
  bare-text component there is in an i18n codebase — and `() => d.toLocaleString()`
  were unreported, even though the sibling rule already flagged the very same
  calls in a conditional branch. Both rules now ask the same question of a call,
  and the built-in stringifiers still need no configuration. Optional chaining is
  followed, so `() => d?.toLocaleString()` counts too.
- **Anonymous default exports are checked.** `export default () => "text"` and
  `export default function () { … }` have no name to capitalise and no declarator
  to hang the check on, so neither was ever visited — while the equally anonymous
  `export default memo(() => "text")` was already reported. A named
  `export default function Label()` still reports once, not twice.
- **TypeScript declarations are type-checked in CI.** `index.d.ts` is
  hand-written and nothing compiled it, so it could rot through any refactor.
  `types/usage.ts` is a consumer that compiles against it under `pnpm typecheck`;
  it is neither shipped nor executed.

### Fixed

- **A JSX comment is no longer counted as a sibling.**
  `{cond ? "a" : "b"}{/* c */}` was reported, but the JSX transform drops the
  comment entirely: the conditional is the parent's only child, and React
  replaces a lone child's contents rather than reparenting a text node. The same
  applies inside a fragment, where a comment no longer stops
  `{cond ? <>{/* c */}<b>a</b></> : ""}` from standing down.

### Changed

- **The plugin version is read from `package.json`** rather than duplicated in
  `index.js`, so a release bumps one file instead of two.
- **The rule tester surfaces an oxlint failure instead of a parse error.** When
  oxlint exits before linting starts — a rejected rule option, a plugin that will
  not load — its stdout and stderr are raised, where the harness previously died
  with `SyntaxError: Unexpected token 'F'` and said nothing about the cause.

## [0.3.0] - 2026-08-24

### Added

- **Suggested fixes on both rules.** `oxlint --fix-suggestions` now wraps the
  offending node in an element. Offered as a suggestion rather than a plain
  `--fix` because the wrapper adds a DOM node that CSS can notice (`> *`
  selectors, flex/grid child counts). No suggestion is offered in `.ts`/`.mts`/
  `.cts` files, where JSX does not parse.
- **Built-in stringifiers are flagged with no configuration.** `toLocaleString`,
  `toString`, `toFixed`, `toISOString`, `join`, `String`, `trim` and friends are
  guaranteed by the language to return a string, so `{cond ? n.toFixed(2) : <b/>}`
  now reports out of the box. `slice` and `concat` are deliberately excluded —
  the `Array` versions return arrays, so the name alone does not settle it.
- **Rule options.** `textReturningFunctions` names your *project's* text-returning
  functions — translators, formatters — on top of those built-ins. It is the
  rule's stand-in for the type information oxlint does not expose to a JS plugin.
  `wrapWith` chooses the element the suggestion uses.
- **Per-rule documentation** under `docs/rules/`, linked from each rule's
  `meta.docs.url` so oxlint can point users at it.
- **TypeScript declarations** (`index.d.ts`), so `oxlint.config.ts` users get a
  typed import and editors can describe the options.

### Fixed

- **Fragments are no longer invisible to
  `no-conditional-text-nodes-with-siblings`.** The rule required the enclosing
  JSX parent to be a `JSXElement`, so `<>{cond ? "a" : "b"}<span/></>` went
  unreported while the element-parent form was caught — and a fragment root is
  one of the most common component shapes.
- **`no-return-text-nodes` now catches conditional returns.** `() => cond ? "a" :
  "b"` and `return cond && "a"` return text down at least one path; only direct
  literals were recognised before.
- **`no-return-text-nodes` now checks wrapped and class components.**
  `memo(...)`, `forwardRef(...)` (including nested and anonymous
  `export default memo(...)` forms) and a class component's `render` method or
  `render = () => ...` property were all previously unvisited.
- **Text-returning calls are matched through a member callee.** Only a bare
  `t(...)` or `formatMessage(...)` identifier was recognised, so
  `intl.formatMessage({...})` — the shape react-intl actually hands you — was
  missed. The arity check went with it: it existed because `t()` always takes a
  key, but a zero-argument `toLocaleString()` returns text just the same.

### Removed

- **The hardcoded `t` / `formatMessage` list.** `textReturningFunctions` is empty
  by default, so no call is treated as returning text until a project lists its
  own. These names are a project convention, and a built-in guess at an
  identifier as generic as `t` reports every unrelated function sharing the name
  while still missing every project that names its helpers differently.

  The i18n framing went with it. The rule cannot tell whether `foo()` returns a
  `string` or a `ReactElement`, and translation is only the most familiar case of
  that — `formatCurrency(x)` and `date.toLocaleString()` are exactly as
  dangerous, and an option called `i18nFunctions` would never have prompted
  anyone to list them.

  The line now falls on who decides a name's meaning: what the language settles
  (`toLocaleString`) is built in, what a project settles (`t`, `formatCurrency`)
  is configured.

  **Migration:** if you relied on the previous behaviour, restore it explicitly:

  ```json
  {
    "rules": {
      "react-google-translate/no-conditional-text-nodes-with-siblings": [
        "error",
        { "textReturningFunctions": ["t", "formatMessage"] }
      ]
    }
  }
  ```

### Changed

- `peerDependencies` narrowed from `oxlint >=1.0.0` to `>=1.47.0 <2`. oxlint's
  own config schema notes that JS plugins are "in alpha and not subject to
  semver"; 1.47 is the oldest release verified to apply plugin suggestion fixes.
- Tests rebuilt around a small RuleTester: each pattern is an isolated case with
  its own expected reports, replacing a single golden list of every expectation
  in the suite. Suggestions are asserted by the code they produce.
- CI now lints this repository with oxlint, runs the suite against both the
  floor and the latest oxlint, and fails when published files change without a
  version bump.

## [0.2.0] - 2026-08-19

### Added

- Published as a scoped fork with CI and a tag-driven release workflow.
- Arrow-function and function-expression components are checked by
  `no-return-text-nodes`; previously only `FunctionDeclaration` was visited.

### Fixed

- `{cond ? <El/> : ""}` is no longer reported. `''` creates no text node — the
  reconciler's guard is `newChild !== ''` — so there is nothing to reparent. It
  is still reported where the opposite branch may render unidentifiable text.
- `{cond ? <El/> : items?.map((i) => <li key={i} />)}` is no longer reported;
  the callback demonstrably returns JSX. `items?.map(String)` still is.

## [0.1.0] - 2026-07-08

- Initial port of `eslint-plugin-react-google-translate` to the oxlint
  JS-plugin API.

[0.3.0]: https://github.com/Faithfinder/react-google-translate-oxlint/releases/tag/v0.3.0
[0.2.0]: https://github.com/Faithfinder/react-google-translate-oxlint/releases/tag/v0.2.0
[0.1.0]: https://github.com/Faithfinder/react-google-translate-oxlint/releases/tag/v0.1.0
