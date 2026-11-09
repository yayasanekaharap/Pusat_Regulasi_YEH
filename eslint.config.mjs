/* ESLint 9 flat config. Cloudflare tidak menjalankan ini; asisten yang
 * menjalankannya sebelum berkas diserahkan.
 *
 * Catatan lingkup: berkas Apps Script TIDAK ada di repo ini — letaknya di
 * folder clasp tersendiri (D:\GAS Project\PusatRegulasiYEH), sesuai keadaan
 * repo saat ini. Karena itu lint di sini hanya mencakup berkas web; berkas
 * gas di-lint terpisah dengan aturan yang sama, digabungkan lebih dahulu
 * menjadi satu lingkup global seperti cara Apps Script memuatnya.
 */
export default [
  {
    ignores: ['build/**', 'node_modules/**', 'supabase/functions/**']
  },
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: {
        window: 'readonly', document: 'readonly', location: 'readonly',
        fetch: 'readonly', AbortController: 'readonly', performance: 'readonly',
        localStorage: 'readonly', indexedDB: 'readonly', IntersectionObserver: 'readonly',
        setTimeout: 'readonly', clearTimeout: 'readonly', requestAnimationFrame: 'readonly',
        navigator: 'readonly', Node: 'readonly', Promise: 'readonly',
        console: 'readonly', JSON: 'readonly', Math: 'readonly', Date: 'readonly',
        Object: 'readonly', Array: 'readonly', String: 'readonly', Number: 'readonly',
        Boolean: 'readonly', Error: 'readonly', Set: 'readonly', Map: 'readonly',
        Uint16Array: 'readonly', TextDecoder: 'readonly', TextEncoder: 'readonly',
        isNaN: 'readonly', parseInt: 'readonly', parseFloat: 'readonly', RegExp: 'readonly',
        atob: 'readonly', btoa: 'readonly', crypto: 'readonly',
        sessionStorage: 'readonly', history: 'readonly', getComputedStyle: 'readonly',
        NodeFilter: 'readonly', URL: 'readonly', Blob: 'readonly', matchMedia: 'readonly'
      }
    },
    linterOptions: { reportUnusedDisableDirectives: true },
    rules: {
      'no-undef': 'error',
      // caughtErrors: 'none' — ESLint 9 mengubah bawaannya, sehingga blok
      // catch yang memang sengaja kosong akan ditandai sebagai galat.
      'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none' }],
      'no-redeclare': 'error',
      'no-dupe-keys': 'error',
      'no-dupe-args': 'error',
      'no-unreachable': 'error',
      'no-cond-assign': 'error',
      'no-constant-condition': 'error',
      'no-irregular-whitespace': 'error'
    }
  },
  {
    files: ['build.mjs'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { console: 'readonly', process: 'readonly' }
    },
    rules: { 'no-undef': 'error', 'no-unused-vars': 'error' }
  }
];
