const http = require('http');

function apPeriodicInform(args, callback) {
  const payload = args[0];
  const req = http.request(
    {
      host: '127.0.0.1',
      port: 3300,
      path: '/inform',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    },
    (res) => {
      if (res.statusCode !== 202) {
        callback(
          new Error(`Request failed (status code: ${res.statusCode})`)
        );
      }
      let rawData = "";
      res.on("data", (chunk) => (rawData += chunk));
      res.on('end', () => {
        callback(null, {inform: "success"});
      });
      res.on('error', (e) => {
        callback(
          new Error("Request failed " + e)
        );
      });
    });

  req.on('error', (e) => {
    callback(
      new Error("Request failed " + e)
    );
  });
  req.write(payload);
  req.end();
}

exports.apPeriodicInform = apPeriodicInform;
