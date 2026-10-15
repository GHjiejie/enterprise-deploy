import { lstatSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseReleaseRecord, RELEASE_RECORD_FILE } from './release-record.ts';
import { verifyPruningArtifact } from './pruning.ts';

const args = process.argv.slice(2);
if (args.length !== 2 || args[0] !== '--artifact' || !args[1])
  throw new Error('Usage: npm run pruning:verify -- --artifact DIRECTORY');
const directory = resolve(args[1]);
const path = join(directory, RELEASE_RECORD_FILE);
if (!lstatSync(path).isFile() || lstatSync(path).isSymbolicLink())
  throw new Error('Release record must be a regular file');
const record = parseReleaseRecord(JSON.parse(readFileSync(path, 'utf8')));
const report = verifyPruningArtifact(directory, record);
process.stdout.write(
  `Physical pruning passed: ${report.profileId}/${report.environment}, modules=${report.enabledModules.join(',')}, buildId=${report.buildId}\n`,
);
