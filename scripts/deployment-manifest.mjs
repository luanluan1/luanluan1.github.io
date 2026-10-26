import {execFileSync} from 'node:child_process';
import {readFile,writeFile,glob} from 'node:fs/promises';
import {createHash} from 'node:crypto';

const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
if(git('status','--porcelain'))throw new Error('Commit or preserve source changes before recording a deployment.');
await readFile('dist/posts/codex-enterprise-agent-control-plane/index.html');
await readFile('dist/posts/transformer-attention-dot-product-vs-cosine/index.html');
const files=['src/data/projects.ts'];
files.push('src/content/posts/transformer-attention-dot-product-vs-cosine.md');
for await(const file of glob('src/content/posts/codex-enterprise-agent-*.md'))files.push(file.replaceAll('\\','/'));
files.sort();
const hashes={};
for(const file of files)hashes[file]=createHash('sha256').update(await readFile(file)).digest('hex');
const manifest={repository:'luanluan1/luanluan1.github.io',sourceBranch:'codex/firefly-source',sourceCommit:git('rev-parse','HEAD'),generatedAt:new Date().toISOString(),hashes};
await writeFile('dist/deployment.json',JSON.stringify(manifest,null,2)+'\n');
console.log(`Recorded deployment from ${manifest.sourceCommit}`);
