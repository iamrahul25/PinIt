export const checkGraphicsAcceleration = () => {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    
    if (!gl) {
      console.log('WebGL not supported - Graphics acceleration likely disabled');
      return false;
    }
    
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    
    if (debugInfo) {
      const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
      const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
      
      console.log('Renderer:', renderer);
      console.log('Vendor:', vendor);
      
      // Enhanced detection for software rendering
      const softwareIndicators = [
        'swiftshader',
        'llvmpipe',
        'software',
        'mesa',
        'basic render driver',           // Windows software renderer
        'microsoft basic display',        // Windows basic adapter
        'gdi generic',                    // Windows GDI fallback
        '0x0000008c',                     // Device ID for Basic Render Driver
        'chromium'                        // Sometimes indicates software rendering
      ];
      
      const rendererLower = renderer.toLowerCase();
      const isSoftwareRenderer = softwareIndicators.some(indicator => 
        rendererLower.includes(indicator)
      );
      
      if (isSoftwareRenderer) {
        console.log('Software rendering detected - Graphics acceleration is OFF');
        return false;
      } else {
        console.log('Hardware rendering detected - Graphics acceleration is ON');
        return true;
      }
    } else {
      console.log('Unable to determine renderer info');
      return null; // Unknown state
    }
  } catch (error) {
    console.error('Error checking graphics acceleration:', error);
    return false;
  }
};