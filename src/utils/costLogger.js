import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename= fileURLToPath(import.meta.url);
const __dirname= path.dirname(__filename);

const Log_Dir= path.join(__dirname,'../../logs');
if(!fs.existsSync(Log_Dir)){
    fs.mkdirSync(Log_Dir,{recursive:true});
}
const costFilePath= path.join(Log_Dir,'cost.jsonl');

export function logModelCall(data){
    const costEntry = {
        TimeStamp: new Date().toISOString(),
        PromptVersion: data.promptVersion || 'v1',
        ModelName: data.modelName || 'unknown',
        InputTokens:data.inputTokens || 0,
        OutputTokens:data.outputTokens || 0,
        TotalTokens: (data.inputTokens || 0)+ (data.outputTokens||0),
        DurationMs: data.durationMs || 0,
        NeededRepair: data.needRepair || false,
        Status: data.status || 'unknown'
    }
    try{
          fs.appendFileSync(costFilePath,JSON.stringify(costEntry)+ '\n','utf-8')
    }
    catch(error){
         console.error('Failed to write to cost log file',error.message);
    }
}



export function calculateEstimateCost(inputTokens,outputTokens,modelName){

    if(modelName.includes('lama')|| modelName.includes('ollama')){
        return{
            estimatedCost: 0,
            currency:'USD',
            note : 'Ollama is free(local) '
        }
    }
    const inputCost = (inputTokens/1000)*0.0007;
    const outputCost = (outputTokens/1000)*0.0009;
    return{
        estimatedCost: inputCost+outputCost,
        currency: 'USD',
        note: 'Rough cost estimated'
    }

}