/*
  ___  _____  __  __  ____  ____  __    ____  ____     ____  ___ 
 / __)(  _  )(  \/  )(  _ \(_  _)(  )  ( ___)(  _ \   (_  _)/ __)
( (__  )(_)(  )    (  )___/ _)(_  )(__  )__)  )   /  .-_)(  \__ \
 \___)(_____)(_/\/\_)(__)  (____)(____)(____)(_)\_)()\____) (___/
 
Sår - Where Is My Place
*/

const API_URL = 'https://emkc.org/api/v2/piston/execute';

let codeEl, stdinEl, fileinputEl, fileinputInfoEl, outputEl, fileoutputEl, runBtn;
let inputFileContent = null;
let inputFileName = null;

const FILE_OUTPUT_MARKER = '___FILE_OUTPUT_START___';
const FILE_OUTPUT_END_MARKER = '___FILE_OUTPUT_END___';

document.addEventListener('DOMContentLoaded', () => {
  codeEl = document.getElementById('code');
  stdinEl = document.getElementById('stdin');
  fileinputEl = document.getElementById('fileinput');
  fileinputInfoEl = document.getElementById('fileinput-info');
  outputEl = document.getElementById('output');
  fileoutputEl = document.getElementById('fileoutput');
  runBtn = document.getElementById('run-btn');

  runBtn.addEventListener('click', runCode);
  fileinputEl.addEventListener('change', handleFileSelect);
});

function handleFileSelect(e) {
  const file = e.target.files[0];
  if (!file) {
    inputFileContent = null;
    inputFileName = null;
    fileinputInfoEl.textContent = '';
    return;
  }

  inputFileName = file.name;
  const reader = new FileReader();
  reader.onload = (event) => {
    inputFileContent = event.target.result;
    fileinputInfoEl.textContent = `Loaded: ${file.name} (${inputFileContent.length} bytes)`;
  };
  reader.readAsText(file);
}

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

function createFileReaderCode() {
  return `
#include <fstream>
#include <iostream>
#include <string>
struct __FileReader {
  ~__FileReader() {
    std::ifstream f("output.txt");
    if (f.good()) {
      std::cout << "${FILE_OUTPUT_MARKER}";
      std::string line;
      while (std::getline(f, line)) {
        std::cout << line << "\\n";
      }
      std::cout << "${FILE_OUTPUT_END_MARKER}";
      f.close();
    }
  }
} __fr;
`;
}

async function runCode() {
  outputEl.textContent = 'Compiling...';
  outputEl.classList.remove('error');
  fileoutputEl.textContent = '';
  runBtn.disabled = true;

  try {
    let code = codeEl.value;
    let injectedCode = '';

    if (inputFileContent && inputFileName) {
      injectedCode += createFileWriterCode(inputFileName, inputFileContent);
    }

    injectedCode += createFileReaderCode();

    const includeMatch = code.match(/^((?:#include\s*<[^>]+>\s*\n|#include\s*"[^"]+"\s*\n|using\s+namespace\s+\w+;\s*\n)*)/);
    if (includeMatch) {
      const includes = includeMatch[1];
      const rest = code.slice(includes.length);
      code = includes + injectedCode + rest;
    } else {
      code = injectedCode + code;
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
    const output = formatOutput(result);
    outputEl.textContent = output.console;
    fileoutputEl.textContent = output.file || '(No file output)';

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
  if (result.message) return { console: 'Error: ' + result.message, file: '' };

  if (result.compile?.stderr && !result.run) {
    return { console: 'Compilation error:\n' + result.compile.stderr, file: '' };
  }

  let stdout = result.run?.stdout || '';
  let fileOutput = '';

  const startIdx = stdout.indexOf(FILE_OUTPUT_MARKER);
  const endIdx = stdout.indexOf(FILE_OUTPUT_END_MARKER);
  if (startIdx !== -1 && endIdx !== -1) {
    fileOutput = stdout.slice(startIdx + FILE_OUTPUT_MARKER.length, endIdx);
    stdout = stdout.slice(0, startIdx) + stdout.slice(endIdx + FILE_OUTPUT_END_MARKER.length);
  }

  let consoleOutput = '';
  if (result.compile?.stderr) {
    consoleOutput += 'Warnings:\n' + result.compile.stderr + '\n';
  }
  if (stdout) consoleOutput += stdout;
  if (result.run?.stderr) consoleOutput += '\nStderr:\n' + result.run.stderr;

  return { console: consoleOutput || '(No output)', file: fileOutput };
}