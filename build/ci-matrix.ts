import { appendFileSync } from 'node:fs';
import { validateProfiles } from './validate-profiles.ts';

const profiles = validateProfiles().map((profile) => profile.id);
if (process.env.GITHUB_OUTPUT) {
  appendFileSync(process.env.GITHUB_OUTPUT, `profiles=${JSON.stringify(profiles)}\n`);
}
process.stdout.write(`CI 企业配置：${profiles.join(', ')}\n`);
