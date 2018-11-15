const express = require('express')
const app = express()
const bodyParser = require('body-parser')
const shortid = require('shortid')
const cors = require('cors')

const mongoose = require('mongoose')
mongoose.connect(process.env.MLAB_URI || 'mongodb://localhost/exercise-track' )

app.use(cors());

app.use(bodyParser.urlencoded({extended: false}))
app.use(bodyParser.json());

app.use(express.static('public'))

// pull in the schema entity from mongoose:
const Schema = mongoose.Schema;

// make a new schema for a person:
const userSchema = new Schema({
  username: {
    type: String,
    required: true
  },
  userId: String,
  count: {
    type: Number,
    default: 0
  },
  log: [{}]
});

// make a model from that schema:
const UserList = mongoose.model('UserList',userSchema);

// update model index:
UserList.on('index',function(err){
  if (err) throw console.error(err);
});

// serve the index page: 
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});

// your first API endpoint:
app.get("/api/hello", function (req, res) {
  res.json({greeting: 'hello API'});
});

// new User API: 
app.post('/api/exercise/new-user',function(req,res){  
  
  console.log("~ new user form input ~");  
  var inputUsername = req.body.username;
  console.log(inputUsername);
  
  // Check if input username document exists in collection:
  UserList.find({username: inputUsername },function(err,found) {
    
    if (found.length == 1) {
      
      console.log('Username exists!');
      res.json({ username: found[0].username, userId: found[0].userId });
      
    } 
    else {
      
      console.log('Username not found in database, creating new user document');
      
      var shortIdNew = shortid.generate(); 
      
      UserList.create( { username: inputUsername, userId: shortIdNew } , function(err,data){
        res.json( {username: inputUsername, userId: shortIdNew } );
      });
      
    };
    
  });
  
});

// user list API point:
app.get('/api/exercise/users',function(req,res){
  
  UserList.find({}).select('username userId -_id').exec(function(err,data){
    res.json(data);    
  });
  
});

// user add API point:
app.post('/api/exercise/add', function(req,res){
  
  // input form data: 
  var addFormData = req.body;
  
  // find input userId and username in collection:
  UserList.findOne( {userId: req.body.userId} , function(err, matchingUserDoc) {
    
    if (!matchingUserDoc) {
      
      res.send("Input user ID doesn't exist");
      
    } 
    else {
      
      console.log('userID found, adding form data');  
      console.log(matchingUserDoc);
      
      var currentDbLog = matchingUserDoc.log.slice(0);
      var currentDbCount = matchingUserDoc.count;
            
      // date check for input form data:
      if (addFormData.date == '') {
        
        var currentDate = new Date;
        addFormData.date = currentDate.toDateString();
        
      }  
      else {
        
        var inputDate = new Date(addFormData.date);
        addFormData.date = inputDate.toDateString();
        
      };
            
      // make a log array entry with form input data:
      var addToLog = [{description: addFormData.description, duration: addFormData.duration, date: addFormData.date}];
      
      var updatedDbLog = currentDbLog.concat(addToLog);
      
      console.log(updatedDbLog);
      
      // set :
      matchingUserDoc.set( {log: updatedDbLog} );
      matchingUserDoc.set( {count: ++currentDbCount} );
      matchingUserDoc.save( function (err, updatedDoc) {
        
        if (err) {
          
          console.error(err);
          
        }        
        else {
          
          console.log(updatedDoc);
          res.json({"username": updatedDoc['username'], "userId": updatedDoc.userId, "count": updatedDoc.count, "log": updatedDoc.log });
          
        }

      });
   
    }
    
  });
    
});

// retrieve user logs for input queries:
app.get('/api/exercise/log', function(req,res){
  
  
  if (shortid.isValid(req.query.userId) == false ) {
    
    res.status(400).end();
  
  } else if (req.query.userId && !req.query.limit && !req.query.from && !req.query.to ) {
  
    UserList.findOne( {userId: req.query.userId}).exec(function(err, matchingUserDoc) {
      
      if (matchingUserDoc) {
        
        var filteredDoc = {
          "username": matchingUserDoc["username"],
          "userId": matchingUserDoc["userId"],
          "count": matchingUserDoc["count"],
          "log": matchingUserDoc["log"]          
        }
        
        console.log(filteredDoc)
        
        res.json(filteredDoc);
        
      } else {
        res.status(400).end();
      };
      
    })

  } else if (req.query.userId && req.query.limit > 0 && !req.query.from && !req.query.to ) {
    
    // console.log("path 7")
    
    UserList.findOne( {userId: req.query.userId}, function(err, matchingUserDoc) {
      
      if (matchingUserDoc) {        
        
        var filteredDoc = {
          "username": matchingUserDoc["username"],
          "userId": matchingUserDoc["userId"],
          "count": req.query.limit,
          "log": matchingUserDoc["log"].splice(0,req.query.limit)          
        }
        
        console.log(matchingUserDoc.log,filteredDoc)        
        res.json(filteredDoc)
        
      } else {
        res.status(400).end();
      };
      
    })
    
  } else if (req.query.userId && (req.query.from || req.query.to) ) {
    
    UserList.findOne( {userId: req.query.userId}, function(err, matchingUserDoc) {
      
      // console.log("path 9")
      
      if (matchingUserDoc) {        
        
        var filteredDoc = {
          username: matchingUserDoc["username"],
          userId: matchingUserDoc["userId"]
        }
        
        var newlogArr = [];
        
        if (req.query.from && req.query.to) {   
          
          // console.log("path 9a")
          
          filteredDoc.from =  new Date(req.query.from).toDateString();
          filteredDoc.to = new Date(req.query.to).toDateString();
          
          newlogArr = matchingUserDoc["log"].filter( logObj => Date.parse(logObj.date) > Date.parse(filteredDoc.from)  && Date.parse(logObj.date) < Date.parse(filteredDoc.to)  );
          
        } else if (req.query.from && !req.query.to) {
          
          // console.log("path 9b")
          
          filteredDoc.from =  new Date(req.query.from).toDateString();
          
          // console.log(filteredDoc.from)

          newlogArr = matchingUserDoc.log.filter( logObj => Date.parse(logObj.date) > Date.parse(filteredDoc.from) );  
          
        } else if (!req.query.from && req.query.to) {
          
          // console.log("path 9c")

          filteredDoc.to = new Date(req.query.to).toDateString();
          
          // console.log(filteredDoc.to)
          
          newlogArr = matchingUserDoc.log.filter( logObj => Date.parse(logObj.date) < Date.parse(filteredDoc.to) );   
          
          // console.log(newlogArr)
        }
        
        // apply limit if specified:
        if (req.query.limit > 0) {
          filteredDoc["log"] = newlogArr.splice(0,req.query.limit);      
        } else {
          filteredDoc["log"] = newlogArr;
        } 

        // set the count of log array:
        filteredDoc["count"] = filteredDoc["log"].length;
        
        res.json(filteredDoc)
        
      } else {
        
        res.status(400).end();
        
      };
      
    })
    
  } else {
    
    res.status(400).end();
    
  }
  
});

// Not found middleware:
app.use((req, res, next) => {
  return next({status: 404, message: 'not found'})
})

// Error Handling middleware:
app.use((err, req, res, next) => {
  
  let errCode, errMessage

  if (err.errors) {
    // mongoose validation error
    errCode = 400 // bad request
    const keys = Object.keys(err.errors)
    // report the first validation error
    errMessage = err.errors[keys[0]].message
  } else {
    // generic or custom error
    errCode = err.status || 500
    errMessage = err.message || 'Internal Server Error'
  }
  res.status(errCode).type('txt')
    .send(errMessage)
})

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})
