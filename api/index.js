export default async function handler(req, res) {
  try {
    const { app } = await import('../server/index.js');
    return app(req, res);
  } catch (err) {
    console.error('[API Handler Error]:', err);
    return res.status(500).json({
      error: 'Module Import Error',
      name: err.name,
      message: err.message,
      stack: err.stack
    });
  }
}
