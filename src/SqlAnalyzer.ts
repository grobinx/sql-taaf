import { AstComponent } from "./SqlAstBuilder";

export type RelationType = "relation" | "cte" | "statement" | "function";

export interface Relation {
    /**
     * Probably type of the relation
     *
     * * cte is when found a single name and founded name is in with clause on stack
     * * function is when found identifier(s) and values in parenthesis after identifier
     * * statement is when found select
     */
    type: RelationType;
    /**
     * Relation name as parts
     */
    name?: string[];
    /**
     * Alias for the relation
     */
    alias?: string;
    /**
     * Component in the AST
     */
    component: AstComponent;
    /**
     * CTE component if relation is a cte
     * Arguments if relation is a function
     * Statement if relation is a statement
     */
    dependComponent?: AstComponent;
}

export interface Column {
    alias?: string;
    relation?: Relation;
    component: AstComponent;
}

export interface Identifier {
    type: "identifier" | "name";
    parts: string[];
    index: number;
    component: AstComponent;
}

export class SqlAnalyzer {

    private ast: AstComponent;

    constructor(ast: AstComponent) {
        this.ast = ast
    }

    private identEqual(a: string | undefined | null, b: string | undefined | null): boolean {
        if (a && b) {
            if ((a.length && a[0] === '"' && a[a.length - 1] === '"') ||
                (b.length && b[0] === '"' && b[b.length - 1] === '"')) {
                return a === b;
            }
            return a.toLowerCase() === b.toLowerCase();
        }
        return false;
    }

    /**
     * Znajduje zależności dla danej pozycji w zapytaniu SQL.
     * @param index - index of position in the SQL statement
     * @returns Tablica komponentów AST, które są zależne od danej pozycji.
     */
    private findDependencyAt(index: number): AstComponent[] {
        const result: AstComponent[] = [];

        const search = (component: AstComponent) => {
            // Sprawdź, czy indeks mieści się w zakresie tokenów komponentu
            const firstToken = component.tokens[0];
            const lastToken = component.tokens[component.tokens.length - 1];

            if (firstToken && lastToken && index >= firstToken.startIndex && index <= lastToken.endIndex) {
                result.unshift(component);

                // Rekurencyjnie przeszukaj podkomponenty
                if (component.components) {
                    for (const subComponent of component.components) {
                        search(subComponent);
                    }
                }
            }
        };

        // Rozpocznij przeszukiwanie od korzenia AST
        search(this.ast);

        return result;
    }

    private findDependency(component: AstComponent): AstComponent[] {
        const stack: AstComponent[] = [];

        const search = (current: AstComponent): boolean => {
            if (current.id === component.id) {
                stack.push(current); // Dodaj znaleziony komponent na koniec stosu
                return true;
            }

            if (current.components) {
                for (const subComponent of current.components) {
                    if (search(subComponent)) {
                        stack.push(current); // Dodaj rodzica na stos, jeśli dziecko zostało znalezione
                        return true;
                    }
                }
            }

            return false;
        };

        search(this.ast); // Rozpocznij przeszukiwanie od korzenia AST
        return stack;
    }

    private resolveCteRelation(source: AstComponent, cteName: string): AstComponent | undefined {
        const depends = this.findDependency(source);
        const statements = depends.filter(c => c.component === "STATEMENT");
        if (statements.length) {
            for (const statement of statements) {
                const withComponent = statement.components?.find(c => c.component === "WITH");
                if (withComponent) {
                    const ctes = withComponent.components?.filter(c => c.component === "CTE" || c.component === "CTE RECURSIVE");
                    if (ctes) {
                        for (const cte of ctes) {
                            const name = cte.components?.find(c => c.component === "NAME");
                            if (name && this.identEqual(name.tokens[0].value, cteName)) {
                                return cte;
                            }
                        }
                    }
                }
            }
        }
    }

    private resolveRelation(source: AstComponent): Relation | undefined {
        const alias = source.components?.find(c => c.component === "NAME");

        const statement = source.components?.find(c => c.component === "STATEMENT");
        if (statement) {
            const alias = source.components?.find(c => c.component === "NAME");
            return {
                type: "statement",
                alias: alias ? alias.tokens[0].value : undefined,
                component: source,
                dependComponent: statement,
            };
        }

        const relation = source.components?.find(c => c.component === "IDENTIFIER");
        if (relation) {
            const parts = relation.tokens.filter(t => t.type === "identifier").map(t => t.value);
            if (parts.length === 1) {
                const cte = this.resolveCteRelation(source, parts[0]);
                if (cte) {
                    return {
                        type: "cte",
                        name: parts,
                        alias: alias ? alias.tokens[0].value : undefined,
                        component: source,
                        dependComponent: cte,
                    };
                }
            }
            const values = source.components?.find(c => c.component === "VALUES");
            if (values) {
                return {
                    type: "function",
                    name: parts,
                    alias: alias ? alias.tokens[0].value : undefined,
                    component: source,
                    dependComponent: values,
                };
            }
            return {
                type: "relation",
                name: parts,
                alias: alias ? alias.tokens[0].value : undefined,
                component: source,
            }
        }
    }

    /**
     * Zwraca wszystkie relacje w zapytaniu SQL.
     * 
     * @returns Zwraca wszystkie relacje w zapytaniu SQL.
     */
    findUsedRelations(): Relation[] {
        const relations: Relation[] = [];

        const search = (component: AstComponent) => {
            if (component.component === "STATEMENT") {
                const statement = component;
                const from = statement.components?.find(c => c.component === "FROM");
                if (from) {
                    const sources = from.components?.filter(c => c.component === "SOURCE");
                    if (sources) {
                        for (const source of sources) {
                            const relation = this.resolveRelation(source);
                            if (relation) {
                                relations.push(relation);
                            }
                        }
                    }
                }
            }

            if (component.components) {
                component.components.forEach(search);
            }
        };

        search(this.ast);
        return relations;
    }

    /**
     * Resolves the columns for the given relation.
     * The function returns all columns in the relation if is a function and fields are defined,
     * if the relation is a CTE or is a statement.
     * 
     * @param relation - Relation to resolve
     * @returns Array of columns found in the relation
     */
    resolveRelationColumns(...relation: Relation[]): Column[] {
        const result: Column[] = [];
        for (const r of relation) {
            const fields = r.component.components?.find(c => c.component === "FIELDS");
            // if relation is a function or if fields are defined
            if (fields) {
                const columns = this.extractFieldsColumns(fields, r);
                if (columns) {
                    result.push(...columns);
                    continue;
                }
            }
            if (r.type === "statement" && r.dependComponent) {
                const columns = this.extractStatementColumns(r.dependComponent, r);
                if (columns) {
                    result.push(...columns);
                    continue;
                }
            }
            if (r.type === "cte") {
                const fields = r.dependComponent?.components?.find(c => c.component === "FIELDS");
                // if fields are defined
                if (fields) {
                    const columns = this.extractFieldsColumns(fields, r);
                    if (columns) {
                        result.push(...columns);
                        continue;
                    }
                }
                const statement = r.dependComponent?.components?.find(c => c.component === "STATEMENT");
                if (statement) {
                    const columns = this.extractStatementColumns(statement, r);
                    if (columns) {
                        result.push(...columns);
                    }
                }
            }
        }
        return result;
    }

    private extractStatementColumns(statement: AstComponent, relation: Relation): Column[] {
        const result: Column[] = [];
        const select = statement.components?.find(c => c.component === "SELECT");
        if (select) {
            select.components?.forEach(c => {
                if (c.component === "COLUMN") {
                    const name = c.components?.find(c => c.component === "NAME");
                    const column: Column = {
                        alias: name ? name.tokens[0].value : undefined,
                        relation: relation,
                        component: c
                    };
                    result.push(column);
                }
            });
        }
        return result;
    }

    private extractFieldsColumns(source: AstComponent, relation: Relation): Column[] {
        const columns: Column[] = [];
        const fields = source.components?.find(c => c.component === "FIELDS");
        if (fields) {
            fields.components?.forEach(c => {
                if (c.component === "FIELD") {
                    const name = c.components?.find(c => c.component === "NAME");
                    const column: Column = {
                        alias: name ? name.tokens[0].value : undefined,
                        relation: relation,
                        component: c
                    };
                    columns.push(column);
                }
            });
        }
        return columns;
    }

    /**
     * Finds the relations at the given index.
     * The function returns all relations in the stack at the given index.
     * Does not verify the visibility scope of the relations.
     * 
     * @param index - index of position in the SQL statement
     * @returns An array of relations found on stack at the given index
     */
    findRelationsAt(index: number): Relation[] {
        const stack = this.findDependencyAt(index);
        const relations: Relation[] = [];

        for (const component of stack) {
            if (component.component === "STATEMENT") {
                const statement = component;
                const from = statement.components?.find(c => c.component === "FROM");
                if (from) {
                    const sources = from.components?.filter(c => c.component === "SOURCE");
                    if (sources) {
                        for (const source of sources) {
                            const relation = this.resolveRelation(source);
                            if (relation) {
                                relations.push(relation);
                            }
                        }
                    }
                }
            }
        }

        return relations;
    }

    /**
     * Finds the identifier (or name) at the given index.
     * Remember that the identifier is the any word, tokenizer not recognize keywords.
     * @param index - index of position in the SQL statement
     * @returns 
     */
    findIdentifierAt(index: number): Identifier | undefined {
        const stack = this.findDependencyAt(index);
        if (stack.length) {
            if (stack[0].component === "IDENTIFIER" || stack[0].component === "NAME") {
                // Find the token index in parts that matches the given index
                const identifierTokens = stack[0].tokens.filter(t => t.type === "identifier");
                const parts = identifierTokens.map(t => t.value);
                let idx = -1;
                for (let i = 0; i < identifierTokens.length; i++) {
                    const t = identifierTokens[i];
                    if (index >= t.startIndex && index - 1 <= t.endIndex) {
                        idx = i;
                        break;
                    }
                }
                return {
                    type: stack[0].component === "IDENTIFIER" ? "identifier" : "name",
                    parts,
                    index: idx,
                    component: stack[0]
                };
            }
        }
        return undefined;
    }

}