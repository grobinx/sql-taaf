# SQL Analyzer

## Description
SQL Analyzer is a tool designed for analyzing SQL queries. The package enables parsing SQL queries, building an Abstract Syntax Tree (AST), and analyzing dependencies and relations used in queries.

The project was created for the DBORG project (the younger brother of ORBADA available on sf.net) (not yet released) with the support of GitHub Copilot.

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
  - Identifies tables and other objects used in queries.
- **Example usage**:
  ```typescript
  const tokenizer = new SqlTokenizer();
  const tokens = tokenizer.parse("SELECT * FROM users");
  const astBuilder = new SqlAstBuilder();
  const ast = astBuilder.build(tokens);

  if (ast) {
      const analyzer = new SqlAnalyzer(ast);
      console.log(analyzer.findDependencyAt(10)); // Finds dependencies at a specific query location
      console.log(analyzer.findUsedRelations()); // Displays used tables
  }
  ```

## Features
- **SQL Query Parsing**: Breaks down SQL queries into tokens.
- **Building AST (Abstract Syntax Tree)**: Creates a tree structure based on the SQL query.
- **Dependency Analysis**: Identifies dependencies in SQL queries.
- **Relation Analysis**: Finds used tables and other objects in SQL queries.

## Example Usage
Test code demonstrating the basic functionalities of the package:

```typescript
const tokenizer = new SqlTokenizer();
const tokens = tokenizer.parse("SELECT * FROM users");
const astBuilder = new SqlAstBuilder();
const ast = astBuilder.build(tokens);

if (ast) {
    const analyzer = new SqlAnalyzer(ast);
    console.log(analyzer.findDependencyAt(10));
    console.log(analyzer.findUsedRelations());
}
```

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
## Output
- [Tokens JSON](doc/tokens.json)
- [AST JSON](doc/ast.json)

`analyzer.findDependencyAt(410)`
```sql
coalesce(t.spcname, (select spcname from pg_database d join pg_tablespace t on t.oid = d.dattablespace where d.datname = case when
                                                            ^
```
```json
[
  { "id": 102, "component": "IDENTIFIER", "tokens": ["..."] },
  { "id": 97, "component": "SOURCE", "tokens": ["..."], "components": ["..."] },
  { "id": 90, "component": "FROM", "tokens": ["..."], "components": ["..."] },
  { "id": 88, "component": "STATEMENT", "tokens": ["..."], "components": ["..."] },
  { "id": 86, "component": "EXPRESSION", "tokens": ["..."], "components": ["..."] },
  { "id": 84, "component": "VALUES", "tokens": ["..."], "components": ["..."] },
  { "id": 81, "component": "EXPRESSION", "tokens": ["..."], "components": ["..."] },
  { "id": 64, "component": "COLUMN", "tokens": ["..."], "components": ["..."] },
  { "id": 58, "component": "SELECT", "tokens": ["..."], "components": ["..."] },
  { "id": 57, "component": "STATEMENT", "tokens": ["..."], "components": ["..."] },
  { "id": 55, "component": "SOURCE", "tokens": ["..."], "components": ["..."] },
  { "id": 2, "component": "FROM", "tokens": ["..."], "components": ["..."] },
  { "id": 374, "component": "STATEMENT", "tokens": ["..."], "components": ["..."] }
]
```
`analyzer.findUsedRelations()`
```json
[
  { "parts": ["pg_database"], "alias": "d" },
  { "parts": ["pg_tablespace"], "alias": "t" },
  { "parts": ["pg_catalog", "aclexplode"], "alias": "g" },
  { "parts": ["pg_catalog", "pg_inherits"], "alias": "i" },
  { "parts": ["pg_foreign_table"], "alias": "pg_foreign_table" },
  { "parts": ["pg_catalog", "pg_class"], "alias": "c" },
  { "parts": ["pg_catalog", "pg_namespace"], "alias": "n" },
  { "parts": ["pg_catalog", "pg_tablespace"], "alias": "t" },
  { "parts": ["pg_catalog", "pg_description"], "alias": "d" }
]
```
`analyzer.ownerStatementColumns(1010)`
```sql
when pg_catalog.has_table_privilege(c.oid, 'SELECT, INSERT, UPDATE, DELETE') then 'GRANTED' 
                                             ^
```
```json
[
  { "alias": "schema_name", "component": { /* ... */ } },
  { "alias": "table_name", "component": { /* ... */ } },
  { "alias": "owner_name", "component": { /* ... */ } },
  { "alias": "table_space", "component": { /* ... */ } },
  { "alias": "accessible", "component": { /* ... */ } },
  { "alias": "description", "component": { /* ... */ } },
  { "alias": "inheritance", "component": { /* ... */ } },
  { "alias": "foreign_table", "component": { /* ... */ } }
]
```
`analyzer.findRelationAliasAt('c', 755)`
```sql
when (select true from pg_catalog.aclexplode(c.relacl) g where grantee = 0 limit 1) then 'PUBLIC'
                                              ^
```
```json
{ "parts": ["pg_catalog", "pg_class"], "alias": "c", "component": { /* ... */ } }
```

## Requirements
- Node.js (version 20 or newer)
- Installed dependencies from the `package.json` file

## Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/username/sql-analyzer.git
   ```
2. Navigate to the project directory:
   ```bash
   cd sql-analyzer
   ```
3. Install dependencies:
   ```bash
   npm install
   ```

## Tests
To run the test script, use the command:
```bash
npm start
```

## License
The project is available under the MIT license. Details can be found in the `LICENSE` file.
