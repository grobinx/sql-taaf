# SQL Analyzer

## Description
SQL Analyzer is a tool designed for analyzing SQL queries. The package enables parsing SQL queries, building an Abstract Syntax Tree (AST), and analyzing dependencies and relations used in queries.

The project was created for the DBORG project (the younger brother of ORBADA available on sf.net) with the support of GitHub Copilot.

## Classes

### SqlTokenizer
- **Description**: A class responsible for parsing SQL queries into tokens.
- **Features**:
  - Breaks down SQL queries into smaller elements (tokens).
  - The tokenizer is universal, independent of syntax while maintaining minimum compliance with the SQL standard.
  - Does not identify keywords; all identifiers, names, and words are marked as "identifier."
  - Operators are combined into a single string if not separated by a space.
  - Strings include delimiters like apostrophes and quotation marks, similar to comments.
- **Example usage**:
  ```typescript
  const tokenizer = new SqlTokenizer();
  const tokens = tokenizer.parse("SELECT * FROM users");
  console.log(tokens); // Displays the list of tokens
  ```

### SqlAstBuilder
- **Description**: A class that builds an Abstract Syntax Tree (AST) based on SQL tokens.
- **Features**:
  - Creates a tree structure representing the SQL query.
  - Detect batch statement, select, ddl, dml or mixed.
  - Currently supports only SELECT statements.
  - Divides the query into parts using standard-compliant keywords at a minimal level required to find basic information such as columns, relations, and subqueries.
  - Does not validate the correctness of the query.
  - Enables further syntactic analysis of queries.
  - The `build` function does not throw exceptions; if any errors occur, you can find them using `getErrors()`.
  - In the current version, the class cannot be used for formatting as it focuses on extracting columns and relations for the needs of the SQL editor.
- **Example usage**:
  ```typescript
  const tokenizer = new SqlTokenizer();
  const tokens = tokenizer.parse("SELECT * FROM users");
  const astBuilder = new SqlAstBuilder();
  const ast = astBuilder.build(tokens);
  console.log(ast); // Displays the AST
  ```

### SqlAnalyzer
- **Description**: A class that analyzes the AST to identify dependencies and relations in SQL queries.
- **Features**:
  - Finds dependencies in SQL queries.
  - Identifies relations and columns if exists in statement.
- **Example usage**:
  ```typescript
  const tokenizer = new SqlTokenizer();
  const tokens = tokenizer.parse("SELECT * FROM users");
  const astBuilder = new SqlAstBuilder();
  const ast = astBuilder.build(tokens);

  if (ast) {
      const analyzer = new SqlAnalyzer();
      console.log(analyzer.findUsedRelations(ast)); // Displays used relations
  }
  ```

## Features
- **SQL Query Parsing**: Breaks down SQL queries into tokens.
- **Building AST (Abstract Syntax Tree)**: Creates a tree structure based on the SQL query.
- **Dependency Analysis**: Identifies dependencies in SQL queries.
- **Find relations and columns**: Searches for relations and columns if defined in statement.

## Supports and general syntaxes
- column, if no alias is found, then the last identifier will become the alias
  - `[identifier[.identifier[.identifier]] | expression] [as] [alias]`
- relation in from clause
  - `identifier[.identifier[.identifier]] [(function arguments)] ... [as] [alias] [(field definition)]`
  - `(select [distinct] ...) [as] [alias] [(field definition)]`
- CTE in with clause
  - `[recursive] identifier [(field list)] [as] (statement)`
- Resolve keywords for builds AST
  - `WITH, SELECT, FROM, WHERE, ORDER BY, GROUP BY, HAVING, UNION [ALL], INTERSECT, EXCEPT, LIMIT, OFFSET, CASE WHEN THEN ELSE END`
- Supported but without building AST (for now)
  - `DELETE, UPDATE, INSERT, SET, VALUES`
- Identifiers are (yes, in some databases, you can also use @, #, $, maybe someday I will add this option)
  - `[a-z|A-Z|0-9|_]`
  - `"[any chars]"`

## Examples and results
----
```sql
select schema_name, table_name, owner_name, table_space, description, accessible, inheritance, quote_ident(schema_name)||'.'||quote_ident(table_name) full_object_name, table_name object_name,
       foreign_table
  from (select n.nspname as schema_name, c.relname as table_name, pg_catalog.pg_get_userbyid(c.relowner) as owner_name, 
               coalesce(t.spcname, (select spcname from pg_database d join pg_tablespace t on t.oid = d.dattablespace where d.datname = case when n.nspname in ('pg_catalog', 'information_schema') then 'postgres' else current_database() end)) as table_space,
               case
                 when pg_catalog.pg_has_role(c.relowner, 'USAGE') then 'USAGE'
                 when (select true from pg_catalog.aclexplode(c.relacl) g where grantee = 0 limit 1) then 'PUBLIC'
                 --when pg_catalog.has_table_privilege('public', c.oid, 'SELECT, INSERT, UPDATE, DELETE, REFERENCES') then 'BY PUBLIC ROLE' 
                 when pg_catalog.has_table_privilege(c.oid, 'SELECT, INSERT, UPDATE, DELETE') then 'GRANTED' 
                 when pg_catalog.has_any_column_privilege(c.oid, 'SELECT, INSERT, UPDATE') then 'COLUMN'
               else 'NO' end accessible,
               d.description,
               (select 'inherits' from pg_catalog.pg_inherits i where i.inhrelid = c.oid union all select 'inherited' from pg_catalog.pg_inherits i where i.inhparent = c.oid limit 1) inheritance
              ,case c.relkind when 'f'::"char" then 
                 (select coalesce(coalesce(coalesce(substring(ftoptions::varchar from '[{,]schema=([#$\w]+)'), substring(ftoptions::varchar from '[{,]schema_name=([#$\w]+)'))||'.', '')||coalesce(substring(ftoptions::varchar from '[{,"]table=(([#$\w]+)|\(.+\))[",}]'), substring(ftoptions::varchar from '[{,"]table_name=(([#$\w]+)|\(.+\))[",}]')), '') from pg_foreign_table f /*join pg_foreign_server s on f.ftserver = s.oid*/ where f.ftrelid = c.oid)
               end foreign_table
          from pg_catalog.pg_class c
               left join pg_catalog.pg_namespace n on n.oid = c.relnamespace
               left join pg_catalog.pg_tablespace t on t.oid = c.reltablespace
               left join pg_catalog.pg_description d on d.classoid = 'pg_class'::regclass and d.objoid = c.oid and d.objsubid = 0
         where c.relkind in ('r'::"char", 'f'::"char", 'p'::"char")) t
 where (schema_name = 'orbada' or (schema_name = any (current_schemas(false)) and 'orbada' = current_schema() and schema_name <> 'public'))
 order by schema_name, table_name
```
- [Tokens JSON](doc/tokens.json)
- [AST JSON (without tokens)](doc/ast.json)

`analyzer.findUsedRelations(ast)`
```json
[
  {
    "type": "statement",
    "alias": "t",
    "component": { "id": 55, "component": "SOURCE", "tokens": [/* ... */], "components": [/* ... */] },
    "dependComponent": { "id": 57, "component": "STATEMENT", "tokens": [/* ... */], "components": [/* ... */] }
  },
  {
    "type": "relation",
    "name": ["pg_catalog", "pg_class"],
    "alias": "c",
    "component": { "id": 294, "component": "SOURCE", "tokens": [/* ... */], "components": [/* ... */] }
  },
  {
    "type": "relation",
    "name": ["pg_catalog", "pg_namespace"],
    "alias": "n",
    "component": { "id": 295, "component": "SOURCE", "tokens": [/* ... */], "components": [/* ... */] }
  },
  {
    "type": "relation",
    "name": ["pg_catalog", "pg_tablespace"],
    "alias": "t",
    "component": { "id": 296, "component": "SOURCE", "tokens": [/* ... */], "components": [/* ... */] }
  },
  {
    "type": "relation",
    "name": ["pg_catalog", "pg_description"],
    "alias": "d",
    "component": { "id": 297, "component": "SOURCE", "tokens": [/* ... */], "components": [/* ... */] }
  },
  {
    "type": "relation",
    "name": ["pg_database"],
    "alias": "d",
    "component": { "id": 96, "component": "SOURCE", "tokens": [/* ... */], "components": [/* ... */] }
  },
  {
    "type": "relation",
    "name": ["pg_tablespace"],
    "alias": "t",
    "component": { "id": 97, "component": "SOURCE", "tokens": [/* ... */], "components": [/* ... */] }
  },
  {
    "type": "function",
    "name": ["pg_catalog", "aclexplode"],
    "alias": "g",
    "component": { "id": 152, "component": "SOURCE", "tokens": [/* ... */], "components": [/* ... */] },
    "dependComponent": { "id": 154, "component": "VALUES", "tokens": [/* ... */], "components": [/* ... */] }
  },
  {
    "type": "relation",
    "name": ["pg_catalog", "pg_inherits"],
    "alias": "i",
    "component": { "id": 197, "component": "SOURCE", "tokens": [/* ... */], "components": [/* ... */] }
  },
  {
    "type": "relation",
    "name": ["pg_foreign_table"],
    "alias": "pg_foreign_table",
    "component": { "id": 288, "component": "SOURCE", "tokens": [/* ... */], "components": [/* ... */] }
  }
]
```
`analyzer.findRelationsAt(ast, 1010)`
```sql
when pg_catalog.has_table_privilege(c.oid, 'SELECT, INSERT, UPDATE, DELETE') then 'GRANTED' 
                                             ^
```
```json
[
  {
    "type": "relation",
    "name": ["pg_catalog", "pg_class"],
    "alias": "c",
    "component": { "id": 294, "component": "SOURCE", "tokens": [/* ... */], "components": [/* ... */] }
  },
  {
    "type": "relation",
    "name": ["pg_catalog", "pg_namespace"],
    "alias": "n",
    "component": { "id": 295, "component": "SOURCE", "tokens": [/* ... */], "components": [/* ... */] }
  },
  {
    "type": "relation",
    "name": ["pg_catalog", "pg_tablespace"],
    "alias": "t",
    "component": { "id": 296, "component": "SOURCE", "tokens": [/* ... */], "components": [/* ... */] }
  },
  {
    "type": "relation",
    "name": ["pg_catalog", "pg_description"],
    "alias": "d",
    "component": { "id": 297, "component": "SOURCE", "tokens": [/* ... */], "components": [/* ... */] }
  },
  {
    "type": "statement",
    "alias": "t",
    "component": { "id": 55, "component": "SOURCE", "tokens": [/* ... */], "components": [/* ... */] },
    "dependComponent": { "id": 57, "component": "STATEMENT", "tokens": [/* ... */], "components": [/* ... */] }
  }
]
```
`analyzer.resolveRelationColumns(...analyzer.findRelationsAt(ast, 1010))`
```json
[
  {
    "alias": "schema_name",
    "relation": {
      "type": "statement",
      "alias": "t",
      "component": { "id": 55, "component": "SOURCE", "tokens": [/* ... */], "components": [/* ... */] },
      "dependComponent": { "id": 57, "component": "STATEMENT", "tokens": [/* ... */], "components": [/* ... */] }
    },
    "component": { "id": 61, "component": "COLUMN", "tokens": [/* ... */], "components": [/* ... */] }
  },
  {
    "alias": "table_name",
    "relation": {
      "type": "statement",
      "alias": "t",
      "component": { "id": 55, "component": "SOURCE", "tokens": [/* ... */], "components": [/* ... */] },
      "dependComponent": { "id": 57, "component": "STATEMENT", "tokens": [/* ... */], "components": [/* ... */] }
    },
    "component": { "id": 62, "component": "COLUMN", "tokens": [/* ... */], "components": [/* ... */] }
  },
  {
    "alias": "owner_name",
    "relation": {
      "type": "statement",
      "alias": "t",
      "component": { "id": 55, "component": "SOURCE", "tokens": [/* ... */], "components": [/* ... */] },
      "dependComponent": { "id": 57, "component": "STATEMENT", "tokens": [/* ... */], "components": [/* ... */] }
    },
    "component": { "id": 63, "component": "COLUMN", "tokens": [/* ... */], "components": [/* ... */] }
  },
  {
    "alias": "table_space",
    "relation": {
      "type": "statement",
      "alias": "t",
      "component": { "id": 55, "component": "SOURCE", "tokens": [/* ... */], "components": [/* ... */] },
      "dependComponent": { "id": 57, "component": "STATEMENT", "tokens": [/* ... */], "components": [/* ... */] }
    },
    "component": { "id": 64, "component": "COLUMN", "tokens": [/* ... */], "components": [/* ... */] }
  },
  {
    "alias": "accessible",
    "relation": {
      "type": "statement",
      "alias": "t",
      "component": { "id": 55, "component": "SOURCE", "tokens": [/* ... */], "components": [/* ... */] },
      "dependComponent": { "id": 57, "component": "STATEMENT", "tokens": [/* ... */], "components": [/* ... */] }
    },
    "component": { "id": 65, "component": "COLUMN", "tokens": [/* ... */], "components": [/* ... */] }
  },
  {
    "alias": "description",
    "relation": {
      "type": "statement",
      "alias": "t",
      "component": { "id": 55, "component": "SOURCE", "tokens": [/* ... */], "components": [/* ... */] },
      "dependComponent": { "id": 57, "component": "STATEMENT", "tokens": [/* ... */], "components": [/* ... */] }
    },
    "component": { "id": 66, "component": "COLUMN", "tokens": [/* ... */], "components": [/* ... */] }
  },
  {
    "alias": "inheritance",
    "relation": {
      "type": "statement",
      "alias": "t",
      "component": { "id": 55, "component": "SOURCE", "tokens": [/* ... */], "components": [/* ... */] },
      "dependComponent": { "id": 57, "component": "STATEMENT", "tokens": [/* ... */], "components": [/* ... */] }
    },
    "component": { "id": 67, "component": "COLUMN", "tokens": [/* ... */], "components": [/* ... */] }
  },
  {
    "alias": "foreign_table",
    "relation": {
      "type": "statement",
      "alias": "t",
      "component": { "id": 55, "component": "SOURCE", "tokens": [/* ... */], "components": [/* ... */] },
      "dependComponent": { "id": 57, "component": "STATEMENT", "tokens": [/* ... */], "components": [/* ... */] }
    },
    "component": { "id": 68, "component": "COLUMN", "tokens": [/* ... */], "components": [/* ... */] }
  }
]
```

## Requirements
- Node.js (version 20 or newer)
- Installed dependencies from the `package.json` file

## Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/grobinx/sql-taaf.git
   ```
2. Navigate to the project directory:
   ```bash
   cd sql-taaf
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Install npm package
   ```bash
   npm i sql-taaf
   ```

## Tests
To run the test script, use the command:
```bash
npm start
```

## License
The project is available under the MIT license. Details can be found in the `LICENSE` file.
