const http = require('http');
var zmq = require('zeromq');
const url = process.env.ZERO_MQ_URL ? process.env.ZERO_MQ_URL : "tcp://*:55592";
const topic = "ACS_AP_PERIODIC_INFORM_EVENTS";

var informPub = zmq.socket('pub');
informPub.bindSync(url);
function sendMsg(data) {
  if (data) {
    informPub.send([topic, data], function(error) {
      if (error) {
        console.error(error);
      }
    });
  }
}

const server = http.createServer();
server.on('request', (req, res) => {
  if (req.url === '/inform' && req.method === "POST") {
    var body = "";
    req.on("data", function(chunk) {
      body += chunk;
    });

    req.on("end", function() {
      sendMsg(body);
      res.writeHead(202);
      res.write("");
      res.end();
    });
  } else {
    res.writeHead(404);
    res.write("Not Found");
    res.end();
  }
});

server.listen(3300);
