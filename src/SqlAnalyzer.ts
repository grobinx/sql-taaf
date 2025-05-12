import { AstComponent } from "./SqlAstBuilder";

export interface Relation {
    /**
     * Relation name as parts
     */
    parts: string[];
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
    component: AstComponent;
}

export class SqlAnalyzer {

    private ast: AstComponent;

    constructor(ast: AstComponent) {
        this.ast = ast
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
                                    columns = this.findWithColumns(statement, parts[0]);
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
            const select = statement.components?.find(c => c.component === "SELECT");
            if (select) {
                select.components?.forEach(c => {
                    if (c.component === "COLUMN") {
                        const name = c.components?.find(c => c.component === "NAME");
                        const column: Column = {
                            alias: name ? name.tokens[0].value : undefined,
                            component: c
                        };
                        result.push(column);
                    }
                });
            }
        }

        return result;
    }

    /**
     * Finds columns in the CTE with the given alias for owner statement.
     * This is internal function, but...
     * 
     * @param ownerStatement 
     * @param alias 
     * @returns 
     */
    findWithColumns(ownerStatement: AstComponent, alias: string): Column[] | undefined {
        const withComponent = ownerStatement.components?.find(c => c.component === "WITH");
        if (withComponent) {
            const ctes = withComponent.components?.filter(c => c.component === "CTE");
            if (ctes) {
                for (const cte of ctes) {
                    const name = cte.components?.find(c => c.component === "NAME");
                    if (name && name.tokens[0].value === alias) {
                        const fields = cte.components?.find(c => c.component === "FIELDS");
                        if (fields) {
                            const columns: Column[] = [];
                            fields.components?.forEach(c => {
                                if (c.component === "FIELD") {
                                    const name = c.components?.find(c => c.component === "NAME");
                                    const column: Column = {
                                        alias: name ? name.tokens[0].value : undefined,
                                        component: c
                                    };
                                    columns.push(column);
                                }
                            });
                            return columns;
                        }
                        const statement = cte.components?.find(c => c.component === "STATEMENT");
                        if (statement) {
                            const select = statement.components?.find(c => c.component === "SELECT");
                            if (select) {
                                const columns: Column[] = [];
                                select.components?.forEach(c => {
                                    if (c.component === "COLUMN") {
                                        const name = c.components?.find(c => c.component === "NAME");
                                        const column: Column = {
                                            alias: name ? name.tokens[0].value : undefined,
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
     * @returns The relation alias or undefined if not found.
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
                const source = from.components?.find(c => c.component === "SOURCE");
                if (source) {
                    const relation = source.components?.find(c => c.component === "IDENTIFIER");
                    const alias = source.components?.find(c => c.component === "NAME");
                    if (relation && alias && alias.tokens[0].value === name) {
                        const parts = relation.tokens.filter(t => t.type === "identifier").map(t => t.value);
                        let columns: Column[] | undefined;
                        if (parts.length === 1) {
                            columns = this.findWithColumns(statement, parts[0]);
                        }
                        return {
                            parts: parts,
                            alias: alias.tokens[0].value,
                            component: relation,
                            columns: columns
                        };
                    }
                }
            }
        }

        return undefined;
    }

}