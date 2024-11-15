const { app } = require('@azure/functions');
const { DefaultAzureCredential } = require("@azure/identity");
const { SecretClient } = require("@azure/keyvault-secrets");
const axios = require("axios");

// Set up Key Vault client
const credential = new DefaultAzureCredential();
const vaultName = "safety-genai-001-dev-kv";
const keyVaultUrl = `https://${vaultName}.vault.azure.net`;
const client = new SecretClient(keyVaultUrl, credential);

app.http('submitPrompt', {
    methods: ['POST'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        context.log(`HTTP function processed request for URL "${request.url}"`);

        try {
            // Get the prompt from the request body
            const { prompt } = await request.json();
            if (!prompt) {
                throw new Error("Prompt is required in the request body.");
            }

            // Retrieve OpenAI credentials from Key Vault
            context.log("Attempting to retrieve OpenAI credentials from Key Vault");
            const openaiEndpoint = (await client.getSecret("openai-gpt4o-model-endpoint-dev")).value.trim();
            const apiKey = (await client.getSecret("openai-gpt4o-model-key-dev")).value.trim();
            context.log("Retrieved OpenAI credentials successfully");

            // Call the OpenAI API
            context.log("Sending request to OpenAI API");
            const response = await axios.post(
                openaiEndpoint,
                { messages: [{ role: "user", content: prompt }], max_tokens: 150 },
                {
                    headers: {
                        "Content-Type": "application/json",
                        "api-key": apiKey,
                    },
                }
            );

            const aiResponse = response.data?.choices?.[0]?.message?.content || "No response from OpenAI";
            context.log("OpenAI response received:", aiResponse);

            // Return the OpenAI response to the frontend
            return { status: 200, body: JSON.stringify({ responseText: aiResponse } )};
        } catch (error) {
            context.log.error("Error in Azure Function:", error.message || error);
            return { status: 500, body: { error: "Failed to retrieve response from OpenAI", details: error.message || error } };
        }
    }
});
