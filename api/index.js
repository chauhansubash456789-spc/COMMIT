let appInstance = null;
let initError = null;

async function getApp() {
  if (appInstance) return appInstance;
  try {
    const serverModule = await import('../server/index.js');
    appInstance = serverModule.app || serverModule.default;
    return appInstance;
  } catch (err) {
    initError = {
      message: err.message,
      stack: err.stack,
      name: err.name
    };
    console.error('[Vercel Serverless Function Init Error]:', err);
    throw err;
  }
}

export default async function handler(req, res) {
  try {
    const app = await getApp();
    return app(req, res);
  } catch (err) {
    return res.status(500).json({
      error: 'Vercel Serverless Init Error',
      message: err.message,
      stack: err.stack,
      initError
    });
  }
}
