/** Reject unlocalized student copy and incomplete catalogues in every supported language. */
import ts from 'typescript';
import { messages, normalizeMessage } from '../src/i18n/translate';
import { validateCatalogs } from '../src/i18n/validate';
import { SUPPORTED_LOCALES } from '../src/i18n/locale';
const untranslated = new Set<string>(validateCatalogs());
const invariant = new Set(['XP', 'VS', 'TT:', 'ms', 's', 'vs', 'WASM', 'H0', 'H1', 'H2', 'H3', 'Atari', 'Snapback', 'Nex']);
function check(text: string, file: string) {
  const key = normalizeMessage(text);
  if (!/\p{L}/u.test(key) || invariant.has(key) || /^https?:|^wss?:|^projetosdre\./.test(key)) return;
  if (!Object.hasOwn(messages, key)) untranslated.add(`${file}: ${key}`);
}
for (const locale of SUPPORTED_LOCALES) {
  const file = `src/i18n/${locale}.json`;
  const source = ts.parseJsonText(file, await Bun.file(file).text());
  const seen = new Set<string>();
  function checkDuplicates(node: ts.Node) {
    if (ts.isPropertyAssignment(node) && ts.isStringLiteral(node.name)) {
      if (seen.has(node.name.text)) untranslated.add(`${file}: duplicate key: ${node.name.text}`);
      seen.add(node.name.text);
    }
    ts.forEachChild(node, checkDuplicates);
  }
  checkDuplicates(source);
}
for (const file of new Bun.Glob('src/**/*.tsx').scanSync('.')) {
  if (/\.test\.|Admin|admin\/|vignettes|frontend/.test(file)) continue;
  const source = ts.createSourceFile(file, await Bun.file(file).text(), ts.ScriptTarget.Latest, true);
  function displayValue(node: ts.Node) {
    if (ts.isStringLiteralLike(node)) check(node.text, file);
    else if (ts.isTemplateExpression(node)) {
      const key = node.head.text + node.templateSpans.map((span, i) => `{${i}}${span.literal.text}`).join('');
      check(key, file);
    } else if (ts.isConditionalExpression(node)) { displayValue(node.whenTrue); displayValue(node.whenFalse); }
    else if (ts.isBinaryExpression(node) && [ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken].includes(node.operatorToken.kind)) {
      displayValue(node.left); displayValue(node.right);
    }
  }
  function unwrapped(node: ts.Node, context: string) {
    if (ts.isStringLiteralLike(node) && /\p{L}/u.test(node.text)) untranslated.add(`${file}: unwrapped ${context}: ${node.text}`);
    else if (ts.isTemplateExpression(node) && /\p{L}/u.test(node.head.text + node.templateSpans.map(span => span.literal.text).join(''))) untranslated.add(`${file}: unwrapped ${context}: ${node.getText(source)}`);
    else if (ts.isConditionalExpression(node)) { unwrapped(node.whenTrue, context); unwrapped(node.whenFalse, context); }
    else if (ts.isBinaryExpression(node) && [ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken].includes(node.operatorToken.kind)) { unwrapped(node.left, context); unwrapped(node.right, context); }
  }
  function visit(node: ts.Node) {
    if (ts.isCallExpression(node) && ['t', 'msg'].includes(node.expression.getText(source)) && node.arguments[0]) displayValue(node.arguments[0]);
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === 'REGRAS' && node.initializer && ts.isArrayLiteralExpression(node.initializer)) node.initializer.elements.forEach(displayValue);
    // Direct visible text should always pass through t, except punctuation/emoji.
    if (ts.isJsxText(node) && /\p{L}/u.test(node.text)) untranslated.add(`${file}: unwrapped JSX: ${normalizeMessage(node.text)}`);
    if (ts.isJsxAttribute(node) && ['aria-label', 'title', 'placeholder', 'alt'].includes(node.name.getText(source))) {
      const value = node.initializer;
      if (value && ts.isStringLiteral(value)) unwrapped(value, node.name.getText(source));
      if (value && ts.isJsxExpression(value) && value.expression) unwrapped(value.expression, node.name.getText(source));
    }
    if (ts.isJsxExpression(node) && node.expression && (ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent))) unwrapped(node.expression, 'JSX expression');
    ts.forEachChild(node, visit);
  }
  visit(source);
}
if (untranslated.size) {
  console.error([...untranslated].join('\n'));
  process.exitCode = 1;
} else console.log(`${SUPPORTED_LOCALES.join(", ")}: ${Object.keys(messages).length} messages each; catalogue parity, placeholders, JSX, accessible labels and game rules covered.`);
