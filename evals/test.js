import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';
import 'dotenv/config';

const __filename= fileURLToPath(import.meta.url);
const __dirname= path.dirname(__filename);

const casesPath = path.join(__dirname,'cases.json');
const cases = JSON.parse(fs.readFileSync(casesPath,'utf-8'));

const API_URL= 'http://localhost:3000/enrich';
const TIMEOUT_MS=10000;

async function testCase(testCase){
    try{
    const response = await fetch(API_URL,{
        method: 'POST' ,
        headers:{'Content-Type': 'application/json'},
        body:JSON.stringify({
            title: testCase.title,
            description: testCase.description
        }),
        timeout: TIMEOUT_MS
    });
    if(!response.ok){
        return {
            id: testCase.id,
            title:testCase.title,
            error: `HTTP ${response.status}`,
            passed: false,
            expected: testCase.expected_category,
            actual:null
        }
    }
    const data = await response.json();
    const category_match = data.category===testCase.expected_category;
    return{
        id:testCase.id,
        title:testCase.title,
        passed:category_match,
        expected:testCase.expected_category,
        actual:data.category,
        confidence:data.confidence,
        reason: testCase.reason
    }
}
catch(error){
    return{
        id: testCase.id,
        title:testCase.title,
        error: error.message,
        passed: false,
        expected: testCase.expected_category,
        actual:null
    };
}
}

async function runAllTests(){
    console.log(`\n${'='.repeat(80)}`);
    console.log(`Test cases: Stage 5  evaluation-running all cases`);
    console.log(`\n${'='.repeat(80)}`);
    const results=[];
    for(let testcase of cases){
        const result = await testCase(testcase);
        results.push(result);
        if(result.passed){
            console.log(`PASS`)
        }
        else{
            console.log(`Failed- expected: ${result.expected},got: ${result.actual}`);
        }
    }
    const passed = results.filter((r)=>r.passed).length;
    const total = results.length;
    const percentage = (passed / total)*100;
    console.log(`Total ${passed}/${total} passed - percentage : ${percentage}`);
    console.log(`${'='.repeat(80)}`);

    const failed = results.filter((r)=>!r.passed);
    if(failed.length>0){
        console.log(`Failed cases: `);
        failed.forEach((f)=>{
            console.log(` Case ${f.id} failed - "${f.title}" , expected: ${f.expected} got: ${f.actual}`);
        });
        console.log();
    }
    const resultFile = path.join(__dirname,'results.json');
    fs.writeFileSync(resultFile,JSON.stringify({
        date: new Date().toISOString(),
        prompt_version:'v1',
        model_name:process.env.LLM_MODEL,
        score: `${passed}/${total}`,
        percentage:`${percentage}`,
        cases: results
    },null,2),'utf-8');
    console.log(`Results saved to evals/results.json`);
    console.log();

    return {passed,total,percentage};
}

runAllTests().catch(console.error);

