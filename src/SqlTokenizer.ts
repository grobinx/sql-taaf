export interface Position {
    startIndex: number;
    endIndex: number;
    startLine: number;
    endLine: number;
    startColumn: number;
    endColumn: number;
}

export type TokenType =
    "keyword"
    | "identifier"
    | "string"
    | "number"
    | "operator"
    | "punctator"
    | "comment";

export interface Token extends Position {
    type: TokenType;
    value: string;
}

export class SqlTokenizer {
    private position: Position = {
        startIndex: 0,
        endIndex: 0,
        startLine: 1,
        endLine: 1,
        startColumn: 1,
        endColumn: 1,
    };

    parse(sql: string): Token[] {
        // Reset position at the start of parsing
        this.position = {
            startIndex: 0,
            endIndex: 0,
            startLine: 1,
            endLine: 1,
            startColumn: 1,
            endColumn: 1,
        };

        const tokens: Token[] = [];
        const errors: string[] = [];
        let buffer = ''; // Temporary buffer for building tokens
        let inString: string | null = null; // Tracks if inside a string literal
        let inComment: 'line' | 'block' | null = null; // Tracks if inside a comment

        for (let i = 0; i < sql.length; i++) {
            const char = sql[i];
            const nextChar = sql[i + 1] || ''; // Lookahead for two-character sequences
            this.updatePosition(char);

            // Handle block comments (/* */)
            if (inComment === 'block') {
                buffer += char;
                if (char === '*' && nextChar === '/') {
                    buffer += nextChar;
                    tokens.push(this.createToken('comment', buffer));
                    buffer = '';
                    inComment = null;
                    i++; // Skip the closing '/'
                }
                continue;
            }

            // Handle line comments (--)
            if (inComment === 'line') {
                buffer += char;
                if (char === '\n') {
                    tokens.push(this.createToken('comment', buffer));
                    buffer = '';
                    inComment = null;
                }
                continue;
            }

            // Start of block comment
            if (char === '/' && nextChar === '*') {
                if (buffer) {
                    tokens.push(this.createToken(this.getTokenType(buffer), buffer));
                    buffer = '';
                }
                buffer += char + nextChar;
                inComment = 'block';
                i++; // Skip the '*'
                continue;
            }

            // Start of line comment
            if (char === '-' && nextChar === '-') {
                if (buffer) {
                    tokens.push(this.createToken(this.getTokenType(buffer), buffer));
                    buffer = '';
                }
                buffer += char + nextChar;
                inComment = 'line';
                i++; // Skip the second '-'
                continue;
            }

            // Handle string literals
            if (inString) {
                buffer += char;
                if (char === inString) {
                    // End of string literal
                    tokens.push(this.createToken('string', buffer));
                    buffer = '';
                    inString = null;
                }
                continue;
            }

            // Start of string literal
            if (char === `'` || char === `"` || char === '`') {
                if (buffer) {
                    tokens.push(this.createToken(this.getTokenType(buffer), buffer));
                    buffer = '';
                }
                inString = char;
                buffer += char;
                continue;
            }

            // Handle operators
            if (this.isOperator(char)) {
                if (buffer && !this.isOperator(buffer[buffer.length - 1])) {
                    tokens.push(this.createToken(this.getTokenType(buffer), buffer));
                    buffer = '';
                }
                buffer += char;
                continue;
            }

            // If operator sequence ends, finalize the operator token
            if (buffer && this.isOperator(buffer[0]) && !this.isOperator(char)) {
                tokens.push(this.createToken('operator', buffer));
                buffer = '';
            }

            // Handle punctuation
            if (this.isPunctuation(char)) {
                if (buffer) {
                    tokens.push(this.createToken(this.getTokenType(buffer), buffer));
                    buffer = '';
                }
                tokens.push(this.createToken('punctator', char));
                continue;
            }

            // Handle whitespace
            if (/\s/.test(char)) {
                if (buffer) {
                    tokens.push(this.createToken(this.getTokenType(buffer), buffer));
                    buffer = '';
                }
                continue;
            }

            // Accumulate characters for identifiers, keywords, or numbers
            buffer += char;
        }

        // Finalize the last token
        if (buffer) {
            tokens.push(this.createToken(this.getTokenType(buffer), buffer));
        }

        return tokens;
    }

    private updatePosition(char: string): void {
        this.position.endIndex++;
        this.position.endColumn++;
        if (char === '\n') {
            this.position.endLine++;
            this.position.endColumn = 1;
        }
    }

    private createToken(type: TokenType, value: string): Token {
        const token: Token = {
            ...this.position,
            type,
            value,
        };
        this.position.startIndex = this.position.endIndex + 1;
        this.position.startLine = this.position.endLine;
        this.position.startColumn = this.position.endColumn;
        return token;
    }

    private getTokenType(value: string): TokenType {
        if (/^[a-zA-Z_$#][a-zA-Z0-9_$#]*$/.test(value)) {
            // Treat all valid identifiers as 'identifier'
            return 'identifier';
        }
        if (/^[0-9]+(\.[0-9]+)?([eE][+-]?[0-9]+)?$/.test(value)) {
            // Decimal or scientific notation (e.g., 123, 123.45, 1.23e10)
            return 'number';
        }
        if (/^0b[01]+$/.test(value)) {
            // Binary notation (e.g., 0b1010)
            return 'number';
        }
        if (/^0x[0-9a-fA-F]+$/.test(value)) {
            // Hexadecimal notation (e.g., 0x1A3F)
            return 'number';
        }
        if (/^['`].*['`]$/.test(value)) {
            return 'string';
        }
        if (/^".*"$/.test(value)) {
            return 'identifier';
        }
        if (this.isOperator(value)) {
            return 'operator';
        }
        if (this.isPunctuation(value)) {
            return 'punctator';
        }
        return 'identifier';
    }

    private isOperator(value: string): boolean {
        const operatorChars = [':', '+', '-', '*', '/', '=', '<', '>', '!', '|', '&', '~', '@', '%', '^', '?', '.'];
        return [...value].every(char => operatorChars.includes(char));
    }

    private isPunctuation(char: string): boolean {
        return ['(', ')', '[', ']', '{', '}', ',', ';'].includes(char);
    }
}

