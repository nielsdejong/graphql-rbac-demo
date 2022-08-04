const path = require("path");
const fs = require("fs");
const { Neo4jGraphQL } = require("@neo4j/graphql");
const { ApolloServer, gql } = require("apollo-server");
const neo4j = require("neo4j-driver");
const { mapSchema, getDirective, MapperKind } = require('@graphql-tools/utils');
const { Neo4jGraphQLAuthJWTPlugin } = require("@neo4j/graphql-plugin-auth")

// Read the graphql schema from the file system.
const typeDefs = fs
    .readFileSync(
        process.env.GRAPHQL_SCHEMA || path.join(__dirname, 'schema.graphql')
    )
    .toString('utf-8')

// Set up default Neo4j driver with admin credentials. Will be overridden at query time.
const driver = neo4j.driver(
    "neo4j://localhost:7687",
    neo4j.auth.basic("neo4j", "neo")
);

// An example of a custom directive implementation. This one converts all strings to uppercase.
function upperDirective(directiveName) {
    return {
        upperDirectiveTypeDefs: `directive @${directiveName} on FIELD_DEFINITION`,
        upperDirectiveTransformer: (schema) =>
            mapSchema(schema, {
                [MapperKind.OBJECT_FIELD]: (fieldConfig) => {
                    const fieldDirective = getDirective(schema, fieldConfig, directiveName)?.[0];
                    if (fieldDirective) {
                        const { resolve = defaultFieldResolver } = fieldConfig;
                        fieldConfig.resolve = async (source, args, context, info) => {
                            const result = await resolve(source, args, context, info);
                            if (typeof result === "string") {
                                return result.toUpperCase();
                            }
                            return result;
                        };
                    }
                    return fieldConfig;
                },
            }),
    };
}


// Initialize the transformer for the custom directive.
const { upperDirectiveTypeDefs, upperDirectiveTransformer } = upperDirective("uppercase");

// Set up the Neo4j GraphQL schema, including the custom directive, and auth.
const neoSchema = new Neo4jGraphQL({
    typeDefs: [
        upperDirectiveTypeDefs,
        typeDefs,
    ],
    driver,
    plugins: {
        auth: new Neo4jGraphQLAuthJWTPlugin({
            secret: "mypassword" // Important! This is what your consumer uses to authenticate with the API.
        })
    }
});

// Helper function to parse JWT tokens.
function parseJwt(token) {
    var base64Payload = token.split('.')[1];
    var payload = Buffer.from(base64Payload, 'base64');
    return JSON.parse(payload.toString());
}


neoSchema.getSchema().then((schema) => {
    // by passing the username as either a HTTP header or in a JWT, 
    // creating a driver session with the impersonation details set to that user,
    ///  and then inject that session into the context of the request.
    // The generated Cypher will then be executed using that session.
    const transformedSchema = upperDirectiveTransformer(schema);
    const server = new ApolloServer({
        schema: transformedSchema,
        context: ({ req }) => {
            const auth = req.headers.authorization;
            const payload = parseJwt(auth.split(" ")[1]);
            // To productionalize this, add a connection session pool handler.
            // Or do a proper Neo4j impersonation (Neo4j 4.4 onwards).
            // Neo4j GraphQL will have a 'native' impersonation feature in the future.


            // If a user tells us their roles, we also need to check those in the database.
            // That can be an alternative to 'impersonation' as we are doing here.
            const driver = neo4j.driver(
                "neo4j://localhost:7687",
                neo4j.auth.basic(payload.user, payload.password)
            );
            return {
                req, driver
            };
        },
    });

    server.listen().then(({ url }) => {
        console.log(`🚀 Server ready at ${url}`);
    });
})

// To use auth - add header 'authorization' to your request.

/**
 * Token for user 1: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjEsIm5hbWUiOiJKYW5lIERvZSIsImlhdCI6MTUxNjIzOTAyMiwidXNlciI6ImphbmUiLCJwYXNzd29yZCI6ImphbmUifQ.vRm_n30EQbvrpgPCRIdi9lQkReeyy4b7zAO_lSH7jwU
    {
        sub: 1,
        name: 'Jane Doe',
        iat: 1516239022,
        user: 'jane',
        password: 'jane'
    }

    Encoding with secret "mypassword".
 */

/**
 * Token for user 2: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjIsIm5hbWUiOiJKb2huIERvZSIsImlhdCI6MTUxNjIzOTAyMiwidXNlciI6ImpvaG4iLCJwYXNzd29yZCI6ImpvaG4iLCJyb2xlcyI6WyJyZWFkZXI6YmFuayJdfQ.yQqgg8kqDmjf5ALauap6EGhSo3B779bOtV-GBczAVWY

    {
        sub: 2,
        name: 'John Doe',
        iat: 1516239022,
        user: 'john',
        password: 'john',
        "roles": [
            "reader:bank"
        ]
    }

    Encoding with secret "mypassword".
 */
