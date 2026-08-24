/**
 * Type declarations for the oxlint plugin. oxlint ships no types for its
 * JS-plugin API, so the shapes below are declared structurally — enough for
 * `oxlint.config.ts` users to import the plugin and for editors to describe the
 * rule options.
 */

/** Element name that a suggested fix wraps offending text in. Defaults to `span`. */
export interface WrapOption {
  wrapWith?: string;
}

export interface NoConditionalTextNodesOptions extends WrapOption {
  /**
   * Names of *project* functions that return a string rather than an element —
   * translators (`t`, `formatMessage`), formatters (`formatCurrency`,
   * `humanize`), anything whose return value renders as bare text.
   *
   * Stands in for the type information oxlint does not expose to a JS plugin.
   * These add to a built-in list of functions the language already guarantees
   * return strings (`toLocaleString`, `toFixed`, `join`, `String`, …), which
   * need no configuration.
   *
   * Matched against the final identifier of the callee, so `"formatMessage"`
   * covers both `formatMessage(...)` and `intl.formatMessage(...)`.
   */
  textReturningFunctions?: string[];
}

export type NoReturnTextNodesOptions = WrapOption;

interface RuleMeta {
  type: string;
  hasSuggestions: boolean;
  docs: { description: string; url: string };
  schema: unknown[];
  messages: Record<string, string>;
}

interface Rule {
  meta: RuleMeta;
  create(context: unknown): Record<string, (node: never) => void>;
}

declare const plugin: {
  meta: { name: "react-google-translate"; version: string };
  rules: {
    "no-conditional-text-nodes-with-siblings": Rule;
    "no-return-text-nodes": Rule;
  };
};

export default plugin;
