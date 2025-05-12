import { Position, Token } from "./SqlTokenizer";

const joinSeparators = ["JOIN", "LEFT", "RIGHT", "FULL", "INNER", "OUTER", "CROSS", "NATURAL", "LATERAL", ","];

export interface AstComponent {
    id: number;
    component: string;
    tokens: Token[];
    components?: AstComponent[] | null;
}

export interface AtsError {
    message: string;
    position: Token | null;
}

export class SqlAstBuilder {
    private tokens: Token[] = [];
    private currentIndex: number = 0;
    private errors: AtsError[] = [];
    private sequence: number = 0;

    /**
     * Zwraca poprzedni token bez zmiany bieżącej pozycji.
     */
    getPrevToken(): Token | null {
        if (this.currentIndex > 0) {
            return this.tokens[this.currentIndex - 1];
        }
        return null; // Brak wcześniejszych tokenów
    }

    /**
     * Zwraca następny token bez zmiany bieżącej pozycji.
     */
    getNextToken(): Token | null {
        if (this.currentIndex < this.tokens.length - 1) {
            return this.tokens[this.currentIndex + 1];
        }
        return null; // Brak więcej tokenów
    }

    /**
     * Zwraca bieżący token i przesuwa wskaźnik do następnego tokenu.
     */
    consumeToken(): Token | null {
        if (this.currentIndex < this.tokens.length) {
            return this.tokens[this.currentIndex++];
        }
        return null; // Brak więcej tokenów
    }

    /**
     * Zwraca aktualny token bez zmiany pozycji wskaźnika.
     */
    getCurrentToken(): Token | null {
        if (this.currentIndex < this.tokens.length) {
            return this.tokens[this.currentIndex];
        }
        return null; // Brak więcej tokenów
    }

    /**
     * Konsumuje tokeny aż do napotkania jednego z określonych znaków końca,
     * uwzględniając zagnieżdżone nawiasy różnych typów: (), {}, [], <>.
     * @param endTokens Znaki końca, np. [',', ')']
     * @returns Tablica skonsumowanych tokenów
     */
    consumeUntil(endTokens: string[]): Token[] {
        const tokens: Token[] = [];
        const stack: string[] = []; // Stos do śledzenia otwartych nawiasów
        const matchingBrackets: Record<string, string> = {
            '(': ')',
            '{': '}',
            '[': ']',
            '<': '>',
            'CASE': 'END',
        };

        let currentToken = this.getCurrentToken();

        while (currentToken) {
            const value = currentToken.value.toUpperCase();

            // Jeśli to otwierający nawias, dodaj go na stos
            if (matchingBrackets[value]) {
                stack.push(value);
            }
            // Jeśli to zamykający nawias, sprawdź zgodność ze stosem
            else if (Object.values(matchingBrackets).includes(value)) {
                if (stack.length === 0) {
                    // Jeśli stos jest pusty, a napotkano zamykający nawias
                    if (endTokens.includes(value)) {
                        break;
                    } else {
                        this.errors.push({
                            message: `Nieoczekiwany zamykający nawias: ${value}`,
                            position: currentToken,
                        });
                        return tokens; // Zakończ analizę
                    }
                }
                // Usuń pasujący otwierający nawias ze stosu
                if (matchingBrackets[stack[stack.length - 1]] === value) {
                    stack.pop();
                } else {
                    this.errors.push({
                        message: `Nieoczekiwany zamykający nawias: ${value}`,
                        position: currentToken,
                    });
                    return tokens; // Zakończ analizę
                }
            }
            // Jeśli napotkano znak końca i stos jest pusty, zakończ
            else if (stack.length === 0 && endTokens.includes(value)) {
                break;
            }

            tokens.push(currentToken);
            this.consumeToken(); // Przesuń wskaźnik na następny token
            currentToken = this.getCurrentToken();
        }

        // Jeśli stos nie jest pusty, oznacza to brakujące zamknięcie nawiasu
        if (stack.length > 0) {
            this.errors.push({
                message: `Brak zamknięcia nawiasu: ${stack[stack.length - 1]}`,
                position: currentToken,
            });
        }

        return tokens;
    }

    /**
     * Konsumuje tokeny wstecz aż do napotkania jednego z określonych znaków końca,
     * uwzględniając zagnieżdżone nawiasy różnych typów: (), {}, [], <>.
     * Wycina tokeny z oryginalnej tablicy.
     * 
     * @param tokens 
     * @param endTokens 
     * @returns 
     */
    consumeUntilBackwards(tokens: Token[], endTokens: string[]): Token[] {
        const result: Token[] = [];
        const stack: string[] = []; // Stos do śledzenia otwartych nawiasów
        const matchingBrackets: Record<string, string> = {
            ')': '(',
            '}': '{',
            ']': '[',
            '>': '<',
            'END': 'CASE',
        };

        let currentIndex = tokens.length - 1; // Zaczynamy od końca listy tokenów

        while (currentIndex >= 0) {
            const currentToken = tokens[currentIndex];
            const value = currentToken.value.toUpperCase();

            // Jeśli to zamykający nawias, dodaj go na stos
            if (Object.keys(matchingBrackets).includes(value)) {
                stack.push(value);
            }
            // Jeśli to otwierający nawias, sprawdź zgodność ze stosem
            else if (Object.values(matchingBrackets).includes(value)) {
                if (stack.length === 0) {
                    // Jeśli stos jest pusty, a napotkano otwierający nawias
                    if (endTokens.includes(value)) {
                        break;
                    } else {
                        this.errors.push({
                            message: `Nieoczekiwany otwierający nawias: ${value}`,
                            position: currentToken,
                        });
                        return result; // Zakończ analizę
                    }
                }
                // Usuń pasujący zamykający nawias ze stosu
                if (matchingBrackets[stack[stack.length - 1]] === value) {
                    stack.pop();
                } else {
                    this.errors.push({
                        message: `Nieoczekiwany otwierający nawias: ${value}`,
                        position: currentToken,
                    });
                    return result; // Zakończ analizę
                }
            }
            // Jeśli napotkano znak końca i stos jest pusty, zakończ
            else if (stack.length === 0 && endTokens.includes(value)) {
                break;
            }

            result.unshift(currentToken); // Dodaj token na początek listy wynikowej
            tokens.splice(currentIndex, 1); // Usuń token z oryginalnej tablicy
            currentIndex--; // Przesuń wskaźnik na poprzedni token
        }

        // Jeśli stos nie jest pusty, oznacza to brakujące zamknięcie nawiasu
        if (stack.length > 0) {
            this.errors.push({
                message: `Brak zamknięcia nawiasu: ${stack[stack.length - 1]}`,
                position: tokens[currentIndex],
            });
        }

        return result;
    }

    prepareComponent(component: string, tokens: Token[], components?: AstComponent[] | null): AstComponent {
        if (components !== undefined) {
            return {
                id: ++this.sequence,
                component: component,
                tokens: tokens,
                components: components,
            };
        }
        return {
            id: ++this.sequence,
            component: component,
            tokens: tokens,
        }
    }

    splitStatement(component?: AstComponent): AstComponent[] {
        const components: AstComponent[] = [];

        if (component) {
            this.tokens = component.tokens;
            this.currentIndex = 0;
        }

        const handleClause = (primaryKeyword: string, secondaryKeyword?: string, endTokens: string[] = [";"]) => {
            this.consumeToken(); // Konsumuj główne słowo kluczowe
            if (secondaryKeyword) {
                const nextToken = this.getCurrentToken();
                if (nextToken && nextToken.value.toUpperCase() === secondaryKeyword) {
                    this.consumeToken(); // Konsumuj drugie słowo kluczowe
                } else {
                    this.errors.push({
                        message: `Oczekiwano '${secondaryKeyword}' po '${primaryKeyword}'`,
                        position: this.getCurrentToken(),
                    });
                    return;
                }
            }
            const tokens = this.consumeUntil(endTokens);
            components.push(this.prepareComponent(
                `${primaryKeyword}${secondaryKeyword ? " " + secondaryKeyword : ""}`,
                tokens
            ));
        };

        const clauseHandlers: Record<string, () => void> = {
            "WITH": () => handleClause("WITH", undefined, ["SELECT", "INSERT", "DELETE", "UPDATE", ";"]),
            "SELECT": () => {
                // Sprawdź, czy następny token to DISTINCT
                const nextToken = this.getNextToken();
                if (nextToken && nextToken.value.toUpperCase() === "DISTINCT") {
                    handleClause("SELECT", "DISTINCT", ["FROM", "UNION", "EXCEPT", "INTERSECT", "ORDER", ";"]);
                } else {
                    handleClause("SELECT", undefined, ["FROM", "UNION", "EXCEPT", "INTERSECT", "ORDER", ";"]);
                }
            },
            "INSERT": () => handleClause("INSERT", undefined, ["VALUES", "SELECT", ";"]),
            "VALUES": () => handleClause("VALUES", undefined, [";"]),
            "DELETE": () => handleClause("DELETE", undefined, ["FROM", ";"]),
            "UPDATE": () => handleClause("UPDATE", undefined, ["SET", ";"]),
            "SET": () => handleClause("SET", undefined, ["WHERE", "FROM", ";"]),
            "FROM": () => handleClause("FROM", undefined, ["WHERE", "GROUP", "ORDER", "HAVING", "LIMIT", "OFFSET", "UNION", "EXCEPT", "INTERSECT", ";"]),
            "WHERE": () => handleClause("WHERE", undefined, ["GROUP", "ORDER", "HAVING", "LIMIT", "OFFSET", "UNION", "EXCEPT", "INTERSECT", ";"]),
            "HAVING": () => handleClause("HAVING", undefined, ["GROUP", "ORDER", "LIMIT", "OFFSET", "UNION", "EXCEPT", "INTERSECT", ";"]),
            "GROUP": () => handleClause("GROUP", "BY", ["ORDER", "HAVING", "LIMIT", "OFFSET", "UNION", "EXCEPT", "INTERSECT", ";"]),
            "ORDER": () => handleClause("ORDER", "BY", ["LIMIT", "OFFSET", ";"]),
            "LIMIT": () => handleClause("LIMIT", undefined, ["OFFSET", ";"]),
            "OFFSET": () => handleClause("OFFSET", undefined, [";"]),
            "UNION": () => {
                const nextToken = this.getCurrentToken();
                if (nextToken && nextToken.value.toUpperCase() === "ALL") {
                    handleClause("UNION", "ALL", ["UNION", "EXCEPT", "INTERSECT", "ORDER", "LIMIT", "OFFSET", ";"]);
                } else {
                    handleClause("UNION", undefined, ["UNION", "EXCEPT", "INTERSECT", "ORDER", "LIMIT", "OFFSET", ";"]);
                }
            },
            "EXCEPT": () => handleClause("EXCEPT", undefined, ["UNION", "EXCEPT", "INTERSECT", "ORDER", "LIMIT", "OFFSET", ";"]),
            "INTERSECT": () => handleClause("INTERSECT", undefined, ["UNION", "EXCEPT", "INTERSECT", "ORDER", "LIMIT", "OFFSET", ";"]),
        };

        while (this.getCurrentToken()) {
            const currentToken = this.getCurrentToken();

            if (!currentToken) {
                break;
            }

            const value = currentToken.value.toUpperCase();

            // Wywołaj odpowiedni handler dla klauzuli, jeśli istnieje
            if (clauseHandlers[value]) {
                clauseHandlers[value]();
                continue;
            } else {
                this.errors.push({
                    message: `Nieobsługiwana klauzula: '${value}'`,
                    position: currentToken,
                });
            }

            // Konsumuj token, jeśli nie jest obsługiwany
            this.consumeToken();
        }

        this.processLevel(components);

        return components;
    }

    splitWith(component: AstComponent): AstComponent[] | null {
        this.tokens = component.tokens;
        this.currentIndex = 0;

        const components: AstComponent[] = [];

        while (this.getCurrentToken()) {
            const componentTokens = this.consumeUntil([","]);

            if (componentTokens.length > 0) {
                if (componentTokens[0].value.toUpperCase() === "RECURSIVE") {
                    componentTokens.shift(); // Usuń "RECURSIVE" z listy tokenów
                    components.push(this.prepareComponent(
                        "CTE RECURSIVE",
                        componentTokens,
                    ));
                }
                else {
                    components.push(this.prepareComponent(
                        "CTE",
                        componentTokens,
                    ));
                }
            }

            // Konsumuj separator (jeśli istnieje)
            const separator = this.getCurrentToken();
            if (separator && separator.value === ",") {
                this.consumeToken();
            }
        }

        this.processLevel(components);

        return components.length > 0 ? components : null;
    }

    splitCte(component: AstComponent): AstComponent[] | null {
        this.tokens = component.tokens;
        this.currentIndex = 0;

        const components: AstComponent[] = [];

        // Pierwszy token po "RECURSIVE" to nazwa/alias
        const nameToken = this.consumeToken();
        if (!nameToken) {
            this.errors.push({
                message: "Oczekiwano nazwy lub aliasu dla CTE.",
                position: this.getCurrentToken(),
            });
            return null;
        }

        // Dodaj nazwę jako osobny komponent
        components.push(this.prepareComponent("NAME", [nameToken]));

        // Sprawdź, czy po aliasie występuje lista nazw kolumn w nawiasach
        const currentToken = this.getCurrentToken();
        if (currentToken && currentToken.value === "(") {
            this.consumeToken(); // Konsumuj otwierający nawias
            const columnList = this.consumeUntil([")"]);
            if (this.getCurrentToken()?.value === ")") {
                this.consumeToken(); // Konsumuj zamykający nawias
            } else {
                this.errors.push({
                    message: "Brak zamykającego nawiasu w liście nazw kolumn.",
                    position: this.getCurrentToken(),
                });
                return null;
            }

            // Dodaj listę nazw kolumn jako osobny komponent
            components.push(this.prepareComponent("FIELDS", columnList));
        }

        // Opcjonalny token "AS"
        const asToken = this.getCurrentToken();
        if (asToken && asToken.value.toUpperCase() === "AS") {
            this.consumeToken(); // Konsumuj "AS"
        }

        // Zakładamy, że pozostałe tokeny są ograniczone nawiasami
        const startIndex = this.currentIndex + 1; // Pomijamy otwierający nawias
        const endIndex = this.tokens.length - 1; // Pomijamy zamykający nawias

        if (this.tokens[startIndex - 1]?.value !== "(" || this.tokens[endIndex]?.value !== ")") {
            this.errors.push({
                message: "Brak wymaganych nawiasów w definicji CTE.",
                position: this.getCurrentToken(),
            });
            return null;
        }

        // Wyodrębnij tokeny pomiędzy nawiasami
        const statementTokens = this.tokens.slice(startIndex, endIndex);

        // Dodaj statement jako osobny komponent
        components.push(this.prepareComponent("STATEMENT", statementTokens));

        this.processLevel(components);

        return components.length > 0 ? components : null;
    }

    splitFields(component: AstComponent): AstComponent[] | null {
        this.tokens = component.tokens;
        this.currentIndex = 0;

        const components: AstComponent[] = [];

        while (this.getCurrentToken()) {
            // Konsumuj tokeny aż do napotkania przecinka lub końca
            const columnTokens = this.consumeUntil([","]);

            if (columnTokens.length > 0) {
                components.push(this.prepareComponent("FIELD", columnTokens));
            }

            // Konsumuj przecinek, jeśli istnieje
            const currentToken = this.getCurrentToken();
            if (currentToken && currentToken.value === ",") {
                this.consumeToken();
            }
        }

        this.processLevel(components);

        return components.length > 0 ? components : null;
    }

    splitField(component: AstComponent): AstComponent[] | null {
        this.tokens = component.tokens;
        this.currentIndex = 0;

        const components: AstComponent[] = [];

        const nameToken = this.getCurrentToken();
        const typeTokens = this.tokens.slice(1);

        if (nameToken) {
            components.push(this.prepareComponent("NAME", [nameToken]));
        }

        if (typeTokens.length > 0) {
            components.push(this.prepareComponent("TYPE", typeTokens));
        }

        return components.length > 0 ? components : null;
    }

    splitSelect(component: AstComponent): AstComponent[] | null {
        this.tokens = component.tokens;
        this.currentIndex = 0;

        const components: AstComponent[] = [];

        while (this.getCurrentToken()) {
            // Konsumuj tokeny aż do napotkania przecinka lub końca
            const columnTokens = this.consumeUntil([","]);

            if (columnTokens.length > 0) {
                components.push(this.prepareComponent("COLUMN", columnTokens));
            }

            // Konsumuj przecinek, jeśli istnieje
            const currentToken = this.getCurrentToken();
            if (currentToken && currentToken.value === ",") {
                this.consumeToken();
            }
        }

        this.processLevel(components);

        return components.length > 0 ? components : null;
    }

    splitColumn(component: AstComponent): AstComponent[] | null {
        this.tokens = component.tokens;
        this.currentIndex = this.tokens.length - 1; // Rozpocznij od końca tokenów

        const components: AstComponent[] = [];
        let alias: Token | null = null;
        let expressionTokens: Token[] | null = null;

        let currentToken = this.getCurrentToken();
        const prevToken = this.getPrevToken();

        if (currentToken?.type === "identifier" && (prevToken?.type !== "operator")) {
            alias = currentToken;
            if (this.tokens.length > 1) {
                this.currentIndex--;
            }
        }

        currentToken = this.getCurrentToken();
        if (currentToken?.value.toUpperCase() === "AS") {
            this.currentIndex--;
        }

        // Skopiuj tokeny od początku do bieżącego indeksu
        expressionTokens = this.tokens.slice(0, this.currentIndex + 1);

        // Dodaj expression jako komponent
        if (expressionTokens.length > 0) {
            components.push(this.prepareComponent("EXPRESSION", expressionTokens));
        }

        // Dodaj alias jako komponent, jeśli istnieje
        if (alias) {
            components.push(this.prepareComponent("NAME", [alias]));
        }
        else {
            // pierwszy identifier od końca to alias kolumny, w większości baz danych tak to działa
            for (let i = expressionTokens.length - 1; i >= 0; i--) {
                const token = expressionTokens[i];
                if (token.type === "identifier") {
                    components.push(this.prepareComponent("NAME", [token]));
                    break; // Przerwij po znalezieniu pierwszego identyfikatora
                }
            }
        }

        this.processLevel(components);

        return components.length > 0 ? components : null;
    }

    splitValues(component: AstComponent): AstComponent[] | null {
        this.tokens = component.tokens;
        this.currentIndex = 0;

        const components: AstComponent[] = [];

        while (this.getCurrentToken()) {
            // Konsumuj tokeny aż do napotkania przecinka lub końca
            const valueTokens = this.consumeUntil([","]);

            if (valueTokens.length > 0) {
                components.push(this.prepareComponent("EXPRESSION", valueTokens));
            }

            // Konsumuj przecinek, jeśli istnieje
            const currentToken = this.getCurrentToken();
            if (currentToken && currentToken.value === ",") {
                this.consumeToken();
            }
        }

        this.processLevel(components);

        return components.length > 0 ? components : null;
    }

    splitExpression(component: AstComponent): AstComponent[] | null {
        let components: AstComponent[] = [];

        const pushIdentifierIfExists = () => {
            if (identifierTokens.length > 0) {
                components.push(this.prepareComponent("IDENTIFIER", identifierTokens));
                identifierTokens = []; // Resetuj tokeny identyfikatora
            }
        };

        this.tokens = component.tokens;
        this.currentIndex = 0;

        let currentToken = this.getCurrentToken();
        let identifierTokens: Token[] = [];
        while (currentToken) {
            if (currentToken.type === "identifier") {
                if (currentToken.value.toUpperCase() === "CASE") {
                    pushIdentifierIfExists();
                    this.consumeToken(); // Konsumuj CASE
                    const caseTokens = this.consumeUntil(["END"]);
                    components.push(this.prepareComponent("CASE", caseTokens));
                }
                else {
                    if (identifierTokens.length % 2 === 1) {
                        pushIdentifierIfExists();
                    }
                    identifierTokens.push(currentToken);
                }
            } else if (currentToken.type === "operator" && currentToken.value === ".") {
                if (identifierTokens.length === 0) {
                    // Jeśli nie ma jeszcze tokenów identyfikatora, dodaj jako operator
                    // np. (composite).field -> [expression, operator, identifier]
                    components.push(this.prepareComponent("OPERATOR", [currentToken]));
                }
                else {
                    identifierTokens.push(currentToken);
                }
            } else if (currentToken.type === "punctator" && currentToken.value === "(") {
                // Jeśli napotkano otwierający nawias, dodaj expression
                if (identifierTokens.length > 0) {
                    pushIdentifierIfExists();
                    this.consumeToken()!; // Konsumuj otwierający nawias
                    const valuesTokens = this.consumeUntil([")"]);
                    components.push(this.prepareComponent("VALUES", valuesTokens));
                }
                else {
                    this.consumeToken()!; // Konsumuj otwierający nawias
                    if (this.getCurrentToken()?.value.toUpperCase() === "SELECT") {
                        const statement = this.consumeUntil([")"]);
                        components.push(this.prepareComponent("STATEMENT", statement));
                    }
                    else {
                        const expressionTokens = this.consumeUntil([")"]);
                        components.push(this.prepareComponent("EXPRESSION", expressionTokens));
                    }
                }
            } else if (currentToken.type === "punctator" && currentToken.value === "[") {
                // Jeśli napotkano otwierający nawias kwadratowy, dodaj expression
                if (identifierTokens.length > 0) {
                    pushIdentifierIfExists();
                    this.consumeToken()!; // Konsumuj otwierający nawias
                    const valuesTokens = this.consumeUntil(["]"]);
                    components.push(this.prepareComponent("ARRAY", valuesTokens));
                }
                else {
                    this.consumeToken()!; // Konsumuj otwierający nawias
                    const expressionTokens = this.consumeUntil(["]"]);
                    components.push(this.prepareComponent("ARRAY", expressionTokens));
                }
            } else if (currentToken.type === "operator") {
                pushIdentifierIfExists();
                components.push(this.prepareComponent("OPERATOR", [currentToken]));
            } else if (currentToken.type === "number" || currentToken.type === "string") {
                pushIdentifierIfExists();
                components.push(this.prepareComponent("LITERAL", [currentToken]));
            } else if (currentToken.value === ",") {
                // Jeśli napotkano przecinek, musimy zignorować to co do tej pory
                // zrobiliśmy i zbudować go na nowo i zmienić na "VALUES" bo to nie jest już EXPRESSION
                const values = this.splitValues(component);
                component.component = "VALUES";
                components = values ?? [];
                identifierTokens = []; // Resetuj tokeny identyfikatora
                break;
            } else {
                components.push(this.prepareComponent("UNKNOWN", [currentToken]));
            }

            this.consumeToken();
            currentToken = this.getCurrentToken();
        }

        if (identifierTokens.length > 0) {
            components?.push(this.prepareComponent("IDENTIFIER", identifierTokens));
        }

        this.processLevel(components);

        return components.length > 0 ? components : null;
    }

    splitCase(component: AstComponent): AstComponent[] | null {
        this.tokens = component.tokens;
        this.currentIndex = 0;

        const components: AstComponent[] = [];

        if (this.getCurrentToken()?.value.toUpperCase() !== "WHEN") {
            const caseTokens = this.consumeUntil(["WHEN"]);
            if (caseTokens.length > 0) {
                components.push(this.prepareComponent("EXPRESSION", caseTokens));
            }
        }
        else {
            this.consumeToken(); // Konsumuj WHEN
        }

        while (this.getCurrentToken()) {
            const whenTokens = this.consumeUntil(["WHEN", "ELSE"]);

            if (whenTokens.length > 0) {
                components.push(this.prepareComponent("WHEN", whenTokens));
            }

            // Konsumuj przecinek, jeśli istnieje
            const currentToken = this.getCurrentToken();
            if (currentToken && currentToken.value.toUpperCase() === "WHEN") {
                this.consumeToken();
            }
            else if (currentToken && currentToken.value.toUpperCase() === "ELSE") {
                this.consumeToken();
                const elseTokens = this.consumeUntil([]);
                if (elseTokens.length > 0) {
                    components.push(this.prepareComponent("EXPRESSION", elseTokens));
                }
                break;
            }
        }

        this.processLevel(components);

        return components.length > 0 ? components : null;
    }

    splitWhen(component: AstComponent): AstComponent[] | null {
        this.tokens = component.tokens;
        this.currentIndex = 0;

        const components: AstComponent[] = [];

        const whenTokens = this.consumeUntil(["THEN"])
        if (whenTokens.length > 0) {
            components.push(this.prepareComponent("EXPRESSION", whenTokens));
        }

        this.consumeToken(); // Konsumuj THEN
        const thenTokens = this.consumeUntil([]);

        if (thenTokens.length > 0) {
            components.push(this.prepareComponent("EXPRESSION", thenTokens));
        }

        this.processLevel(components);

        return components.length > 0 ? components : null;
    }

    splitFrom(component: AstComponent): AstComponent[] | null {
        this.tokens = component.tokens;
        this.currentIndex = 0;

        const components: AstComponent[] = [];

        let sourceTokens = this.consumeUntil(joinSeparators);
        if (sourceTokens.length > 0) {
            components.push(this.prepareComponent("SOURCE", sourceTokens));
        }

        while (this.getCurrentToken()) {
            const joinTokens: Token[] = [];
            while (this.getCurrentToken() && joinSeparators.includes(this.getCurrentToken()!.value.toUpperCase())) {
                joinTokens.push(this.getCurrentToken()!);
                this.consumeToken();
            }

            // Konsumuj tokeny aż do napotkania przecinka lub końca
            const sourceTokens = this.consumeUntil(joinSeparators);

            if (sourceTokens.length > 0) {
                joinTokens.push(...sourceTokens);
                components.push(this.prepareComponent("SOURCE", joinTokens));
            }

            // Konsumuj przecinek, jeśli istnieje
            let currentToken = this.getCurrentToken();
            if (currentToken && currentToken.value === ",") {
                this.consumeToken();
            }
        }

        this.processLevel(components);

        return components.length > 0 ? components : null;
    }

    splitSource(component: AstComponent): AstComponent[] | null {
        this.tokens = component.tokens;
        this.currentIndex = 0;

        const components: AstComponent[] = [];

        // Konsumuj tokeny aż do napotkania przecinka lub końca
        const sourceTokens = this.consumeUntil(["ON", "USING"]);
        let alias: AstComponent | null = null;

        if (sourceTokens.length > 0 && sourceTokens[sourceTokens.length - 1].value === ")") {
            sourceTokens.pop();
            const declarationTokens = this.consumeUntilBackwards(sourceTokens, ["("]);
            sourceTokens.pop();
            components.push(this.prepareComponent("FIELDS", declarationTokens));
        }

        if (sourceTokens.length > 1 && sourceTokens[sourceTokens.length - 1].type === "identifier") {
            const identifierToken = sourceTokens[sourceTokens.length - 1];
            alias = this.prepareComponent("NAME", [identifierToken]);
            components.unshift(alias);
            sourceTokens.pop();
            // Sprawdź, czy przed aliasem nie ma słowa kluczowego "AS"
            if (sourceTokens.length > 1 && sourceTokens[sourceTokens.length - 1].value.toLowerCase() === "AS") {
                sourceTokens.pop();
            }
        }

        let currentToken = this.getCurrentToken();
        if (currentToken && ["ON", "USING"].includes(currentToken.value.toUpperCase())) {
            this.consumeToken();
            const searchTokens = this.consumeUntil([]);
            components.push(this.prepareComponent("EXPRESSION", searchTokens));
        }

        if (sourceTokens.length > 0) {
            const joinType: Token[] = [];
            while (sourceTokens.length > 0 && joinSeparators.includes(sourceTokens[0].value.toUpperCase())) {
                joinType.push(sourceTokens[0]);
                sourceTokens.shift();
            }

            if (sourceTokens.length > 0) {
                if (sourceTokens[0].value.toUpperCase() === "(") {
                    this.tokens = sourceTokens;
                    this.currentIndex = 0;
                    this.consumeToken(); // Konsumuj otwierający nawias
                    const statement = this.consumeUntil([")"]);
                    components.unshift(this.prepareComponent("STATEMENT", statement));
                }
                else if (sourceTokens[0].type === "identifier") {
                    const identifierTokens = [sourceTokens[0]];
                    sourceTokens.shift();
                    while (sourceTokens.length > 0 && sourceTokens[0].value === ".") {
                        identifierTokens.push(sourceTokens[0]);
                        sourceTokens.shift();
                        if (sourceTokens.length > 0 && sourceTokens[0].type === "identifier") {
                            identifierTokens.push(sourceTokens[0]);
                            sourceTokens.shift();
                        }
                    }
                    if (sourceTokens.length > 0 && sourceTokens[0].value === "(") {
                        this.tokens = sourceTokens;
                        this.currentIndex = 0;
                        this.consumeToken(); // Konsumuj otwierający nawias
                        const statement = this.consumeUntil([")"]);
                        components.unshift(this.prepareComponent("VALUES", statement));
                    }
                    if (!alias) {
                        components.unshift(this.prepareComponent("NAME", [identifierTokens[identifierTokens.length - 1]]));
                    }
                    components.unshift(this.prepareComponent("IDENTIFIER", identifierTokens));
                }
            }

            if (joinType.length > 0) {
                components.unshift(this.prepareComponent("JOIN TYPE", joinType));
            }
        }

        this.processLevel(components);

        return components.length > 0 ? components : null;
    }

    processLevel(components: AstComponent[]): void {
        const componentHandlers: Record<string, (component: AstComponent) => AstComponent[] | null> = {
            "WITH": (component) => this.splitWith(component),
            "CTE": (component) => this.splitCte(component),
            "CTE RECURSIVE": (component) => this.splitCte(component),
            "STATEMENT": (component) => this.splitStatement(component),
            "SELECT": (component) => this.splitSelect(component),
            "SELECT DISTINCT": (component) => this.splitSelect(component),
            "COLUMN": (component) => this.splitColumn(component),
            "EXPRESSION": (component) => this.splitExpression(component),
            "CASE": (component) => this.splitCase(component),
            "WHEN": (component) => this.splitWhen(component),
            "VALUES": (component) => this.splitValues(component),
            "ARRAY": (component) => this.splitValues(component),
            "FROM": (component) => this.splitFrom(component),
            "WHERE": (component) => this.splitExpression(component),
            "SOURCE": (component) => this.splitSource(component),
            "FIELDS": (component) => this.splitFields(component),
            "FIELD": (component) => this.splitField(component),
            "GROUP BY": (component) => this.splitValues(component),
            "ORDER BY": (component) => this.splitValues(component),
            "HAVING": (component) => this.splitValues(component),
            "UNION": (component) => this.splitSelect(component),
            "EXCEPT": (component) => this.splitSelect(component),
            "INTERSECT": (component) => this.splitSelect(component),
            "UNION ALL": (component) => this.splitSelect(component),
            "LIMIT": (component) => this.splitExpression(component),
            "OFFSET": (component) => this.splitExpression(component),
        };

        components.forEach((component) => {
            const handler = componentHandlers[component.component];
            if (handler) {
                component.components = handler(component);
            }
            else {
                // this.errors.push({
                //     message: `Nieobsługiwana klauzula: '${component.component}'`,
                //     position: this.getCurrentToken(),
                // });
            }
        });
    }

    getErrors(): AtsError[] {
        return this.errors;
    }

    build(tokens: Token[]): AstComponent | null {
        this.tokens = tokens;
        this.currentIndex = 0;
        this.errors = [];
        this.sequence = 0;

        const components = this.splitStatement();
        return this.prepareComponent("STATEMENT", tokens, components);
    }
}
