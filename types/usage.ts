/**
 * Not shipped and not executed: `pnpm typecheck` compiles this file so that a
 * change to `index.d.ts` which would break a consumer's `oxlint.config.ts`
 * fails here, rather than in a project that installs the plugin.
 */

import plugin, {
  type NoConditionalTextNodesOptions,
  type NoReturnTextNodesOptions,
} from "../index.js";

// The plugin name is what oxlint namespaces the rules under, so it is part of
// the contract rather than an implementation detail.
const name: "react-google-translate" = plugin.meta.name;
void name;
void plugin.meta.version;

// Both rules exist and carry the metadata oxlint reads.
void plugin.rules["no-conditional-text-nodes-with-siblings"].meta.docs.url;
void plugin.rules["no-return-text-nodes"].meta.hasSuggestions;

// @ts-expect-error - a rule this plugin does not define
void plugin.rules["no-such-rule"];

const conditional: NoConditionalTextNodesOptions = {
  textReturningFunctions: ["t", "formatMessage"],
  wrapWith: "span",
};
void conditional;

// Both rules take the same two options.
const returnText: NoReturnTextNodesOptions = {
  textReturningFunctions: ["t"],
  wrapWith: "div",
};
void returnText;

// Either option may be omitted.
const empty: NoReturnTextNodesOptions = {};
void empty;

// @ts-expect-error - wrapWith is an element name, not a boolean
const badWrap: NoReturnTextNodesOptions = { wrapWith: true };
void badWrap;

// @ts-expect-error - textReturningFunctions is a list of names, not one name
const badList: NoConditionalTextNodesOptions = { textReturningFunctions: "t" };
void badList;

// @ts-expect-error - a misspelled option would be silently ignored at runtime
const misspelled: NoReturnTextNodesOptions = { wrapsWith: "span" };
void misspelled;
