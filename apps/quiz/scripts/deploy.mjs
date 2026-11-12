import { appendFile } from 'node:fs/promises';
import { context, deploy } from './deployment.mjs';

try {
  if (process.argv.includes('--help')) {
    console.log('CLOUDFLARE_API_TOKEN を設定し npm run deploy:workers を実行します。D1・Queues・Workerを作成または再利用してデプロイします。');
  } else {
    const ctx = await context();
    const result = await deploy(ctx);
    console.log(`Deployed: ${result.url}`);
    console.log(`Deployment state: ${ctx.statePath}`);
    if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `url=${result.url}\n`);
    if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, `### Quiz deployment\n\nURL: ${result.url}\n\nWorker: ${ctx.name}\n\nD1 / Queues: ${result.state.resources.map((resource) => `${resource.name} (${resource.created ? 'managed' : 'reused'})`).join(', ')}\n`);
  }
} catch (error) { console.error(error.message); process.exitCode = 1; }
