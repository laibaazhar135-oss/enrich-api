import { Router } from "express";
import { enrichinputchema,enrichoutputschema } from "../llm/schema.js";

const router = Router();

router.post('/enrich',(req,res)=>{
    const parsedinput= enrichinputchema.safeParse(req.body);
    if(!parsedinput.success){
        const firstissue= parsedinput.error.issues[0];
        const field=firstissue.path.join('.');
        return res.status(400).json({
            error: `Invalid or missing field: ${field}`
        });
    }


if(process.env.LLM_STUB==='1'){
    const stubResponce= {
        category: 'fiction',
        summary: 'a stub responce - no model called yet',
        quality_flags: ['looks-fine'],
        confidence: 0.42
    }

    const parsedoutput= enrichoutputschema.safeParse(stubResponce);
    if(!parsedoutput.success){
        return res.status(500).json({ 
            error: 'Stub responce schema wasnt correct-fix the stub'})
    }
    return res.status(200).json(parsedoutput.data);
}
res.status(501).json({error: 'Model call code wasnt implemented - set you stub to 1 to test this endpoint'});

});

export default router;