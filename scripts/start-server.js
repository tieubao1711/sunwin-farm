require('./kill-port').killPort(Number(process.env.API_PORT || 5610));
require('../server/index');
