export function registerRoutes(app: { get: (path: string, handler: unknown) => void }): void {
  // Existing baseline routes
  app.get('/api/ping', () => 'pong');
}
