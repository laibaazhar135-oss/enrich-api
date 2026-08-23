import fs from 'fs';
import pool from './pgConnection.js';

const raw = fs.readFileSync('./books.json','utf-8');
const books= JSON.parse(raw);

async function seed() {
let inserted=0;
let skipped=0;    

for(let book of books){
    if(!book.title || typeof book.title!== 'string'){
       console.log(`Skipping the record of book with invalid/missing title`);
       skipped++;
       continue;
    }
    await pool.query(`INSERT INTO books (title,description,price_gbp,rating_text) VALUES($1,$2,$3,$4)`,
        [
            book.title,
            book.description??null,
            book.price_gbp??null,
            book.rating_text??null 
        ]
    );
    inserted++;
}
console.log(`DONE. Inserted: ${inserted} and skipped: ${skipped}`);
await pool.end();
}
seed().catch((err)=>{
    console.log(`Seed failed: `,err);
    process.exit(1);
});