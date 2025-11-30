/*
  ___  _____  __  __  ____  ____  __    ____  ____     ____  ___ 
 / __)(  _  )(  \/  )(  _ \(_  _)(  )  ( ___)(  _ \   (_  _)/ __)
( (__  )(_)(  )    (  )___/ _)(_  )(__  )__)  )   /  .-_)(  \__ \
 \___)(_____)(_/\/\_)(__)  (____)(____)(____)(_)\_)()\____) (___/
 
Sår - Where Is My Place
*/

const API_URL = 'https://emkc.org/api/v2/piston/execute';

let codeEl, stdinEl, fileinputEl, outputEl, runBtn;

document.addEventListener('DOMContentLoaded', () => {
  codeEl = document.getElementById('code');
  stdinEl = document.getElementById('stdin');
  fileinputEl = document.getElementById('fileinput');
  outputEl = document.getElementById('output');
  runBtn = document.getElementById('run-btn');

  runBtn.addEventListener('click', runCode);
});

function createFileWriterCode(filename, content) {
  const escaped = content
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n');

  return `
#include <fstream>
void __create_input_file() {
  std::ofstream f("${filename}");
  f << "${escaped}";
  f.close();
}
struct __FileCreator { __FileCreator() { __create_input_file(); } } __fc;
`;
}

async function runCode() {
  outputEl.textContent = 'Compiling...';
  outputEl.classList.remove('error');
  runBtn.disabled = true;

  try {
    let code = codeEl.value;

    if (fileinputEl.value.trim()) {
      const fileCreator = createFileWriterCode('input.txt', fileinputEl.value);
      const includeMatch = code.match(/^((?:#include\s*<[^>]+>\s*\n|#include\s*"[^"]+"\s*\n|using\s+namespace\s+\w+;\s*\n)*)/);
      if (includeMatch) {
        const includes = includeMatch[1];
        const rest = code.slice(includes.length);
        code = includes + fileCreator + rest;
      } else {
        code = fileCreator + code;
      }
    }

    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        language: 'c++',
        version: '10.2.0',
        files: [{ name: 'main.cpp', content: code }],
        stdin: stdinEl.value
      })
    });

    const result = await res.json();
    outputEl.textContent = formatOutput(result);

    if (result.run?.stderr || result.compile?.stderr || result.message) {
      outputEl.classList.add('error');
    }
  } catch (err) {
    outputEl.textContent = 'Error: ' + err.message;
    outputEl.classList.add('error');
  } finally {
    runBtn.disabled = false;
  }
}

function formatOutput(result) {
  if (result.message) return 'Error: ' + result.message;

  if (result.compile?.stderr && !result.run) {
    return 'Compilation error:\n' + result.compile.stderr;
  }

  let output = '';
  if (result.compile?.stderr) {
    output += 'Warnings:\n' + result.compile.stderr + '\n';
  }
  if (result.run?.stdout) output += result.run.stdout;
  if (result.run?.stderr) output += '\nStderr:\n' + result.run.stderr;

  return output || '(No output)';
}