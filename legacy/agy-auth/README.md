# agy-auth

WARNING: `@badaruddinl/agy-auth` has moved to [`@badaruddinl/agy-authx`](https://www.npmjs.com/package/@badaruddinl/agy-authx).

This `0.1.17` package is a compatibility bridge. It installs `@badaruddinl/agy-authx@0.1.17` and keeps both commands available:

```bash
agy-auth status
agy-authx status
```

For new installs, use:

```bash
npm install -g @badaruddinl/agy-authx
```

Existing saved sessions remain compatible because the underlying credential service names are unchanged.
