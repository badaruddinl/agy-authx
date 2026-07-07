# agy-auth

WARNING: `@badaruddinl/agy-auth` has moved to [`@badaruddinl/agy-authx`](https://www.npmjs.com/package/@badaruddinl/agy-authx).

This package is a compatibility bridge. It installs `@badaruddinl/agy-authx` and keeps the old command available:

```bash
agy-auth status
```

`agy-auth` runs the `agy-authx` implementation, so `agy-auth --version` reports `agy-authx <version>`.

For new installs, use:

```bash
npm install -g @badaruddinl/agy-authx
```

Existing saved sessions remain compatible because the underlying credential service names are unchanged.
