import express from 'express';
import 'dotenv/config';
import enrichRouter from './src/routes/enrich.js';

const app = express();
const port = process.env.port || 3000;

app.use(express.json());

app.get('/health',(req,res)=>{
    res.json({ status: 'ok'})
});

app.use(enrichRouter);

app.listen(port,()=>{
    console.log(`enrich api is running at http://localhost:${port}`);
})