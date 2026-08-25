import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';
import {enrichBook} from './client.js';
import { enrichoutputschema } from './schema.js';

const __filename= fileURLToPath(import.meta.url);
const __dirname= path.dirname(__filename);

const quarantine_dir= path.join(__dirname,'../../logs');
if(!fs.existsSync(quarantine_dir)){
    fs.mkdirSync(quarantine_dir,{ recursive:true})
}

const quarantine_file = path.join(quarantine_dir,'quarantineLogs.jsonl');

export function parseText(raw_text){
    if(!raw_text || typeof raw_text!=='string'){
        return null;
    }
    const jsonfencematch = raw_text.match(/```json\s*([\s\S]*?)\s*```/);
    if(jsonfencematch){
        try{
             return JSON.parse(jsonfencematch[1]);
        }
        catch(error){

        }
    }
    const plainfencematch= raw_text.match(/```\s*([\s\S]*?)\s*```/);
    if(plainfencematch){
        try{
            return JSON.parse(plainfencematch[1]);
        }
        catch(error){

        }
    }
    const objectmatch= raw_text.match(/\{[\s\S]*\}/);
    if(objectmatch){
        try{
            return JSON.parse(objectmatch[0]);
        }
        catch(error){

        }
    }
    return null;
}

export function validateOutput(parsedOutput){
    const result= enrichoutputschema.safeParse(parsedOutput);
    if(result.success){
          return {
            valid: true,
            data:result.data
          }
    }
    const firstissue= result.error.issues[0];
    return {
        valid: false,
        error: `${firstissue.path.join('.')}: ${firstissue.message}`
    }
}

export async function repaireOnce(title,description,rawfailedoutput,validationError) {
     const repairPrompt= `You previously returned this output: ${rawfailedoutput},
     this is the reason its rejected: ${validationError},
     Please return a corrected Json object that exactly match the output schema.Return only JSON object,no extra explanation,no code fences,no leading/trailing text`;
    try{
   const repairAnswer = await enrichBook(title,description,repairPrompt);

     const parsed= parseText(repairAnswer);
     if(!parsed){
        return {
            success: false,
            error:`Repaired attempt returned unparsable JSON`,
            rawResponce: repairAnswer
        };
    }
        const validate= validateOutput(parsed);
        if(validate.valid){
            return {
                success: true,
                data: validate.data
            };
        }

        return {
            success: false,
            error: 'Repare validation failed',
            data: rawfailedoutput
        }

     

   }
    catch(error){
        return { error: `Repair model call itself failed: ${error.message}`}
    }

}

export function quaratineFailure(context){
    const quarantineEntry = {
        Timestamp: new Date().toISOString(),
        book_title: context.title,
        book_description: context.description,
        rawmodeloutput: context.rawmodelOutput,
        validation_error: context.validationError,
        prompt_version: context.promptVersion|| 'v1',
        attempt_version: context.attemptVersion|| 1
    };

     try{
        fs.appendFileSync(quarantine_file,JSON.stringify(quarantineEntry)+'\n','utf-8');
     }
     catch(error){
        console.error(`Failed to write to quarantine file: ${error.message}`);
     }

}

export async function enrichandvalidate(title,description,rawoutput){
        
    const parsed= parseText(rawoutput);
    if(!parsed){
        return {
            success: false,
            error: `Returned output was not valid JSON`,
            statuscode: 422
        }
    }
    const validate = validateOutput(parsed);
    if(validate.valid){
        return{
            success: true,
            data: validate.data
        }
    }
    console.log(`Validation failed: ${validate.error}, now attempting second call`);

    const result= await repaireOnce(title,description,rawoutput,validate.error);
    if(result.success){
            console.log(`repair succeeded for : ${title}`)
        return {
            success:true,
            data: result.data
        }
    }
      console.error(`Repair also failed for "${title}": ${result.error}`);

    quaratineFailure({
    title,
    description,
    rawModelOutput: result.rawOutput || rawoutput,
    validationError: result.error,
    promptVersion: 'v1',
    attemptNumber: 2 
  });
  return{
    success: false,
    statuscode: 422,
    error: `Repair model call fail again , logged in quarantine file for manual view`
  }
}