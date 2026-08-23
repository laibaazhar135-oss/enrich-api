import OpenAI from "openai";
import 'dotenv/config';

const client= new OpenAI({
    baseURL: process.env.LLM_BASE_URL,
   apiKey: process.env.LLM_API_KEY  
});

async function main() {
    const responce= await client.chat.completions.create({
        model: process.env.LLM_MODEL,
        messages: [{
            role: 'user',
            content:'reply with just word: ready'
        }]
    });
    console.log(responce.choices[0].message.content);
}
main().catch(console.error);
