import { execFileSync } from 'node:child_process';
import { validateProfiles } from './validate-profiles.ts';

// Run delivery checks against each real output directory, never a dev-server substitution.
for (const profile of validateProfiles()) {
  for (const mode of ['staging', 'production'] as const) {
    const env = { ...process.env, APP_PROFILE: profile.id, APP_MODE: mode };
    process.stdout.write(`\nDelivery: ${profile.id}/${mode}\n`);
    execFileSync('npm', ['run', 'build', '--', '--mode', mode], { env, stdio: 'inherit' });
    execFileSync('npm', ['run', 'test:delivery'], { env, stdio: 'inherit' });
  }
}
