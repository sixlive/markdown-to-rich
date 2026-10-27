# Markdown to Rich Text

A free, private Markdown to rich text converter for Slack, Google Docs, Word and Gmail.

Everything runs in your browser and nothing you type is sent anywhere. A Content Security Policy only lets the page reach its [Umami](https://umami.is) analytics server, which counts page views.

**Live at [markdowntorich.com](https://markdowntorich.com)**

- Code blocks keep their lines and indentation.
- Tables, task lists and strikethrough (GitHub Flavored Markdown).
- Open or drop a `.md` file.

## Development

```bash
npm install
npm run dev     # http://localhost:5179
npm test
npm run build   # tests, type check, then build to dist/
```

Deploys as a static site on Cloudflare Pages: build command `npm run build`, output directory `dist`.

## License

MIT
