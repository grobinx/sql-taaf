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

export interface Configuration {
    extraIdentifierChars?: string[];
}

export class SqlTokenizer {
    private operatorChars = [':', '+', '-', '*', '/', '=', '<', '>', '!', '|', '&', '~', '@', '%', '^', '?', '.', '$', '#'];
    private punctuationChars = ['(', ')', '[', ']', '{', '}', ',', ';'];
    private identifierRegex = new RegExp('^[a-zA-Z_][a-zA-Z0-9_]*$');
    private extraIdentifierChars: string[];

    private position: Position = {
        startIndex: 1,
        endIndex: 1,
        startLine: 1,
        endLine: 1,
        startColumn: 1,
        endColumn: 1,
    };

    private tokenStartPosition: Position;

    constructor(config: Configuration = {}) {
        this.extraIdentifierChars = config.extraIdentifierChars ?? [];

        if (this.extraIdentifierChars.length > 0) {
            this.identifierRegex = new RegExp(`^[a-zA-Z_][a-zA-Z0-9_${this.extraIdentifierChars.join('')}]*$`);
            this.operatorChars = this.operatorChars.filter(
                ch => !this.extraIdentifierChars.includes(ch)
            );
        }
        this.tokenStartPosition = { ...this.position };
    }

    parse(sql: string): Token[] {
        // Reset position at the start of parsing
        this.position = {
            startIndex: 1,
            endIndex: 1,
            startLine: 1,
            endLine: 1,
            startColumn: 1,
            endColumn: 1,
        };

        let charIndex = 0;

        const consumeChar = () => {
            const char = sql[charIndex];
            this.updatePosition(char, charIndex);
            charIndex++;
            return char;
        }

        const getCurrentChar = () => {
            const char = sql[charIndex];
            return char;
        }

        const getNextChar = () => {
            const char = sql[charIndex + 1] ?? '';
            return char;
        }

        const isNextChar = () => {
            return charIndex < sql.length;
        }

        const appendChar = (char: string) => {
            if (!buffer) {
                this.startToken(charIndex);
            }
            buffer += char;
        }

        const tokens: Token[] = [];
        let buffer = ''; // Temporary buffer for building tokens
        let inString: string | null = null; // Tracks if inside a string literal
        let inComment: 'line' | 'block' | null = null; // Tracks if inside a comment

        for (; isNextChar(); consumeChar()) {
            const char = getCurrentChar();
            const nextChar = getNextChar();

            // Handle block comments (/* */)
            if (inComment === 'block') {
                appendChar(char);
                if (char === '*' && nextChar === '/') {
                    appendChar(nextChar);
                    tokens.push(this.createToken('comment', buffer));
                    buffer = '';
                    inComment = null;
                    consumeChar();
                }
                continue;
            }

            // Handle line comments (--)
            if (inComment === 'line') {
                appendChar(char);
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
                appendChar(char);
                appendChar(nextChar);
                inComment = 'block';
                consumeChar(); // Skip the '*'
                continue;
            }

            // Start of line comment
            if (char === '-' && nextChar === '-') {
                if (buffer) {
                    tokens.push(this.createToken(this.getTokenType(buffer), buffer));
                    buffer = '';
                }
                appendChar(char);
                appendChar(nextChar);
                inComment = 'line';
                consumeChar(); // Skip the second '-'
                continue;
            }

            // Handle string literals
            if (inString) {
                appendChar(char);
                if (char === inString && nextChar === inString) {
                    // Escape sequence for double quotes or single quotes
                    appendChar(nextChar);
                    consumeChar(); // Skip the escaped character
                    continue;
                }
                if (char === inString) {
                    // End of string literal
                    tokens.push(this.createToken(this.getTokenType(buffer), buffer));
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
                appendChar(char);
                continue;
            }

            // Handle operators
            if (this.isOperator(char)) {
                if (buffer && !this.isOperator(buffer[buffer.length - 1])) {
                    tokens.push(this.createToken(this.getTokenType(buffer), buffer));
                    buffer = '';
                }
                appendChar(char);
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
                appendChar(char);
                tokens.push(this.createToken('punctator', buffer));
                buffer = '';
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
            appendChar(char);
        }

        // Finalize the last token
        if (buffer) {
            tokens.push(this.createToken(this.getTokenType(buffer), buffer));
        }

        return tokens;
    }

    private updatePosition(char: string, charIndex: number): void {
        this.position.endIndex = charIndex + 1;
        this.position.endColumn++;
        if (char === '\n') {
            this.position.endLine++;
            this.position.endColumn = 1;
        }
    }

    private startToken(charIndex: number) {
        this.position.startIndex = charIndex + 1;
        this.position.endIndex = charIndex + 1;
        this.position.startLine = this.position.endLine;
        this.position.startColumn = this.position.endColumn;
        this.tokenStartPosition = { ...this.position };
    }

    private createToken(type: TokenType, value: string): Token {
        const token: Token = {
            ...this.tokenStartPosition,
            endIndex: this.position.endIndex,
            endLine: this.position.endLine,
            endColumn: this.position.endColumn,
            type,
            value,
        };
        return token;
    }

    private getTokenType(value: string): TokenType {
        if (this.identifierRegex.test(value)) {
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
        return [...value].every(char => this.operatorChars.includes(char));
    }

    private isPunctuation(char: string): boolean {
        return this.punctuationChars.includes(char);
    }
}

