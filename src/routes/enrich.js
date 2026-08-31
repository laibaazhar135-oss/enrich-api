import { Router } from "express";
import { enrichinputchema } from "../llm/schema.js";
import {enrichBook} from '../llm/client.js';
import { enrichandvalidate } from "../llm/parse-repair.js";

const router = Router();

router.post('/enrich',async(req,res)=>{
    const parsedinput= enrichinputchema.safeParse(req.body);
    if(!parsedinput.success){
        const firstissue= parsedinput.error.issues[0];
        const field=firstissue.path.join('.');
        return res.status(400).json({
            error: `Invalid or missing field: ${field}`
        });
    }

    const {title,description}= parsedinput.data;


// stage 2.....
// if(process.env.LLM_STUB==='1'){
//     const stubResponce= {
//         category: 'fiction',
//         summary: 'a stub responce - no model called yet',
//         quality_flags: ['looks-fine'],
//         confidence: 0.42
//     }

//     const parsedoutput= enrichoutputschema.safeParse(stubResponce);
//     if(!parsedoutput.success){
//         return res.status(500).json({ 
//             error: 'Stub responce schema wasnt correct-fix the stub'})
//     }
//     return res.status(200).json(parsedoutput.data);
// }
// res.status(501).json({error: 'Model call code wasnt implemented - set you stub to 1 to test this endpoint'});



if(process.env.LLM_ENABLED==='false'){
    console.warn(`LLM is disabled...LLM stub is false`);
    return res.status(503).json({
        error: `AI enrichment is temporarily unavailable`,
        details:`LLM_ENABLED is false`
    })

}

try{
    const responce= await enrichBook(title,description);

    const enrichResult= await enrichandvalidate(title,description,responce);

    if(!enrichResult.success){
       return res.status(enrichResult.statuscode).json({
            error: enrichResult.error
        })
    }

    res.status(200).json(enrichResult.data);
}
catch(error){
    const errorMessage = error.message;
    if(errorMessage.includes('TIMEOUT')||errorMessage.includes('30000')||error.code==='ETIMEDOUT'){
        console.error(`LLM call failed cuz time out: `,errorMessage);
        return res.status(504).json({
            error: `Model call timed out,pls try again`,
            details: `The upstream model service didnt response in 30 seconds`
        })
    }
    if(error.status===401){
        console.error(`Authentication failed(likely bad api): `,error.message);
        return res.status(401).json({
            error: `LLM authentication failed`,
            details:`Check that LLM api key is configured correctly`
        })
    }
    if(error.status===429){
        console.error(`Rate limited after retries`,errorMessage);
        return res.status(429).json({
            error: `API rate limit exceeded`,
            details:`Too many requests .Please try again later..`
        })
    }
    console.error(`Enrich endpoint error: `,errorMessage);
    return res.status(500).json({
        error: `Enrich call failed`,
        details:errorMessage
    })
}

});

export default router;