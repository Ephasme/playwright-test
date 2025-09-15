// @ts-check

import { defineConfig } from 'eslint/config';
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';

export default defineConfig([
    eslint.configs.recommended,
    ...tseslint.configs.recommendedTypeChecked,
    {
        languageOptions: {
            parserOptions: {
                projectService: true,
                tsconfigRootDir: import.meta.dirname,
            },
        },
    },
    eslintConfigPrettier,
    {
        files: ['**/*.{js,mjs,cjs,ts}'],
        rules: {
            // Add any custom rules here
        },
    },
    {
        ignores: [
            'dist/**',
            'node_modules/**',
            '*.config.js',
            '*.config.mjs',
            '.next/**',
            'coverage/**',
        ],
    },
]);
