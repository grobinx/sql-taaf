# SQL Analyzer

## Description
SQL Analyzer is a tool designed for analyzing SQL queries. The package enables parsing SQL queries, building an Abstract Syntax Tree (AST), and analyzing dependencies and relations used in queries.

The project was created for the DBORG project (not yet released) with the support of GitHub Copilot.

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
