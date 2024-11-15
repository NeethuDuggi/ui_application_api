const { app } = require('@azure/functions');
const mysql = require("mysql2/promise");
const { DefaultAzureCredential } = require("@azure/identity");
const { SecretClient } = require("@azure/keyvault-secrets");

// Set up Key Vault client
const credential = new DefaultAzureCredential();
const vaultName = "safety-genai-001-dev-kv";
const keyVaultUrl = `https://${vaultName}.vault.azure.net`;
const client = new SecretClient(keyVaultUrl, credential);

// Function to retrieve secrets from Key Vault
async function getSecret(secretName) {
    const secret = await client.getSecret(secretName);
    return secret.value.trim();
}

// Function to establish a connection to the MySQL database
async function connectToDatabase() {
    const host = await getSecret("mysql-host-dev");
    const user = await getSecret("mysql-admin-user-dev");
    const password = await getSecret("mysql-admin-pass-dev");
    const database = await getSecret("mysql-db-dev");
    const port = await getSecret("mysql-port-dev");

    const connection = await mysql.createConnection({
        host,
        user,
        password,
        database,
        port: parseInt(port),
    });

    return connection;
}

// Define the database handler function
app.http('databaseHandler', {
    methods: ['GET', 'POST', 'DELETE'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        try {
            const connection = await connectToDatabase();

            if (request.method === "GET") {
                const [rows] = await connection.query("SELECT id, prompt FROM prompt WHERE prompt_type_id = 1");
                context.log("Data retrieved successfully.");
                return { status: 200, body:  JSON.stringify({ message: "Data retrieved successfully", data: rows } )};
            } else if (request.method === "POST") {
                const { prompt } = await request.json();
                if (!prompt) throw new Error("Prompt is required in the request body.");
                await connection.query("INSERT INTO prompt (prompt, created_date, created_by, prompt_type_id) VALUES (?, NOW(), 'admin', 1)", [prompt]);
                context.log("Prompt added successfully.");
                return { status: 200, body: { message: "Prompt added successfully" } };
            } else if (request.method === "DELETE") {
                const { id } = await request.json();
                if (!id) throw new Error("Prompt ID is required to delete a prompt.");
                await connection.query("DELETE FROM prompt WHERE id = ?", [id]);
                context.log("Prompt deleted successfully.");
                return { status: 200, body: { message: "Prompt deleted successfully" } };
            }

            await connection.end();
        } catch (error) {
            context.log.error("Error in databaseHandler function:", error.message);
            return { status: 500, body: { error: "Failed to process the request", details: error.message } };
        }
    }
});
