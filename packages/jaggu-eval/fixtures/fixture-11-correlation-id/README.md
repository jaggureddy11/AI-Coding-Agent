# Fixture 11: Request Correlation ID Tracing

Express-style HTTP request pipeline.
Requires implementation of `X-Correlation-ID` middleware that reads an existing ID or generates a UUID, attaches it to the response header, and propagates it to a request-scoped logger context.
