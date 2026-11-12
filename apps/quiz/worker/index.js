import { app } from './app.js';
import { dispatchJobs } from './jobs/dispatch.js';
import { recoverJobs } from './jobs/recovery.js';

export default {
  fetch: app.fetch,
  queue: dispatchJobs,
  scheduled: recoverJobs,
};
