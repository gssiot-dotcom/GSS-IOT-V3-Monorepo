import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const sourceRoot = path.join(root, "apps", "web", "src");

function filesUnder(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? filesUnder(target) : [target];
  });
}

function catalog(file, name) {
  const source = fs.readFileSync(file, "utf8");
  const start = source.indexOf(`export const ${name} =`);
  const end = source.lastIndexOf("} as const");
  if (start < 0 || end < 0) throw new Error(`Cannot parse ${file}`);
  const objectSource = source.slice(source.indexOf("{", start), end + 1);
  return Function(`"use strict"; return (${objectSource});`)();
}

const en = catalog(path.join(sourceRoot, "app", "i18n", "locales", "en.ts"), "en");
const ko = catalog(path.join(sourceRoot, "app", "i18n", "locales", "ko.ts"), "ko");
const errors = [];
const enKeys = Object.keys(en).sort();
const koKeys = Object.keys(ko).sort();
if (JSON.stringify(enKeys) !== JSON.stringify(koKeys)) {
  errors.push("English and Korean catalogs do not have identical keys.");
}

const placeholders = (value) =>
  [...value.matchAll(/\{([A-Za-z0-9_]+)\}/g)].map((item) => item[1]).sort();
for (const key of enKeys) {
  if (JSON.stringify(placeholders(en[key])) !== JSON.stringify(placeholders(ko[key]))) {
    errors.push(`Placeholder mismatch: ${key}`);
  }
}

for (const file of filesUnder(sourceRoot)) {
  if (
    !/\.tsx?$/.test(file) ||
    file.includes(`${path.sep}app${path.sep}i18n${path.sep}`) ||
    file.includes(`${path.sep}test${path.sep}`)
  )
    continue;
  const relative = path.relative(root, file).replaceAll("\\", "/");
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
  lines.forEach((line, index) => {
    if (/\.toLocale(?:Date|Time|String)\s*\(/.test(line)) {
      errors.push(`${relative}:${index + 1}: implicit locale formatter`);
    }
    if (/\b(?:t|tf)\([^)]*as never/.test(line)) {
      errors.push(`${relative}:${index + 1}: unsafe dynamic translation key cast`);
    }
    if (
      /Intl\.(?:DateTimeFormat|NumberFormat|RelativeTimeFormat)\(\s*(?:undefined)?\s*[,)]/.test(
        line,
      )
    ) {
      errors.push(`${relative}:${index + 1}: implicit Intl locale`);
    }
    if (file.endsWith(".tsx")) {
      if (
        /(?:aria-label|description|label|placeholder|title)=["'][A-Za-z\u3131-\uD79D][^"']*["']/.test(
          line,
        )
      ) {
        errors.push(`${relative}:${index + 1}: direct user-facing JSX attribute`);
      }
      const match = line.match(/>\s*([^<>{}]+?)\s*<\/[A-Za-z]/);
      const text = match?.[1].trim();
      if (text && /[A-Za-z\u3131-\uD79D]/.test(text) && !/^[-+/:\d\s.%]+$/.test(text)) {
        errors.push(`${relative}:${index + 1}: visible JSX text: ${text.slice(0, 80)}`);
      }
    }
  });
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log(
  `i18n audit passed (${enKeys.length} keys, KO/EN placeholder parity, no implicit locale formatting or JSX literals).`,
);
