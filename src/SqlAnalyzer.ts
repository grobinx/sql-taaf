import { AstComponent } from "./SqlAstBuilder";

export interface Relation {
    parts: string[];
    alias?: string;
    component: AstComponent;
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
            if (component.component === "SOURCE") {
                const relation = component.components?.find(c => c.component === "IDENTIFIER");
                const alias = component.components?.find(c => c.component === "NAME");
                if (relation) {
                    relations.push({
                        parts: relation.tokens.filter(t => t.type === "identifier").map(t => t.value),
                        alias: alias ? alias.tokens[0].value : undefined,
                        component: component
                    });
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

}