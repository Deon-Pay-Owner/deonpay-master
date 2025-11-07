const fs = require('fs');
const path = require('path');

// Read tokens.json
const tokens = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'tokens.json'), 'utf-8')
);

// Generate CSS
let css = '/* DeonPay Design Tokens - Auto-generated */\n\n';

// Light theme
css += ':root[data-theme="light"] {\n';
Object.entries(tokens.color.light).forEach(([key, { value }]) => {
  css += `  --color-${key}: ${value};\n`;
});
css += '}\n\n';

// Dark theme
css += ':root[data-theme="dark"] {\n';
Object.entries(tokens.color.dark).forEach(([key, { value }]) => {
  css += `  --color-${key}: ${value};\n`;
});
css += '}\n\n';

// Default to light theme
css += ':root {\n';
Object.entries(tokens.color.light).forEach(([key, { value }]) => {
  css += `  --color-${key}: ${value};\n`;
});
css += '}\n\n';

// Radius
css += ':root {\n';
Object.entries(tokens.radius).forEach(([key, { value }]) => {
  css += `  --radius-${key}: ${value};\n`;
});
css += '}\n\n';

// Shadow
css += ':root {\n';
Object.entries(tokens.shadow).forEach(([key, { value }]) => {
  css += `  --shadow-${key}: ${value};\n`;
});
css += '}\n\n';

// Spacing
css += ':root {\n';
Object.entries(tokens.spacing).forEach(([key, { value }]) => {
  css += `  --spacing-${key}: ${value};\n`;
});
css += '}\n\n';

// Font
css += ':root {\n';
Object.entries(tokens.font).forEach(([key, { value }]) => {
  css += `  --font-${key}: ${value};\n`;
});
css += '}\n\n';

// Font Size
css += ':root {\n';
Object.entries(tokens.fontSize).forEach(([key, { value }]) => {
  css += `  --fontSize-${key}: ${value};\n`;
});
css += '}\n';

// Create dist directory if it doesn't exist
const distDir = path.join(__dirname, 'dist');
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// Write CSS file
fs.writeFileSync(path.join(distDir, 'tokens.css'), css);

// Write JS export
const jsContent = `export const tokens = ${JSON.stringify(tokens, null, 2)};\n`;
fs.writeFileSync(path.join(distDir, 'tokens.js'), jsContent);

// Write TS types
const tsContent = `export const tokens: any;\n`;
fs.writeFileSync(path.join(distDir, 'tokens.d.ts'), tsContent);

console.log('✅ Design tokens built successfully!');
console.log('   - dist/tokens.css');
console.log('   - dist/tokens.js');
console.log('   - dist/tokens.d.ts');
