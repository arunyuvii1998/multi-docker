const keys = require('./keys');

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const redis = require('redis');

const app = express();

app.use(cors());
app.use(bodyParser.json());

// Postgress Client Setup
const { Pool } = require('pg');
const pgClient = new Pool({
    user: keys.pgUser,
    host: keys.pgHost,
    database: keys.pgDatabase,
    password: keys.pgPassword,
    port: keys.pgPort
});

pgClient.on('error', () => { console.log('Lost PG Connection'); });

pgClient
    .query("CREATE TABLE IF NOT EXISTS values (number INT)")
    .catch(err => { console.log(err); });

const redisClient = redis.createClient({
    host: keys.redisHost,
    port: keys.redisPort,
    retry_strategy: () => 1000
});

const redisPublisher = redisClient.duplicate();

// Express route handlers

app.get('/', (req,res) => {
    res.status(200).send('Hi There');
});

app.get('/values/all', async(req,res) => {
    try {
        console.log('test all values called');
        const values = await pgClient.query('SELECT * from values');
        console.log('test all values :',values, values.rows);
        res.status(200).send(values.rows);
    } catch (error) {
        console.log('Error in /values/all :',error);
    }
});

app.get('/values/current', async(req,res) => {
    console.log('test current values called ',);
    redisClient.hgetall('values', (err,values) => {
        console.log('test current values :', values);
        res.status(200).send(values);
    });
});

app.post('/values', async(req,res) => {
    const index = req.body.index;
    console.log('test index :',index, req.body);
    if(parseInt(index) > 40) return res.status(422).send(`Index is too high`);

    redisClient.hset('values', index, 'Nothing yet');
    redisPublisher.publish('insert', index);
    pgClient.query('INSERT INTO values(number) VALUES($1)', [index]);

    res.send({working: true});
});

app.listen(5000, (err) => {
    if(err) console.log('Error in listening to port 5000',err);
    else console.log('Listening to port 5000',process.env.PGPASSWORD, keys.pgPassword);
});
