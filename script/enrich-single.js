import pool from '../db/pgConnection.js';

const API_URL= 'http://localhost:3000/enrich'

async function enrichSingleBook(bookid) {
    try{
        console.log(`Fetching book ${bookid} from database`)
    const response = await pool.query('SELECT id, title,description FROM books WHERE id = $1',[bookid]);
        if(response.rows.length===0){
            console.error(`book ${bookid} not found in database`);
            return;
        }
        const data = response.rows[0];
        console.log(`Enriching data with model call....`);
        const result = await fetch(API_URL,{
            method: 'POST',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify({
                title:data.title,
                description:data.description
            }),
            timeout:10000
        })
        if(!result.ok){
            console.error(`Enrich API failed with status: ${result.status}`);
            return;
        }

        console.log(`Enriched data successfully..`);

        const Data = await result.json();

        console.log(`Writing the enrich data in database...`);

        await pool.query('UPDATE books SET category=$1,summary=$2,quality_flags=$3::text[],confidence=$4,enriched_at= NOW() WHERE id= $5',[Data.category,Data.summary,Data.quality_flags,Data.confidence,data.id]);

        console.log(`Enriched data  of book ${data.id} successfully written at database check..db`);
    }

    catch(error){
        console.error(`Error enriching book: ${bookid}`,error.message);
    }
}

enrichSingleBook(1)
    .then(()=>{
        console.log(`Test complete ,check your database...`)
        process.exit(0);
    })
    .catch((err)=>{
        console.error(`Test failed to enrich and save book details`,err);
        process.exit(1);
   } )