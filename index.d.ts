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
   * Names of helpers that return translated text. Matched against the final
   * identifier of the callee, so `"formatMessage"` covers both
   * `formatMessage(...)` and `intl.formatMessage(...)`.
   *
   * Empty by default — no call is treated as text until you list one. Which
   * helper returns a translated string is a project convention, so there is
   * deliberately no built-in guess.
   */
  i18nFunctions?: string[];
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
