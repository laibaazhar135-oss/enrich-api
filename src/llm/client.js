import { OpenAI } from 'openai';
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';

const __filename= fileURLToPath(import.meta.url);
const __dirname= path.dirname(__filename);

const client = new OpenAI({
    baseURL: process.env.LLM_BASE_URL,
    apiKey:process.env.LLM_API_KEY
})

const promptpath= path.join(__dirname,'../prompts/enrich-v1.md');
const systemPrompt = fs.readFileSync(promptpath,'utf-8');

export async function enrichBook(title,description,customPrompt=null) {
    const usermessage= JSON.stringify({
        title,
        description
    })
    try{
           const responce = await client.chat.completions.create({
            model: process.env.LLM_MODEL,
            messages:[
                {role:'system',content:customPrompt || systemPrompt},
                {role:'user',content:usermessage}
            ],
            temperature:0.2,
            max_tokens:500,
            timeout:30000
           });
           const answer = responce.choices[0]?.message?.content;
           if(!answer){
            throw new Error('Model returned an empty responce');
           } 
           return answer;
    }
    catch(error){
         throw new Error(`LLM call failed: ${error.message}`);
    }
}
export default enrichBook;