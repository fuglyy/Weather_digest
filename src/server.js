import { app } from './app.js';
import { config } from './config.js';

app.listen(config.port, () => {
  console.log(`Weather maintenance API is listening on port ${config.port}`);
});