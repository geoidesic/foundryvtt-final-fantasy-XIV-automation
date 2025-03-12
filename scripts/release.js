import fs from 'fs';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';
import { exec } from 'child_process';
import util from 'util';

const execAsync = util.promisify(exec);

// Get the current directory of the script
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define paths to package.json and module.json
const packageJsonPath = path.join(__dirname, '../package.json');
const moduleJsonPath = path.join(__dirname, '../module.json');

const versionType = process.argv[2];

if (!versionType) {
    console.error('Please provide a version argument (major, minor, patch).');
    process.exit(1);
}

// Function to validate version format
const isValidVersion = (version) => /^\d+\.\d+\.\d+$/.test(version);

// Function to increment version
const incrementVersion = (version, type) => {
    if (!isValidVersion(version)) {
        console.log(`Invalid version format: "${version}". Using default version 0.1.0 as base.`);
        version = '0.1.0';
    }
    const parts = version.split('.').map(Number);
    switch (type) {
        case 'major':
            parts[0]++;
            parts[1] = 0;
            parts[2] = 0;
            break;
        case 'minor':
            parts[1]++;
            parts[2] = 0;
            break;
        case 'patch':
            parts[2]++;
            break;
        default:
            throw new Error('Invalid version type. Use major, minor, or patch.');
    }
    return parts.join('.');
};

// Function to call Ollama for summarization
const callOllama = async (commitMessages) => {
    try {
        if (!commitMessages || commitMessages.length === 0) {
            throw new Error('No commit messages to summarize.');
        }
        const prompt = `Summarize the following commit messages in a concise paragraph:\n\n${commitMessages.join('\n')}`;
        const payload = {
            model: 'qwen2.5:7b',
            prompt: prompt,
            max_tokens: 150,
            temperature: 0.7
        };
        const response = await fetch('http://localhost:11434/v1/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!response.ok) throw new Error(`Ollama error: ${response.statusText}`);
        const data = await response.json();
        return data.choices[0].text.trim();
    } catch (error) {
        console.error('Error calling Ollama:', error);
        return null;
    }
};

// Function to generate release notes with Ollama and fallback
const generateReleaseNotesWithFallback = async (previousTag) => {
    let commitMessages = [];
    try {
        // Adjust Git log command to include merges if necessary and ensure commits are captured
        let range = previousTag ? `${previousTag}..HEAD` : '';
        const gitLogCommand = range
            ? `git log ${range} --pretty=format:"%s"`
            : `git log --pretty=format:"%s" -n 50`;
        const logOutput = execSync(gitLogCommand).toString().trim();
        commitMessages = logOutput ? logOutput.split('\n').filter(msg => !msg.startsWith('Release v')) : [];
        
        if (commitMessages.length === 0) {
            console.log('No new commits found since the last tag.');
            return '## Release Notes\n\nNo significant changes in this release.';
        }

        const aiSummary = await callOllama(commitMessages);
        if (aiSummary) {
            console.log('Release notes successfully generated using Ollama.');
            return `## Release Notes\n\n${aiSummary}`;
        } else {
            console.log('Ollama did not return a valid summary.');
        }
    } catch (error) {
        console.error('Error generating release notes with Ollama:', error);
    }

    console.log('Falling back to generating release notes from commit messages.');
    return generateReleaseNotes(commitMessages);
};

// Function to generate fallback release notes
const generateReleaseNotes = (commitMessages) => {
    if (!commitMessages || commitMessages.length === 0) {
        return '## Release Notes\n\nNo significant changes in this release.';
    }
    const formattedCommits = commitMessages.map(message => `- ${message}`);
    return `## What's Changed\n\n${formattedCommits.join('\n')}`;
};

// Function to get the previous tag
const getPreviousTag = () => {
    try {
        return execSync('git describe --tags --abbrev=0').toString().trim();
    } catch (error) {
        console.log('No previous tag found.');
        return null;
    }
};

// Update package.json
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const newVersion = incrementVersion(packageJson.version, versionType);
packageJson.version = newVersion;
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));

// Update module.json
const moduleJson = JSON.parse(fs.readFileSync(moduleJsonPath, 'utf8'));
moduleJson.version = newVersion;
fs.writeFileSync(moduleJsonPath, JSON.stringify(moduleJson, null, 2));

// Commit changes
execSync('git add .');
execSync(`git commit -m "Release v${newVersion}"`);

// Create tag
execSync(`git tag -a v${newVersion} -m "Release version ${newVersion}"`);

// Push changes and tag
execSync('git push origin main');
execSync(`git push origin v${newVersion}`);

// Generate release notes
const previousTag = getPreviousTag();
const releaseNotes = await generateReleaseNotesWithFallback(previousTag);

// Create a temporary file for release notes
const releaseNotesPath = path.join(__dirname, '../release-notes.md');
fs.writeFileSync(releaseNotesPath, releaseNotes);

// Create GitHub release
try {
    execSync(`gh release create v${newVersion} --title "Version ${newVersion}" --notes-file ${releaseNotesPath}`);
    console.log(`GitHub release created for v${newVersion}`);
} catch (error) {
    console.error('Error creating GitHub release:', error.message);
    console.log('You may need to install GitHub CLI (gh) or authenticate it.');
}

// Clean up
try {
    fs.unlinkSync(releaseNotesPath);
} catch (error) {
    console.error('Error removing temporary release notes file:', error);
}

console.log(`Released version ${newVersion}`);