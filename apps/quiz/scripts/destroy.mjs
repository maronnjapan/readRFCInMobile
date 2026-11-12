import { parseArgs } from 'node:util';
import { resolve } from 'node:path';
import { context, destroy } from './deployment.mjs';

try {
  const { values } = parseArgs({ options: { confirm: { type: 'string' }, state: { type: 'string' }, help: { type: 'boolean' } } });
  if (values.help) {
    console.log('npm run destroy:workers -- [--state PATH] [--confirm WORKER_NAME]\n指定なしは削除計画だけを表示します。確認名が一致した場合のみ、このデプロイが作成したリソースを削除します。');
  } else {
    const ctx = await context({ statePath: values.state ? resolve(values.state) : undefined });
    const result = await destroy(ctx, { confirm: values.confirm });
    console.log(JSON.stringify(result, null, 2));
    if (!result.destroyed && result.plan.length) console.log(`削除する場合: npm run destroy:workers -- --confirm ${ctx.name}`);
  }
} catch (error) { console.error(error.message); process.exitCode = 1; }
