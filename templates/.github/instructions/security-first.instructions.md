## Security-First Development

Apply these security practices in all code:

- **Input validation**: Validate all external input at system boundaries
- **Output encoding**: Encode output based on context (HTML, URL, SQL, OS command)
- **Authentication**: Use established libraries; never roll your own crypto
- **Authorization**: Check permissions at every access point, not just the UI
- **Secrets management**: Use environment variables or secret managers, never hardcode
- **Dependency hygiene**: Keep dependencies updated; run `npm audit` / `pip audit` regularly
- **Logging**: Never log sensitive data (passwords, tokens, PII)
- **Error handling**: Return generic errors to users; log detailed errors server-side
- **HTTPS**: Enforce TLS for all network communication
- **CORS**: Configure allowed origins explicitly; never use wildcard in production
