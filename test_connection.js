// Simple connection test script
const http = require('http');

console.log('Testing connection to localhost:1180...');

const options = {
    hostname: 'localhost',
    port: 1180,
    path: '/',
    method: 'GET',
    headers: {
        'Content-Type': 'application/json'
    }
};

const req = http.request(options, (res) => {
    console.log(`Status: ${res.statusCode}`);
    console.log(`Headers:`, res.headers);

    let data = '';
    res.on('data', (chunk) => {
        data += chunk;
    });

    res.on('end', () => {
        console.log('Connection successful!');
        console.log('Response received (first 200 chars):', data.substring(0, 200));
    });
});

req.on('error', (e) => {
    console.error('Connection failed:', e.message);
});

req.setTimeout(5000, () => {
    console.error('Connection timeout');
    req.destroy();
});

req.end();

console.log('Request sent, waiting for response...');
