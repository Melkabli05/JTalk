// @ts-check
const eslint = require('@eslint/js');
const { defineConfig } = require('eslint/config');
const tseslint = require('typescript-eslint');
const angular = require('angular-eslint');

// Relative paths that climb into one of the app's own top-level folders, e.g. ../../core/auth.
const climbsInto = (...folders) => `^(\\.\\./)+(${folders.join('|')})(/|$)`;
const restrict = (message, { group, regex }) => [
  'error',
  {
    patterns: [...(group ? [{ message, group }] : []), ...(regex ? [{ message, regex }] : [])],
  },
];

// Text from the model or a user must never become markup: no bypassing Angular's sanitizer, no raw HTML writes.
const unsafeHtml = [
  {
    selector: 'CallExpression[callee.property.name=/^bypassSecurityTrust/]',
    message: 'Never bypass the sanitizer: show untrusted text as text.',
  },
  {
    selector: 'AssignmentExpression[left.property.name=/^(innerHTML|outerHTML)$/]',
    message: 'Do not write HTML into the page: render with templates, which escape text.',
  },
];

module.exports = defineConfig([
  {
    files: ['**/*.ts'],
    extends: [
      eslint.configs.recommended,
      tseslint.configs.recommendedTypeChecked,
      tseslint.configs.stylisticTypeChecked,
      angular.configs.tsRecommended,
    ],
    processor: angular.processInlineTemplates,
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: __dirname },
    },
    rules: {
      '@typescript-eslint/no-deprecated': 'error',
      // Modern Angular: signals everywhere, no decorators or emitters where a function exists.
      '@angular-eslint/prefer-signals': 'error',
      '@angular-eslint/prefer-signal-model': 'error',
      '@angular-eslint/prefer-output-emitter-ref': 'error',
      '@angular-eslint/prefer-output-readonly': 'error',
      '@angular-eslint/prefer-host-metadata-property': 'error',
      '@angular-eslint/prefer-service-decorator': 'error',
      '@angular-eslint/no-uncalled-signals': 'error',
      '@angular-eslint/computed-must-return': 'error',
      '@angular-eslint/reactive-context-must-read-signal': 'error',
      '@angular-eslint/no-implicit-take-until-destroyed': 'error',
      '@angular-eslint/inject-at-top': 'error',
      '@angular-eslint/no-developer-preview': 'error',
      '@angular-eslint/no-experimental': 'error',
      '@angular-eslint/directive-selector': [
        'error',
        {
          type: 'attribute',
          prefix: 'app',
          style: 'camelCase',
        },
      ],
      '@angular-eslint/component-selector': [
        'error',
        {
          type: 'element',
          prefix: 'app',
          style: 'kebab-case',
        },
      ],
    },
  },
  {
    files: ['src/app/**/*.ts'],
    ignores: ['**/*.spec.ts'],
    rules: { 'no-restricted-syntax': ['error', ...unsafeHtml] },
  },
  // Dependency direction: features and layout -> core, shared; core -> shared; shared -> nothing.
  // Features never import each other, and nothing imports from layout/ (it is wired in app.routes).
  {
    files: ['src/app/shared/**/*.ts'],
    rules: {
      'no-restricted-imports': restrict(
        'shared/ is reusable: it must not depend on core/, layout/ or features/.',
        { group: ['@core/*'], regex: climbsInto('core', 'layout', 'features') },
      ),
    },
  },
  {
    files: ['src/app/core/**/*.ts'],
    rules: {
      'no-restricted-imports': restrict('core/ must not depend on layout/ or features/.', {
        regex: climbsInto('layout', 'features'),
      }),
    },
  },
  {
    files: ['src/app/layout/**/*.ts'],
    rules: {
      'no-restricted-imports': restrict('layout/ must not depend on features/.', {
        regex: climbsInto('features'),
      }),
    },
  },
  // A file N folders below features/ leaves its feature as soon as it climbs N-1 levels.
  ...[2, 3, 4, 5, 6, 7].map((depth) => ({
    files: [`src/app/features/${Array(depth).fill('*').join('/')}.ts`],
    rules: {
      'no-restricted-imports': restrict(
        'Features must not import each other. Move shared code to shared/ or core/.',
        { group: [`${'../'.repeat(depth - 1)}*`] },
      ),
    },
  })),
  // A feature's utils/ are pure functions over its models: they reach neither the HTTP layer, nor components, nor other features.
  // (This block repeats the "features never import each other" pattern for depth 3, because a later block replaces the earlier one.)
  {
    files: ['src/app/features/*/utils/*.ts'],
    rules: {
      'no-restricted-imports': restrict(
        "utils/ only use the feature's models: no data-access/, ui/ or pages/, and no other feature.",
        { group: ['../../*', '../data-access/*', '../ui/*', '../pages/*'] },
      ),
    },
  },
  // Smart/dumb, enforced from the other side: ONLY containers may touch services. A container is a
  // component under `pages/` or `layout/shell/`. Every other component is presentational: it gets data
  // through input() and reports through output(), and cannot inject, import a service, reach the HTTP layer,
  // touch the router (not even RouterLink), or start a resource.
  {
    files: ['src/app/**/*.component.ts'],
    ignores: [
      '**/*.spec.ts',
      'src/app/**/pages/*/*-page.component.ts', // a routed page is a container...
      'src/app/layout/shell/app-shell.component.ts', // ...and so is the shell. Nothing else is.
    ],
    rules: {
      'no-restricted-syntax': [
        'error',
        ...[
          [
            "CallExpression[callee.name='inject']",
            'inject() is for containers. Take the data as an input() and emit an output() instead.',
          ],
          [
            "ImportDeclaration[source.value='@angular/core'] > ImportSpecifier[imported.name=/^(inject|Injector|EnvironmentInjector|Service|Injectable|resource)$/]",
            'Dependency injection and resources are for containers (pages/ and layout/shell/).',
          ],
          [
            "ImportDeclaration[source.value='@angular/core/rxjs-interop'] > ImportSpecifier[imported.name=/^(rxResource|toSignal)$/]",
            'Loading data is a container job. Receive it through an input().',
          ],
          [
            "MethodDefinition[kind='constructor'] > FunctionExpression[params.length>0]",
            'Constructor parameters are injection. Use input() for data and output() for events.',
          ],
          [
            "Decorator[expression.callee.name='Component'] Property[key.name=/^(providers|viewProviders)$/]",
            'A component that provides services is a container (pages/*-page or the shell).',
          ],
          [
            'ImportDeclaration[source.value=/\\.(service|store|facade)$/]',
            'A service, store or facade import means this is a container.',
          ],
          [
            'ImportDeclaration[source.value=/\\/state\\//]',
            'Feature state is used by containers only.',
          ],
          [
            "ImportDeclaration[importKind!='type'][source.value='@angular/common/http']",
            'The HTTP layer belongs to data-access, used by a container.',
          ],
          [
            "ImportDeclaration[importKind!='type'][source.value='@angular/router']",
            'The router is a container job: emit an output() and let the container navigate.',
          ],
          [
            'ImportDeclaration[source.value=/data-access/]',
            'data-access is used by containers only.',
          ],
          [
            "ImportDeclaration[importKind!='type'][source.value=/^@core\\//]",
            'Presentational components must not depend on core/ (type-only imports are fine).',
          ],
        ].map(([selector, message]) => ({
          selector,
          message: `Presentational component: ${message}`,
        })),
        ...unsafeHtml,
      ],
    },
  },
  {
    files: ['**/*.html'],
    extends: [angular.configs.templateRecommended, angular.configs.templateAccessibility],
    rules: {
      // `<button pButton label="Save">` gets its text from the Optimus `label` input.
      '@angular-eslint/template/elements-content': ['error', { allowList: ['label'] }],
      // Modern template syntax and built-ins.
      '@angular-eslint/template/prefer-at-else': 'error',
      '@angular-eslint/template/prefer-at-empty': 'error',
      '@angular-eslint/template/prefer-built-in-pipes': 'error',
      '@angular-eslint/template/prefer-class-binding': 'error',
      '@angular-eslint/template/prefer-style-binding': 'error',
      '@angular-eslint/template/prefer-contextual-for-variables': 'error',
      '@angular-eslint/template/prefer-self-closing-tags': 'error',
      '@angular-eslint/template/prefer-ngsrc': 'error',
      '@angular-eslint/template/prefer-template-literal': 'error',
      '@angular-eslint/template/prefer-static-string-properties': 'error',
      '@angular-eslint/template/no-interpolation-in-attributes': 'error',
      '@angular-eslint/template/no-negated-async': 'error',
      '@angular-eslint/template/no-non-null-assertion': 'error',
      '@angular-eslint/template/button-has-type': 'error',
    },
  },
]);
