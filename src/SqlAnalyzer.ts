import { AstComponent } from "./SqlAstBuilder";

export interface Relation {
    /**
     * Relation name as parts
     */
    parts?: string[];
    /**
     * Alias for the relation
     */
    alias?: string;
    /**
     * Component in the AST
     */
    component: AstComponent;
    /**
     * Columns if relation is a cte
     */
    columns?: Column[];
}

export interface Column {
    alias?: string;
    relationAlias?: string;
    component: AstComponent;
}

export class SqlAnalyzer {

    private ast: AstComponent;

    constructor(ast: AstComponent) {
        this.ast = ast
    }

    identEqual(a: string | undefined | null, b: string | undefined | null): boolean {
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
     * Znajduje zależności dla danego tokena w zapytaniu SQL.
     * @param index - index of token in the SQL statement
     * @returns Tablica komponentów AST, które są zależne od danego tokena.
     */
    findDependencyAt(index: number): AstComponent[] {
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
                            const relation = source.components?.find(c => c.component === "IDENTIFIER");
                            const alias = source.components?.find(c => c.component === "NAME");
                            if (relation) {
                                const parts = relation.tokens.filter(t => t.type === "identifier").map(t => t.value);
                                let columns: Column[] | undefined;
                                if (parts.length === 1) {
                                    columns = this.findCteColumns(statement, parts[0]);
                                }
                                relations.push({
                                    parts: parts,
                                    alias: alias ? alias.tokens[0].value : undefined,
                                    component: source,
                                    columns: columns
                                });
                            }
                        }
                    }
                }
            }

            if (component.components) {
                if (component.component === "CTE") {
                    console.log("CTE");
                }
                component.components.forEach(search);
            }
        };

        search(this.ast);
        return relations;
    }

    /**
     * Zwraca kolumny w najbliższym zapytaniu, do którego należy dany token.
     * 
     * @param index - index of token in the SQL statement
     * @returns Tablica kolumn w najbliższym zapytaniu, do którego należy dany token.
     */
    ownerStatementColumns(index: number): Column[] {
        const result: Column[] = [];
        const stack = this.findDependencyAt(index);

        const statement = stack.find(c => c.component === "STATEMENT");
        if (statement) {
            return this.statementColumns(statement);
        }

        return result;
    }

    private statementColumns(statement: AstComponent, relationName?: string): Column[] {
        const result: Column[] = [];
        const select = statement.components?.find(c => c.component === "SELECT");
        if (select) {
            select.components?.forEach(c => {
                if (c.component === "COLUMN") {
                    const name = c.components?.find(c => c.component === "NAME");
                    const column: Column = {
                        alias: name ? name.tokens[0].value : undefined,
                        relationAlias: relationName,
                        component: c
                    };
                    result.push(column);
                }
            });
        }
        return result;}

    /**
     * Finds columns in the CTE with the given alias for owner statement.
     * This is internal function, but...
     * 
     * @param ownerStatement 
     * @param alias 
     * @returns 
     */
    findCteColumns(ownerStatement: AstComponent, alias: string): Column[] | undefined {
        const withComponent = ownerStatement.components?.find(c => c.component === "WITH");
        if (withComponent) {
            const ctes = withComponent.components?.filter(c => c.component === "CTE");
            if (ctes) {
                const columns: Column[] = [];
                for (const cte of ctes) {
                    const relationName = cte.components?.find(c => c.component === "NAME");
                    if (relationName && (this.identEqual(relationName.tokens[0].value, alias) || !alias || alias.trim() === "")) {
                        const fields = cte.components?.find(c => c.component === "FIELDS");
                        if (fields) {
                            fields.components?.forEach(c => {
                                if (c.component === "FIELD") {
                                    const name = c.components?.find(c => c.component === "NAME");
                                    const column: Column = {
                                        alias: name ? name.tokens[0].value : undefined,
                                        relationAlias: relationName.tokens[0].value,
                                        component: c
                                    };
                                    columns.push(column);
                                }
                            });
                            return columns;
                        }
                        const statement = cte.components?.find(c => c.component === "STATEMENT");
                        if (statement) {
                            columns.push(...this.statementColumns(statement, relationName.tokens[0].value));
                        }
                    }
                }
                return columns.length ? columns : undefined;
            }
        }
    }

    /**
     * Finds the relation columns in the given owner statement with the given alias if relation is a statement.
     * This is internal function, but...
     * 
     * @param ownerStatement 
     * @param alias 
     * @returns 
     */
    findSourceColumns(ownerStatement: AstComponent, alias: string): Column[] | undefined {
        const from = ownerStatement.components?.find(c => c.component === "FROM");
        if (from) {
            const sources = from.components?.filter(c => c.component === "SOURCE");
            if (sources) {
                for (const source of sources) {
                    const relationName = source.components?.find(c => c.component === "NAME");
                    if (relationName && (this.identEqual(relationName.tokens[0].value, alias) || !alias || alias.trim() === "")) {
                        const statement = source.components?.find(c => c.component === "STATEMENT");
                        if (statement) {
                            const select = statement.components?.find(c => c.component === "SELECT");
                            if (select) {
                                const columns: Column[] = [];
                                select.components?.forEach(c => {
                                    if (c.component === "COLUMN") {
                                        const name = c.components?.find(c => c.component === "NAME");
                                        const column: Column = {
                                            alias: name ? name.tokens[0].value : undefined,
                                            relationAlias: relationName?.tokens[0].value,
                                            component: c
                                        };
                                        columns.push(column);
                                    }
                                });
                                return columns;
                            }
                        }
                    }
                }
            }
        }
    }

    /**
     * Finds the relation alias at the given name and index.
     * 
     * @param name - The name of the relation alias.
     * @param index - The index of the token in the SQL statement.
     * @returns The relation or undefined if not found.
     */
    findRelationAliasAt(name: string, index: number): Relation | undefined {
        const stack = this.findDependencyAt(index);

        for (const component of stack) {
            if (component.component !== "STATEMENT") {
                continue;
            }
            const statement = component;
            const from = statement.components?.find(c => c.component === "FROM");
            if (from) {
                const sources = from.components?.filter(c => c.component === "SOURCE");
                if (sources) {
                    for (const source of sources) {
                        const alias = source.components?.find(c => c.component === "NAME");
                        if (alias && this.identEqual(alias.tokens[0].value, name)) {
                            let relation = source.components?.find(c => c.component === "IDENTIFIER");
                            if (relation) {
                                const parts = relation.tokens.filter(t => t.type === "identifier").map(t => t.value);
                                let columns: Column[] | undefined;
                                if (parts.length === 1) {
                                    columns = this.findCteColumns(statement, parts[0]);
                                }
                                return {
                                    parts: parts,
                                    alias: alias.tokens[0].value,
                                    component: relation,
                                    columns: columns
                                };
                            }
                            relation = source.components?.find(c => c.component === "STATEMENT");
                            if (relation) {
                                return {
                                    alias: alias.tokens[0].value,
                                    component: relation,
                                    columns: this.findSourceColumns(statement, alias.tokens[0].value)
                                };
                            }
                        }
                    }
                }
            }
        }

        return undefined;
    }

}