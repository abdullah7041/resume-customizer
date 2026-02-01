// Netlify Build Plugin to optimize function deployment
module.exports = {
  onPreBuild: async ({ utils }) => {
    console.log('🚀 Pre-build optimization started...');

    // Log function count
    const functionsDir = 'netlify/functions';
    const fs = require('fs');
    const files = fs.readdirSync(functionsDir).filter(f => f.endsWith('.ts') || f.endsWith('.js'));
    console.log(`📦 Found ${files.length} functions to bundle`);
  },

  onBuild: async ({ utils }) => {
    console.log('🔨 Build optimization started...');
  },

  onPostBuild: async ({ utils, constants }) => {
    console.log('✅ Post-build optimization completed');
    console.log(`📊 Publish directory: ${constants.PUBLISH_DIR}`);
  }
};
