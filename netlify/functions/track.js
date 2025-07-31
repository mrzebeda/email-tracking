exports.handler = async (event, context) => {
  const { email, campaign } = event.queryStringParameters || {};
  
  // Log de open (je kunt dit later uitbreiden naar database)
  console.log(`Email opened: ${email}, Campaign: ${campaign}, Time: ${new Date().toISOString()}`);
  
  // 1x1 transparante PNG pixel
  const pixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
  
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Access-Control-Allow-Origin': '*'
    },
    body: pixel.toString('base64'),
    isBase64Encoded: true
  };
};
