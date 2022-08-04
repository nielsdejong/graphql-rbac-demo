# A demo GraphQL API with RBAC
This demo shows how to use Neo4j GraphQL with:
- An extended schema with custom directives
- Authentication
- Role management at the API level 
- Role management at the database level


JWT tokens are passed in the request header to accomplish authentication / authorization.


In this example, we demonstrate the following:
- The JWT tokens have the password `mypassword` in them, which is needed to access the API (Auth)
- User 'john' has role 'reader:bank' at the API level, allowing him to read bank nodes.
- User 'jane' does not have this role at the API level, so she cannot see banks.
- User 'john' has role 'reader2' at the database level, which denies him from reading phone numbers.
- The custom directive @uppercase is created, to transform a property name at query time.
- THe Cypher directive `bankAccountCount` is created to extend the GraphQL schema with a custom traversal.

To try this out, go through the following steps:


## 1. Start the API

```
npm install
node index.js
```

## 2. Cypher Queries
Create a new Neo4j database, and configure `index.js` with the correct credentials. Run the following Cypher queries to create test data:

```

CREATE (c:Customer{
    id: 1,
    associationMembership: "Neo4j",
    commercialRegId: 1234,
    companyIndex: "ABC",
    correspondenceLanguageEnumId: "English",
  dynamicSegment: "Segment",
  entFlag: "1",
  fineSegment: "Databases",
  mainAddressId: "Main Street 5, 1099AA, Amsterdam",
  mainSegment: "Software",
  mrkvUuid: apoc.create.uuid(),
  name: "Neo4j, Inc.",
  parentId: null,
  phone: "5555-5705",
  salesAreaEnumId: "IAOQ",
  stateEnumId: "NH",
  subfineSegment: "Graph Databases",
  symCmaId: "123",
  sKey: "932",
  turnover: "1000 billion",
  typeEnumId: "IOAMSD",
  uuid: apoc.create.uuid(),
  vasBarred: "false",
  vasEnabled: "true",
  websiteUrl: "https://neo4j.com",
  category: "Supplier",
  corporateEmail: "support@neo4j.com",
  fax: "1-555-5705",
  hasOpportunities: "true",
  languageEnumId: "English",
  personalUsageActiveYear: "9999",
  personalUsageMonthly: "500",
  postAccountNumber: "32940230941",
  type: "Supplier",
  vatNumber: "438529832"
});
```

```
CREATE (c2:Customer{
    id: 2,
    associationMembership: "Microsoft",
    commercialRegId: 1234,
    companyIndex: "DEF",
    correspondenceLanguageEnumId: "English",
  dynamicSegment: "Segment",
  entFlag: "1",
  fineSegment: "Computers",
  mainAddressId: "Side Street 25, 1099AA, Rotterdam",
  mainSegment: "Computer Industry",
  mrkvUuid: apoc.create.uuid(),
  name: "Microsoft, Inc.",
  parentId: null,
  phone: "2222-5705",
  salesAreaEnumId: "ASDAS",
  stateEnumId: "NH",
  subfineSegment: "Hardware and Software",
  symCmaId: "234235",
  sKey: "546",
  turnover: "5 billion",
  typeEnumId: "ASZAQD",
  uuid: apoc.create.uuid(),
  vasBarred: "false",
  vasEnabled: "true",
  websiteUrl: "https://microsoft.com",
  category: "Supplier",
  corporateEmail: "support@microsoft.com",
  fax: "1-566-5705",
  hasOpportunities: "false",
  languageEnumId: "English",
  personalUsageActiveYear: "888888",
  personalUsageMonthly: "3453",
  postAccountNumber: "43523498523",
  type: "Supplier",
  vatNumber: "292035"
});
```

```
MATCH (c:Customer)
WHERE c.id = 1
CREATE (c)-[:HAS_BANK_DETAILS]->(b:Bank{
    id: 435,
    name: "Rabobank",
    bankIban: ""NL09RABO9810003",
    uuid: apoc.create.uuid()
});
```

```
MATCH (c:Customer)
WHERE c.id = 2
CREATE (c)-[:HAS_BANK_DETAILS]->(b:Bank{
    id: 232,
    name: "ING Bank",
    bankIban:"NL32INGB320910101",
    uuid: apoc.create.uuid()
});
```

## 3. Set up roles at the database level.
Execute these on the system database:

```
CREATE USER john SET PASSWORD "john"  CHANGE NOT REQUIRED;
CREATE USER jane SET PASSWORD "jane"  CHANGE NOT REQUIRED;
GRANT ROLE reader TO john;
GRANT ROLE reader TO jane;
CREATE ROLE reader2 AS COPY OF reader;
GRANT role reader2 to john;
DENY READ {phone} ON GRAPH neo4j NODE Customer TO reader2;
```

## 4. Example GraphQL Queries
Inspect `schema.graphql` and see how authentication is configured:
- A user can only read its own data.
- Only users with role `reader:bank` can read `Bank` nodes.

Try out some GraphQL queries to inspect the GraphQL functionalities:

### Query 1: Get User 1's data - authenticated as user 1.
```
// Authenticated as user 1, read my data.
query User1Data {
  customers(where: { id:1 }) {
    id
    name
    name_uppercase
    phone
    uuid
    websiteUrl
    vatNumber
    bankAccountCount   
  }
}
```

Header:
```
authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjIsIm5hbWUiOiJKb2huIERvZSIsImlhdCI6MTUxNjIzOTAyMiwidXNlciI6ImpvaG4iLCJwYXNzd29yZCI6ImpvaG4iLCJyb2xlcyI6WyJyZWFkZXI6YmFuayJdfQ.yQqgg8kqDmjf5ALauap6EGhSo3B779bOtV-GBczAVWY
```

### Query 2: Get User 2's data - authenticated as user 2.
```
// Authenticated as user 2, read my data, plus my bank details.
query User2BankData {
  customers(where: { id: 2 }) {
    id
    name
    name_uppercase
    phone
    uuid
    websiteUrl
    vatNumber
    bankAccountCount

    hasBankDetailsBank {
      id
      bankIban
      bankCity
    }
  }
}
```

Header:
```
authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjIsInJvbGVzIjpbInJlYWRlcjpiYW5rIl0sIm5hbWUiOiJKb2huIERvZSIsImlhdCI6MTUxNjIzOTAyMn0.JR31YTf7ZDP6AwjenIxU8iBBQyK8LHhrX3ALYSY_A2Y
```

> Note that user 1 and user 2 cannot read eachother's data, try changing the ID to confirm this. Also - user 1 cannot see their own bank details, but user 2 can!

### Query 3: Try reading banks when authenticated as user 1
```
query BanksAsUser1 {
  banks {
    bankIban
    id
    bankCity
  }
}
```

Header:
```
authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjEsIm5hbWUiOiJKYW5lIERvZSIsImlhdCI6MTUxNjIzOTAyMiwidXNlciI6ImphbmUiLCJwYXNzd29yZCI6ImphbmUifQ.vRm_n30EQbvrpgPCRIdi9lQkReeyy4b7zAO_lSH7jwU
```

> This should give an error - user 1 is not allowed to read banks.

### Query 4: Try reading banks when authenticated as user 2
```
query BanksAsUser2 {
  banks {
    bankIban
    id
    bankCity
  }
}
```

Header:
```
authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjIsIm5hbWUiOiJKb2huIERvZSIsImlhdCI6MTUxNjIzOTAyMiwidXNlciI6ImpvaG4iLCJwYXNzd29yZCI6ImpvaG4iLCJyb2xlcyI6WyJyZWFkZXI6YmFuayJdfQ.yQqgg8kqDmjf5ALauap6EGhSo3B779bOtV-GBczAVWY
```

> This should work!

## Contact Details

For questions/comments about this PoC, reach out to niels.dejong@neo4j.com.


## Extra:

```
mutation {
    createBanks(input: { name: "ASN Bank" }) {
        movies {
            title
        }
    }
}
```