const express = require('express');
const path = require('path');
const apiRouter = require('./src/routes/api');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '15mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/api', apiRouter);

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Resume ATS Alignment Studio running at http://localhost:${PORT}`);
});
