/**
 * Lawn Buddy - Cloudflare Worker
 * Lawn care management application
 */

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // API Routes
    if (url.pathname === '/api/health') {
      return new Response(JSON.stringify({ status: 'ok', app: 'Lawn Buddy' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Default response
    return new Response(
      JSON.stringify({
        message: 'Welcome to Lawn Buddy API',
        version: '0.1.0',
        endpoints: ['/api/health'],
      }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  },
};
