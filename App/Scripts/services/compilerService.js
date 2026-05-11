/*
  ___  _____  __  __  ____  ____  __    ____  ____  ___  ____  ____  _  _  ____  ___  ____     ____  ___ 
 / __)(  _  )(  \/  )(  _ \(_  _)(  )  ( ___)(  _ \/ __)( ___)(  _ \( \/ )(_  _)/ __)( ___)   (_  _)/ __)
( (__  )(_)(  )    (  )___/ _)(_  )(__  )__)  )   /\__ \ )__)  )   / \  /  _)(_( (__  )__)   .-_)(  \__ \
 \___)(_____)(_/\/\_)(__)  (____)(____)(____)(_)\_)(___/(____)(_)\_)  \/  (____)\___)(____)()\____) (___/

Part 4.
Handle all compiler related API calls here, such as compiling code, fetching supported languages, etc.

*/

export class CompilerService {
    constructor(apiClient) {
        this.api = apiClient;

        // Constants
        this.FILE_OUTPUT_MARKER = '___FILE_OUTPUT_START___';
        this.FILE_OUTPUT_END_MARKER = '___FILE_OUTPUT_END___';
        
        this.APIS = {
            PISTON_CPP: 'https://cpp-runner.fly.dev/api/v2/piston/execute',
            JUDGE0: 'https://ce.judge0.com/submissions?base64_encoded=false&wait=true'
        };
    }

    // C++ execution

    async runCodePistonCpp(code, inputFile = null, stdin = '') {
        const processedCode = this._injectCppFileHandlers(code, inputFile);

        try {
            const res = await fetch(this.APIS.PISTON_CPP, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    language: 'c++',
                    version: '10.2.0',
                    files: [{ name: 'main.cpp', content: processedCode }],
                    stdin: stdin
                })
            });

            const result = await res.json();

            // Handle API-level errors
            if (result.message) {
                return this._buildErrorResponse(result.message);
            }

            // Handle Compilation errors
            if (result.compile?.stderr && !result.run) {
                return this._buildErrorResponse(result.compile.stderr);
            }

            return this._extractOutput(
                result.run?.stdout || '', 
                result.compile?.stderr || '', 
                result.run?.stderr || '',
                !result.run?.stderr
            );

        } catch (error) {
            return this._buildErrorResponse(`Network/Piston Error: ${error.message}`);
        }
    }

    async runCodeCpp(code, inputFile = null, stdin = '') {
        const processedCode = this._injectCppFileHandlers(code, inputFile);

        try {
            const res = await fetch(this.APIS.JUDGE0, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    language_id: 54, // GCC 9.2.0
                    source_code: processedCode,
                    stdin: stdin
                })
            });

            const result = await res.json();
            return this._formatJudge0Response(result);

        } catch (error) {
            return this._buildErrorResponse(`Network/Judge0 Error: ${error.message}`);
        }
    }

    // py execution (default runCode)

    async runCode(code, inputFile = null, stdin = '') {
        let injectedCode = 'import os\nimport atexit\n\n';

        if (inputFile && inputFile.name && inputFile.content) {
            const escaped = inputFile.content
                .replace(/\\/g, '\\\\')
                .replace(/"/g, '\\"')
                .replace(/\n/g, '\\n')
                .replace(/\r/g, '');

            injectedCode += `
try:
    with open("${inputFile.name}", "w", encoding="utf-8") as __f_in:
        __f_in.write("${escaped}")
except Exception:
    pass
`;
        }

        injectedCode += `
def __read_output_file():
    try:
        if os.path.exists("output.txt"):
            print("${this.FILE_OUTPUT_MARKER}", end="")
            with open("output.txt", "r", encoding="utf-8") as __f_out:
                print(__f_out.read(), end="")
            print("${this.FILE_OUTPUT_END_MARKER}", end="")
    except Exception:
        pass

atexit.register(__read_output_file)

# --- USER CODE START ---
`;

        const processedCode = injectedCode + code;

        try {
            const res = await fetch(this.APIS.JUDGE0, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    language_id: 71, // Python 3.8.1
                    source_code: processedCode,
                    stdin: stdin
                })
            });

            const result = await res.json();
            return this._formatJudge0Response(result);

        } catch (error) {
            return this._buildErrorResponse(`Network/Judge0 Error: ${error.message}`);
        }
    }

    /**
     * Injects file creation/reading structs into C++ code.
     */
    
    _injectCppFileHandlers(code, inputFile) {
        let injectedCode = '';

        if (inputFile && inputFile.name && inputFile.content) {
            const escaped = inputFile.content
                .replace(/\\/g, '\\\\')
                .replace(/"/g, '\\"')
                .replace(/\n/g, '\\n');

            injectedCode += `
                #include <fstream>
                void __create_input_file() {
                    std::ofstream f("${inputFile.name}");
                    f << "${escaped}";
                    f.close();
                }
                struct __FileCreator { __FileCreator() { __create_input_file(); } } __fc;
            `;
        }

        injectedCode += `
            #include <fstream>
            #include <iostream>
            #include <string>
            struct __FileReader {
                ~__FileReader() {
                    std::ifstream f("output.txt");
                    if (f.good()) {
                        std::cout << "${this.FILE_OUTPUT_MARKER}";
                        std::string line;
                        while (std::getline(f, line)) {
                            std::cout << line << "\\n";
                        }
                        std::cout << "${this.FILE_OUTPUT_END_MARKER}";
                        f.close();
                    }
                }
            } __fr;
        `;

        // Safely insert after any #includes
        const includeMatch = code.match(/^((?:#include\s*<[^>]+>\s*\n|#include\s*"[^"]+"\s*\n|using\s+namespace\s+\w+;\s*\n)*)/);
        
        if (includeMatch) {
            const includes = includeMatch[1];
            const rest = code.slice(includes.length);
            return includes + injectedCode + rest;
        }
        
        return injectedCode + code;
    }

    /**
     * Standardizes how Judge0 responses are parsed for both C++ and Python
     */

    _formatJudge0Response(result) {
        // API-level limits/errors
        if (result.message) {
            return this._buildErrorResponse("API Error: " + result.message);
        }

        // Judge0 Status 6 = Compilation Error
        if (result.status?.id === 6) {
            return this._buildErrorResponse(result.compile_output || "Compilation/Syntax failed");
        }

        const isSuccess = result.status?.id === 3; // Status 3 = Accepted
        
        return this._extractOutput(
            result.stdout || '', 
            result.compile_output || '', 
            result.stderr || '', 
            isSuccess
        );
    }

    /**
     * Extracts the injected file output from the stdout stream and builds the final object
     */

    _extractOutput(rawStdout, rawWarnings, rawStderr, isSuccess) {
        let stdout = rawStdout;
        let fileOutput = '';

        const startIdx = stdout.indexOf(this.FILE_OUTPUT_MARKER);
        const endIdx = stdout.indexOf(this.FILE_OUTPUT_END_MARKER);
        
        if (startIdx !== -1 && endIdx !== -1) {
            fileOutput = stdout.slice(startIdx + this.FILE_OUTPUT_MARKER.length, endIdx);
            stdout = stdout.slice(0, startIdx) + stdout.slice(endIdx + this.FILE_OUTPUT_END_MARKER.length);
        }

        let consoleOutput = '';
        if (rawWarnings) consoleOutput += 'Warnings/Errors:\n' + rawWarnings + '\n';
        if (stdout) consoleOutput += stdout;
        if (rawStderr) consoleOutput += (consoleOutput ? '\n' : '') + 'Stderr:\n' + rawStderr;

        return {
            success: isSuccess,
            console: consoleOutput.trim(),
            file: fileOutput,
            error: rawStderr || null
        };
    }

    /**
     * Helper to return a consistently structured error object
     */

    _buildErrorResponse(errorMessage) {
        return { 
            success: false, 
            error: errorMessage, 
            console: '', 
            file: '' 
        };
    }
}