# Markdown to Rich Text

Convert Markdown to rich text that keeps its line breaks when you paste it into Slack, Google Docs, Word or Gmail.

**Live at [markdowntorich.com](https://markdowntorich.com)**

- A single Enter is a new line, and extra blank lines are kept. Both are toggles.
- Blocks are separated by a real empty line, so spacing survives apps that ignore CSS margins.
- Code blocks keep their lines and indentation.
- Tables, task lists and strikethrough (GitHub Flavored Markdown).
- Open or drop a `.md` file.

Everything runs in your browser. A Content Security Policy (`connect-src 'none'`) blocks the page from making network requests.

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
