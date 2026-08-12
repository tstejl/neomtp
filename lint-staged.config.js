module.exports = {
  '*.{js,jsx,mjs}': ['bun run lint', 'bun run postlint-fix', 'git add'],
  '{*.json,.{babelrc,eslintrc,prettierrc,stylelintrc}}': [
    'prettier --ignore-path .eslintignore --parser json --write',
    'git add',
  ],
  '*.{css,scss}': [
    'bun run lint-styles',
    'bun run postlint-styles-fix',
    'git add',
  ],
  '*.{html,md,yml}': [
    'prettier --ignore-path .eslintignore --single-quote --write',
    'git add',
  ],
  '*.{js,jsx,mjs,ts,tsx,css,scss,html,md,yml}': ['git add'],
};
