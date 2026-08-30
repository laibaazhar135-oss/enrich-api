import  OpenAI  from 'openai';
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';
import { isRetryableError,sleep,exponentialbackoffwithjitter } from '../utils/retry.js';
import { logModelCall } from '../utils/costLogger.js';

const __filename= fileURLToPath(import.meta.url);
const __dirname= path.dirname(__filename);

const client = new OpenAI({
    baseURL: process.env.LLM_BASE_URL,
    apiKey:process.env.LLM_API_KEY,
    maxRetries:0
})

const promptpath= path.join(__dirname,'../prompts/enrich-v1.md');
const systemPrompt = fs.readFileSync(promptpath,'utf-8');

export async function enrichBook(title,description,customPrompt=null) {
    const usermessage= JSON.stringify({
        title,
        description
    })
    const MAX_RETRIES_ATTEMPT= 3;
    let attemptNumber=0;
    const startTime= Date.now();
    let lastError=null;

    for(attemptNumber=0;attemptNumber<MAX_RETRIES_ATTEMPT;attemptNumber++){
    try{
           const response = await client.chat.completions.create({
            model: process.env.LLM_MODEL,
            messages:[
                {role:'system',content:customPrompt || systemPrompt},
                {role:'user',content:usermessage}
            ],
            temperature:0.2,
            max_tokens:500,
            timeout:30000
           });
           const answer = response.choices[0]?.message?.content;
           if(!answer){
            throw new Error('Model returned an empty response');
           } 
           const durationms= Date.now() -  startTime;
           logModelCall({
                promptVersion:'v1',
                modelName:process.env.LLM_MODEL,
                inputTokens:response.usage?.prompt_tokens || 0,
                outputTokens:response.usage?.completion_tokens||0,      
                durationMs:durationms,          
                neededRepair:!!customPrompt,
                status: 'success'
           });
           return answer;
    }
    catch(error){
        lastError= error;
        const {retryable,statusCode}= isRetryableError(error);
        const durationms= Date.now()-startTime;
         logModelCall({
               promptVersion:'v1',
               modelName:process.env.LLM_MODEL,
               inputTokens:0,
               outputTokens:0,
               durationMs:durationms,
               neededRepair:!!customPrompt,
               status: `failed_${statusCode||'unknown'}`
        });
        if(!retryable){
               console.error(`Model call failed with non retryable error: ${statusCode} :${error.message}`)
               throw new Error(`LLM call failed with ${statusCode} : ${error.message} `);
        }
        if(attemptNumber=== MAX_RETRIES_ATTEMPT-1){
            console.error(`LLM call failed after ${MAX_RETRIES_ATTEMPT} attempts : ${error.message}`);
            throw new Error(`LLM call failed after ${MAX_RETRIES_ATTEMPT} attempts : ${error.message}`);
        }

        const waitms= exponentialbackoffwithjitter(attemptNumber);
        console.log(`Attempt ${attemptNumber}/${MAX_RETRIES_ATTEMPT} failed , retrying again after ${waitms} seconds`);
        await sleep(waitms);
    }
}
throw lastError || new Error(`Unknown error in enrich book retry loop`);
}
