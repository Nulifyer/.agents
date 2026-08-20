import { createRequire } from "node:module";
import { basename, dirname, extname, join } from "node:path";
import { Language } from "web-tree-sitter";
import { initializeTreeSitter } from "./tree-sitter-runtime.ts";

const require = createRequire(import.meta.url);

export type LanguageSpec = {
  id: string;
  extensions?: string[];
  fileNames?: string[];
  packageName?: string;
  wasmFile: string;
  query: string;
};

const ECMASCRIPT_COMMON_QUERY = `
(class_declaration) @class
(class name: (_)) @class
(function_declaration) @function
(generator_function_declaration) @function
(function_expression name: (identifier)) @function
(generator_function name: (identifier)) @function
(method_definition) @method
(variable_declarator value: [(arrow_function) (function_expression)]) @function
(program (lexical_declaration "const" (variable_declarator name: (identifier)) @constant))
(export_statement declaration: (lexical_declaration "const" (variable_declarator name: (identifier)) @constant))
`;

const JAVASCRIPT_QUERY = `${ECMASCRIPT_COMMON_QUERY}
(field_definition) @field
`;

const TYPESCRIPT_QUERY = `${ECMASCRIPT_COMMON_QUERY}
(abstract_class_declaration) @class
(interface_declaration) @interface
(type_alias_declaration) @type
(enum_declaration) @enum
(module) @module
(internal_module) @module
(function_signature) @function
(method_signature) @method
(abstract_method_signature) @method
(property_signature) @property
(public_field_definition) @field
`;

const C_QUERY = `
(function_definition) @function
(struct_specifier name: (type_identifier)) @struct
(union_specifier name: (type_identifier)) @struct
(enum_specifier name: (type_identifier)) @enum
(type_definition) @type
(preproc_function_def) @macro
(preproc_def) @constant
`;

const LANGUAGE_SPECS: LanguageSpec[] = [
  {
    id: "typescript",
    extensions: [".ts", ".mts", ".cts"],
    packageName: "tree-sitter-typescript",
    wasmFile: "tree-sitter-typescript.wasm",
    query: TYPESCRIPT_QUERY,
  },
  {
    id: "tsx",
    extensions: [".tsx"],
    packageName: "tree-sitter-typescript",
    wasmFile: "tree-sitter-tsx.wasm",
    query: TYPESCRIPT_QUERY,
  },
  {
    id: "javascript",
    extensions: [".js", ".mjs", ".cjs"],
    packageName: "tree-sitter-javascript",
    wasmFile: "tree-sitter-javascript.wasm",
    query: JAVASCRIPT_QUERY,
  },
  {
    id: "jsx",
    extensions: [".jsx"],
    packageName: "tree-sitter-javascript",
    wasmFile: "tree-sitter-javascript.wasm",
    query: JAVASCRIPT_QUERY,
  },
  {
    id: "python",
    extensions: [".py", ".pyi"],
    packageName: "tree-sitter-python",
    wasmFile: "tree-sitter-python.wasm",
    query: `
(class_definition) @class
(function_definition) @function
(type_alias_statement) @type
`,
  },
  {
    id: "rust",
    extensions: [".rs"],
    packageName: "tree-sitter-rust",
    wasmFile: "tree-sitter-rust.wasm",
    query: `
(struct_item) @struct
(enum_item) @enum
(union_item) @struct
(type_item) @type
(trait_item) @trait
(impl_item) @implementation
(mod_item) @module
(function_item) @function
(function_signature_item) @method
(macro_definition) @macro
(const_item) @constant
(static_item) @constant
(field_declaration) @field
`,
  },
  {
    id: "go",
    extensions: [".go"],
    packageName: "tree-sitter-go",
    wasmFile: "tree-sitter-go.wasm",
    query: `
(function_declaration) @function
(method_declaration) @method
(method_elem) @method
(type_spec) @type
(const_spec) @constant
(field_declaration) @field
`,
  },
  {
    id: "kotlin",
    extensions: [".kt", ".kts"],
    packageName: "@tree-sitter-grammars/tree-sitter-kotlin",
    wasmFile: "tree-sitter-kotlin.wasm",
    query: `
(class_declaration) @class
(object_declaration) @object
(companion_object) @object
(function_declaration) @function
(secondary_constructor) @constructor
(property_declaration) @property
(type_alias) @type
`,
  },
  {
    id: "bash",
    extensions: [".sh", ".bash", ".zsh", ".ksh"],
    fileNames: [".bashrc", ".bash_profile", ".zshrc", ".zprofile"],
    packageName: "tree-sitter-bash",
    wasmFile: "tree-sitter-bash.wasm",
    query: "(function_definition) @function",
  },
  {
    id: "c",
    extensions: [".c", ".h"],
    wasmFile: "tree-sitter-c.wasm",
    query: C_QUERY,
  },
  {
    id: "cpp",
    extensions: [".cc", ".cp", ".cpp", ".cxx", ".c++", ".hh", ".hpp", ".hxx", ".h++", ".ipp", ".tpp", ".ixx", ".cppm"],
    wasmFile: "tree-sitter-cpp.wasm",
    query: `${C_QUERY}
(class_specifier name: (type_identifier)) @class
(namespace_definition) @namespace
(alias_declaration) @type
(concept_definition) @type
`,
  },
  {
    id: "csharp",
    extensions: [".cs", ".csx"],
    wasmFile: "tree-sitter-c_sharp.wasm",
    query: `
(namespace_declaration) @namespace
(file_scoped_namespace_declaration) @namespace
(class_declaration) @class
(record_declaration) @class
(record_struct_declaration) @struct
(struct_declaration) @struct
(interface_declaration) @interface
(enum_declaration) @enum
(delegate_declaration) @type
(constructor_declaration) @constructor
(method_declaration) @method
(property_declaration) @property
(event_declaration) @property
(field_declaration) @field
`,
  },
  {
    id: "css",
    extensions: [".css"],
    wasmFile: "tree-sitter-css.wasm",
    query: `
(rule_set) @selector
(media_statement) @section
(supports_statement) @section
(keyframes_statement) @section
(namespace_statement) @section
`,
  },
  {
    id: "dart",
    extensions: [".dart"],
    wasmFile: "tree-sitter-dart.wasm",
    query: `
(class_definition) @class
(mixin_declaration) @trait
(extension_declaration) @implementation
(extension_type_declaration) @type
(enum_declaration) @enum
(type_alias) @type
(function_signature) @function
(constructor_signature) @constructor
(factory_constructor_signature) @constructor
(getter_signature) @property
(setter_signature) @property
`,
  },
  {
    id: "elisp",
    extensions: [".el"],
    fileNames: [".emacs"],
    wasmFile: "tree-sitter-elisp.wasm",
    query: `
(function_definition) @function
(macro_definition) @macro
`,
  },
  {
    id: "embedded-template",
    extensions: [".erb", ".ejs"],
    wasmFile: "tree-sitter-embedded_template.wasm",
    query: `
(directive) @section
(output_directive) @property
`,
  },
  {
    id: "html",
    extensions: [".html", ".htm", ".xhtml"],
    wasmFile: "tree-sitter-html.wasm",
    query: `
(element) @element
(script_element) @element
(style_element) @element
`,
  },
  {
    id: "haskell",
    extensions: [".hs", ".lhs", ".hsc"],
    packageName: "tree-sitter-wasm",
    wasmFile: "out/haskell/tree-sitter-haskell.wasm",
    query: `
(module) @module
(data_type) @type
(newtype) @type
(type_synomym) @type
(type_family) @type
(class) @trait
(instance) @implementation
(signature) @function
(function name: (variable)) @function
(foreign_import) @function
`,
  },
  {
    id: "java",
    extensions: [".java"],
    wasmFile: "tree-sitter-java.wasm",
    query: `
(package_declaration) @module
(module_declaration) @module
(class_declaration) @class
(record_declaration) @class
(interface_declaration) @interface
(annotation_type_declaration) @interface
(enum_declaration) @enum
(constructor_declaration) @constructor
(compact_constructor_declaration) @constructor
(method_declaration) @method
(field_declaration) @field
`,
  },
  {
    id: "json",
    extensions: [".json", ".jsonl", ".ndjson"],
    wasmFile: "tree-sitter-json.wasm",
    query: "(pair) @key",
  },
  {
    id: "julia",
    extensions: [".jl"],
    packageName: "tree-sitter-wasm",
    wasmFile: "out/julia/tree-sitter-julia.wasm",
    query: `
(module_definition) @module
(struct_definition) @struct
(function_definition) @function
(macro_definition) @macro
(abstract_definition) @type
(primitive_definition) @type
`,
  },
  {
    id: "lua",
    extensions: [".lua"],
    packageName: "@tree-sitter-grammars/tree-sitter-lua",
    wasmFile: "tree-sitter-lua.wasm",
    query: "(function_declaration) @function",
  },
  {
    id: "objective-c",
    extensions: [".m", ".mm"],
    wasmFile: "tree-sitter-objc.wasm",
    query: `${C_QUERY}
(class_interface) @interface
(class_implementation) @implementation
(protocol_declaration) @interface
(method_declaration) @method
(method_definition) @method
(property_declaration) @property
`,
  },
  {
    id: "ocaml",
    extensions: [".ml", ".mli"],
    wasmFile: "tree-sitter-ocaml.wasm",
    query: `
(module_definition) @module
(module_type_definition) @module
(class_definition) @class
(class_type_definition) @class
(type_definition) @type
(value_definition) @function
(method_definition) @method
(exception_definition) @type
`,
  },
  {
    id: "php",
    extensions: [".php", ".phtml", ".php3", ".php4", ".php5"],
    wasmFile: "tree-sitter-php.wasm",
    query: `
(namespace_definition) @namespace
(class_declaration) @class
(interface_declaration) @interface
(trait_declaration) @trait
(enum_declaration) @enum
(function_definition) @function
(method_declaration) @method
(property_declaration) @property
(const_declaration) @constant
`,
  },
  {
    id: "rescript",
    extensions: [".res", ".resi"],
    wasmFile: "tree-sitter-rescript.wasm",
    query: `
(module_declaration) @module
(type_declaration) @type
(external_declaration) @function
(exception_declaration) @type
(let_binding) @function
`,
  },
  {
    id: "ruby",
    extensions: [".rb", ".rake", ".gemspec"],
    fileNames: ["Gemfile", "Rakefile", "Guardfile", "Podfile", "Vagrantfile"],
    wasmFile: "tree-sitter-ruby.wasm",
    query: `
(module) @module
(class) @class
(singleton_class) @class
(method) @method
(singleton_method) @method
`,
  },
  {
    id: "scala",
    extensions: [".scala", ".sc"],
    wasmFile: "tree-sitter-scala.wasm",
    query: `
(package_clause) @module
(package_object) @object
(object_definition) @object
(class_definition) @class
(trait_definition) @trait
(type_definition) @type
(function_definition) @function
(function_declaration) @function
`,
  },
  {
    id: "solidity",
    extensions: [".sol"],
    wasmFile: "tree-sitter-solidity.wasm",
    query: `
(contract_declaration) @class
(interface_declaration) @interface
(library_declaration) @module
(struct_declaration) @struct
(enum_declaration) @enum
(function_definition) @function
(constructor_definition) @constructor
(modifier_definition) @method
(event_definition) @property
(error_declaration) @type
(state_variable_declaration) @field
(user_defined_type_definition) @type
`,
  },
  {
    id: "swift",
    extensions: [".swift"],
    wasmFile: "tree-sitter-swift.wasm",
    query: `
(class_declaration) @class
(protocol_declaration) @interface
(function_declaration) @function
(protocol_function_declaration) @method
(init_declaration) @constructor
(deinit_declaration) @constructor
(property_declaration) @property
(protocol_property_declaration) @property
(typealias_declaration) @type
(associatedtype_declaration) @type
(macro_declaration) @macro
(macro_definition) @macro
`,
  },
  {
    id: "systemrdl",
    extensions: [".rdl"],
    wasmFile: "tree-sitter-systemrdl.wasm",
    query: `
(component_named_def) @module
(struct_def) @struct
(enum_def) @enum
(property_definition) @property
`,
  },
  {
    id: "systemverilog",
    extensions: [".sv", ".svh", ".v", ".vh"],
    packageName: "tree-sitter-wasm",
    wasmFile: "out/systemverilog/tree-sitter-systemverilog.wasm",
    query: `
(module_declaration) @module
(interface_declaration) @interface
(program_declaration) @module
(package_declaration) @module
(class_declaration) @class
(interface_class_declaration) @interface
(function_declaration) @function
(task_declaration) @function
(class_constructor_declaration) @constructor
(property_declaration) @property
(sequence_declaration) @property
(covergroup_declaration) @section
(type_declaration) @type
(text_macro_definition) @macro
`,
  },
  {
    id: "razor",
    extensions: [".razor", ".cshtml"],
    packageName: "tree-sitter-wasm",
    wasmFile: "out/razor/tree-sitter-razor.wasm",
    query: `
(razor_page_directive) @section
(razor_model_directive) @section
(razor_inherits_directive) @section
(razor_block) @section
(class_declaration) @class
(record_declaration) @class
(struct_declaration) @struct
(interface_declaration) @interface
(enum_declaration) @enum
(constructor_declaration) @constructor
(method_declaration) @method
(property_declaration) @property
(field_declaration) @field
`,
  },
  {
    id: "tlaplus",
    extensions: [".tla"],
    wasmFile: "tree-sitter-tlaplus.wasm",
    query: `
(module) @module
(operator_definition) @function
(function_definition) @function
(module_definition) @module
(pcal_macro_decl) @macro
`,
  },
  {
    id: "toml",
    extensions: [".toml"],
    wasmFile: "tree-sitter-toml.wasm",
    query: `
(table) @section
(table_array_element) @section
(pair) @key
`,
  },
  {
    id: "tree-sitter-query",
    fileNames: ["highlights.scm", "injections.scm", "locals.scm", "tags.scm", "folds.scm", "indents.scm"],
    packageName: "tree-sitter-wasm",
    wasmFile: "out/query/tree-sitter-query.wasm",
    query: `
(named_node) @section
(anonymous_node) @section
(field_definition) @field
(capture) @property
`,
  },
  {
    id: "regex",
    extensions: [".regex"],
    packageName: "tree-sitter-wasm",
    wasmFile: "out/regex/tree-sitter-regex.wasm",
    query: `
(named_capturing_group) @section
(anonymous_capturing_group) @section
(non_capturing_group) @section
(inline_flags_group) @section
`,
  },
  {
    id: "vue",
    extensions: [".vue"],
    wasmFile: "tree-sitter-vue.wasm",
    query: `
(template_element) @section
(script_element) @section
(style_element) @section
(element) @element
`,
  },
  {
    id: "yaml",
    extensions: [".yaml", ".yml"],
    packageName: "@tree-sitter-grammars/tree-sitter-yaml",
    wasmFile: "tree-sitter-yaml.wasm",
    query: `
(block_mapping_pair) @key
(flow_pair) @key
`,
  },
  {
    id: "zig",
    extensions: [".zig"],
    wasmFile: "tree-sitter-zig.wasm",
    query: `
(function_declaration) @function
(test_declaration) @function
(opaque_declaration) @type
(error_set_declaration) @type
(variable_declaration) @constant
`,
  },
];

const languagePromises = new Map<string, Promise<Language>>();

function looksLikeCppHeader(source: string): boolean {
  return /(?:^|\n)\s*(?:namespace\s+\w|template\s*<|class\s+\w|constexpr\b|#include\s*<(?:iostream|vector|string|memory)>)/m.test(source);
}

export function detectLanguage(path: string, source: string): LanguageSpec | undefined {
  const name = basename(path);
  const extension = extname(name).toLowerCase();
  if (extension === ".scm" && /(?:^|\/)queries\//.test(path.replaceAll("\\", "/"))) {
    return LANGUAGE_SPECS.find((spec) => spec.id === "tree-sitter-query");
  }
  if (extension === ".h" && looksLikeCppHeader(source)) return LANGUAGE_SPECS.find((spec) => spec.id === "cpp");
  const direct = LANGUAGE_SPECS.find(
    (candidate) => candidate.extensions?.includes(extension) || candidate.fileNames?.includes(name),
  );
  if (direct) return direct;

  const firstLine = source.split(/\r?\n/, 1)[0] ?? "";
  const shebangs: Array<[RegExp, string]> = [
    [/^#!.*\b(?:ba|z|k)?sh\b/, "bash"],
    [/^#!.*\bpython(?:\d+(?:\.\d+)*)?\b/, "python"],
    [/^#!.*\b(?:node|deno|bun)\b/, "javascript"],
    [/^#!.*\bruby(?:\d+(?:\.\d+)*)?\b/, "ruby"],
    [/^#!.*\blua(?:\d+(?:\.\d+)*)?\b/, "lua"],
  ];
  const match = shebangs.find(([pattern]) => pattern.test(firstLine));
  return match ? LANGUAGE_SPECS.find((spec) => spec.id === match[1]) : undefined;
}

export async function loadShapeLanguage(spec: LanguageSpec): Promise<Language> {
  let pending = languagePromises.get(spec.id);
  if (!pending) {
    pending = (async () => {
      await initializeTreeSitter();
      const directory = spec.packageName
        ? dirname(require.resolve(`${spec.packageName}/package.json`))
        : join(dirname(require.resolve("tree-sitter-wasms/package.json")), "out");
      return Language.load(join(directory, spec.wasmFile));
    })();
    languagePromises.set(spec.id, pending);
  }
  return pending;
}

export function supportedLanguages(): string[] {
  return LANGUAGE_SPECS.map((spec) => spec.id);
}
